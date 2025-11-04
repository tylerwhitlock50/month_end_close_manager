from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user, require_role
from backend.models import (
    TaskTemplate as TaskTemplateModel,
    User as UserModel,
    UserRole,
    CloseType
)
from backend.schemas import (
    TaskTemplate,
    TaskTemplateCreate,
    TaskTemplateUpdate,
    WorkflowResponse,
    WorkflowNode,
    WorkflowEdge,
    PositionUpdate
)


router = APIRouter(prefix="/api/task-templates", tags=["task-templates"])


@router.get("/", response_model=List[TaskTemplate])
async def list_task_templates(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Return all task templates."""
    templates = db.query(TaskTemplateModel).order_by(TaskTemplateModel.sort_order.asc()).all()
    return templates


@router.post("/", response_model=TaskTemplate, status_code=status.HTTP_201_CREATED)
async def create_task_template(
    payload: TaskTemplateCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """Create a new task template."""
    template_dict = payload.model_dump(exclude={"dependency_ids"})
    template = TaskTemplateModel(**template_dict)
    db.add(template)
    db.flush()
    
    # Add dependencies if provided
    if payload.dependency_ids:
        for dep_id in payload.dependency_ids:
            dep_template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == dep_id).first()
            if dep_template:
                template.dependencies.append(dep_template)
    
    db.commit()
    db.refresh(template)
    return template


# Workflow Builder Endpoints


@router.get("/workflow", response_model=WorkflowResponse)
async def get_template_workflow(
    close_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all task templates as workflow nodes with computed edges."""
    try:
        query = db.query(TaskTemplateModel).filter(TaskTemplateModel.is_active == True)
        
        if close_type:
            normalized_close_type = close_type.strip().lower()
            close_type_enum = None
            try:
                close_type_enum = CloseType(normalized_close_type)
            except ValueError:
                close_type_enum = None

            if close_type_enum:
                query = query.filter(TaskTemplateModel.close_type == close_type_enum)
        
        templates = query.order_by(TaskTemplateModel.sort_order.asc()).all()
        
        # Build workflow nodes
        nodes = []
        for template in templates:
            dependency_ids = [dep.id for dep in template.dependencies]
            node_data = {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "department": template.department,
                "owner": None,
                "assignee": None,
                "due_date": None,
                "priority": 5,
                "position_x": template.position_x,
                "position_y": template.position_y,
                "dependency_ids": dependency_ids,
                "status": None
            }
            nodes.append(node_data)
        
        # Compute edges from dependencies
        edges = []
        for template in templates:
            for dep in template.dependencies:
                edges.append({
                    "id": f"{dep.id}-{template.id}",
                    "source": dep.id,
                    "target": template.id
                })
        
        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{template_id}", response_model=TaskTemplate)
async def get_task_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Fetch a task template by ID."""
    template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Task template not found")
    return template


@router.put("/{template_id}", response_model=TaskTemplate)
async def update_task_template(
    template_id: int,
    payload: TaskTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """Update an existing task template."""
    template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Task template not found")

    update_data = payload.model_dump(exclude_unset=True)
    dependency_ids = update_data.pop("dependency_ids", None)
    
    for field, value in update_data.items():
        setattr(template, field, value)
    
    # Update dependencies if provided
    if dependency_ids is not None:
        template.dependencies = []
        for dep_id in dependency_ids:
            dep_template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == dep_id).first()
            if dep_template:
                template.dependencies.append(dep_template)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """Delete a task template."""
    template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Task template not found")

    db.delete(template)
    db.commit()


@router.put("/{template_id}/position")
async def update_template_position(
    template_id: int,
    position: PositionUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """Update the visual position of a template in the workflow builder."""
    template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Task template not found")
    
    template.position_x = position.position_x
    template.position_y = position.position_y
    
    db.commit()
    return {"success": True, "message": "Position updated"}


@router.put("/{template_id}/dependencies")
async def update_template_dependencies(
    template_id: int,
    dependency_ids: List[int],
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """Update the dependencies for a task template."""
    template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Task template not found")
    
    # Check for circular dependencies
    def has_circular_dependency(template_id: int, target_id: int, visited: set = None) -> bool:
        if visited is None:
            visited = set()
        if template_id == target_id:
            return True
        if template_id in visited:
            return False
        visited.add(template_id)
        
        template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == template_id).first()
        if not template:
            return False
        
        for dep in template.dependencies:
            if has_circular_dependency(dep.id, target_id, visited):
                return True
        return False
    
    # Validate no circular dependencies
    for dep_id in dependency_ids:
        if has_circular_dependency(dep_id, template_id):
            raise HTTPException(
                status_code=400, 
                detail=f"Circular dependency detected: template {dep_id} creates a cycle"
            )
    
    # Update dependencies
    template.dependencies = []
    for dep_id in dependency_ids:
        dep_template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == dep_id).first()
        if dep_template:
            template.dependencies.append(dep_template)
    
    db.commit()
    return {"success": True, "message": "Dependencies updated", "dependency_ids": dependency_ids}
