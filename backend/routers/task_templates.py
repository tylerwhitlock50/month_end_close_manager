from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user, require_role
from backend.models import (
    TaskTemplate as TaskTemplateModel,
    User as UserModel,
    UserRole
)
from backend.schemas import (
    TaskTemplate,
    TaskTemplateCreate,
    TaskTemplateUpdate
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
    template = TaskTemplateModel(**payload.dict())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


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

    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

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
