from typing import List, Optional
from datetime import datetime, timedelta, timezone, date
import calendar

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    Task as TaskModel,
    User as UserModel,
    Period as PeriodModel,
    TaskTemplate as TaskTemplateModel,
    AuditLog as AuditLogModel,
    File as FileModel,
    Approval as ApprovalModel,
    TaskStatus,
    task_dependencies
)
from backend.schemas import Task, TaskCreate, TaskUpdate, TaskWithRelations
from backend.services.trial_balance_linker import auto_link_tasks_to_trial_balance_accounts

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _compute_due_datetime(period: PeriodModel, offset_days: int = 0) -> datetime:
    if period.target_close_date:
        base_date: date = period.target_close_date
    else:
        last_day = calendar.monthrange(period.year, period.month)[1]
        base_date = date(period.year, period.month, last_day)

    base_dt = datetime.combine(base_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    return base_dt + timedelta(days=offset_days)


def log_task_change(db: Session, task: TaskModel, user: UserModel, action: str, old_value: str = None, new_value: str = None):
    """Helper function to log task changes."""
    audit_log = AuditLogModel(
        task_id=task.id,
        user_id=user.id,
        action=action,
        entity_type="task",
        entity_id=task.id,
        old_value=old_value,
        new_value=new_value
    )
    db.add(audit_log)


@router.get("/", response_model=List[TaskWithRelations])
async def get_tasks(
    skip: int = 0,
    limit: int = 100,
    period_id: Optional[int] = None,
    status: Optional[TaskStatus] = None,
    owner_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get tasks with optional filters."""
    query = db.query(TaskModel).join(PeriodModel)

    if period_id:
        query = query.filter(TaskModel.period_id == period_id)
    else:
        query = query.filter(PeriodModel.is_active == True)
    if status:
        query = query.filter(TaskModel.status == status)
    if owner_id:
        query = query.filter(TaskModel.owner_id == owner_id)
    if assignee_id:
        query = query.filter(TaskModel.assignee_id == assignee_id)
    if department:
        query = query.filter(TaskModel.department == department)
    
    tasks = query.order_by(TaskModel.due_date.asc()).offset(skip).limit(limit).all()
    
    # Enrich with relations
    result = []
    for task in tasks:
        file_count = db.query(FileModel).filter(FileModel.task_id == task.id).count()
        pending_approvals = db.query(ApprovalModel).filter(
            ApprovalModel.task_id == task.id,
            ApprovalModel.status == "pending"
        ).count()
        
        dependency_ids = [dep.id for dep in task.dependencies]
        
        task_dict = {
            **task.__dict__,
            "owner": task.owner,
            "assignee": task.assignee,
            "period": task.period,
            "file_count": file_count,
            "pending_approvals": pending_approvals,
            "dependencies": dependency_ids
        }
        result.append(task_dict)
    
    return result


@router.get("/my-tasks", response_model=List[TaskWithRelations])
async def get_my_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get tasks assigned to or owned by the current user."""
    tasks = (
        db.query(TaskModel)
        .join(PeriodModel)
        .filter(
            ((TaskModel.owner_id == current_user.id) | (TaskModel.assignee_id == current_user.id))
            & (PeriodModel.is_active == True)
        )
        .order_by(TaskModel.due_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    result = []
    for task in tasks:
        file_count = db.query(FileModel).filter(FileModel.task_id == task.id).count()
        pending_approvals = db.query(ApprovalModel).filter(
            ApprovalModel.task_id == task.id,
            ApprovalModel.status == "pending"
        ).count()
        
        dependency_ids = [dep.id for dep in task.dependencies]
        
        task_dict = {
            **task.__dict__,
            "owner": task.owner,
            "assignee": task.assignee,
            "period": task.period,
            "file_count": file_count,
            "pending_approvals": pending_approvals,
            "dependencies": dependency_ids
        }
        result.append(task_dict)
    
    return result


@router.get("/{task_id}", response_model=TaskWithRelations)
async def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get a specific task by ID."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    file_count = db.query(FileModel).filter(FileModel.task_id == task.id).count()
    pending_approvals = db.query(ApprovalModel).filter(
        ApprovalModel.task_id == task.id,
        ApprovalModel.status == "pending"
    ).count()
    
    dependency_ids = [dep.id for dep in task.dependencies]
    
    return {
        **task.__dict__,
        "owner": task.owner,
        "assignee": task.assignee,
        "period": task.period,
        "file_count": file_count,
        "pending_approvals": pending_approvals,
        "dependencies": dependency_ids
    }


@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new task."""
    # Verify period exists
    period = db.query(PeriodModel).filter(PeriodModel.id == task_data.period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    # Create task
    task_dict = task_data.dict(exclude={"dependency_ids"})

    if not task_dict.get("due_date"):
        offset_days = 0
        if task_data.template_id:
            template = db.query(TaskTemplateModel).filter(TaskTemplateModel.id == task_data.template_id).first()
            if template:
                offset_days = template.days_offset or 0
        task_dict["due_date"] = _compute_due_datetime(period, offset_days)

    db_task = TaskModel(**task_dict)
    db.add(db_task)
    db.flush()
    
    # Add dependencies
    if task_data.dependency_ids:
        for dep_id in task_data.dependency_ids:
            dep_task = db.query(TaskModel).filter(TaskModel.id == dep_id).first()
            if dep_task:
                db_task.dependencies.append(dep_task)

    auto_link_tasks_to_trial_balance_accounts(
        db,
        period_id=task_data.period_id,
        task_ids=[db_task.id]
    )

    db.commit()
    db.refresh(db_task)
    
    # Log creation
    log_task_change(db, db_task, current_user, "created")
    db.commit()
    
    return db_task


@router.put("/{task_id}", response_model=Task)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update a task."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_update.dict(exclude_unset=True, exclude={"dependency_ids"})
    
    # Track status changes
    old_status = task.status
    
    for field, value in update_data.items():
        old_value = getattr(task, field)
        setattr(task, field, value)
        
        # Log significant changes
        if field == "status" and old_value != value:
            log_task_change(db, task, current_user, "status_changed", str(old_value), str(value))
            
            # Update timestamps based on status
            if value == TaskStatus.IN_PROGRESS and not task.started_at:
                task.started_at = datetime.utcnow()
            elif value == TaskStatus.COMPLETE and not task.completed_at:
                task.completed_at = datetime.utcnow()
    
    # Update dependencies if provided
    if task_update.dependency_ids is not None:
        # Clear existing dependencies
        task.dependencies = []
        
        # Add new dependencies
        for dep_id in task_update.dependency_ids:
            dep_task = db.query(TaskModel).filter(TaskModel.id == dep_id).first()
            if dep_task:
                task.dependencies.append(dep_task)
    
    db.commit()
    db.refresh(task)
    
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete a task."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Log deletion
    log_task_change(db, task, current_user, "deleted")
    
    db.delete(task)
    db.commit()
    return None

