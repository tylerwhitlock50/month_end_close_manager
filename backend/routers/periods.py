from typing import List
from datetime import datetime, timedelta, timezone, date
import calendar

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.auth import get_current_user, require_role
from backend.models import (
    Period as PeriodModel,
    Task as TaskModel,
    TaskTemplate as TaskTemplateModel,
    User as UserModel,
    UserRole,
    TaskStatus
)
from backend.schemas import Period, PeriodCreate, PeriodUpdate, PeriodProgress, DashboardStats

router = APIRouter(prefix="/api/periods", tags=["periods"])


def _compute_due_datetime(period: PeriodModel, offset_days: int = 0) -> datetime:
    if period.target_close_date:
        base_date: date = period.target_close_date
    else:
        last_day = calendar.monthrange(period.year, period.month)[1]
        base_date = date(period.year, period.month, last_day)

    base_dt = datetime.combine(base_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    return base_dt + timedelta(days=offset_days)


@router.get("/", response_model=List[Period])
async def get_periods(
    skip: int = 0,
    limit: int = 100,
    year: int = None,
    include_inactive: bool = True,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all periods."""
    query = db.query(PeriodModel)
    
    if year:
        query = query.filter(PeriodModel.year == year)

    if not include_inactive:
        query = query.filter(PeriodModel.is_active == True)
    
    periods = query.order_by(PeriodModel.year.desc(), PeriodModel.month.desc())\
                   .offset(skip).limit(limit).all()
    return periods


@router.get("/{period_id}", response_model=Period)
async def get_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get a specific period by ID."""
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    return period


@router.get("/{period_id}/progress", response_model=PeriodProgress)
async def get_period_progress(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get detailed progress statistics for a period."""
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    # Get task statistics
    tasks = db.query(TaskModel).filter(TaskModel.period_id == period_id).all()
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETE)
    in_progress_tasks = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    overdue_tasks = sum(1 for t in tasks if t.due_date and t.due_date < func.now() and t.status != TaskStatus.COMPLETE)
    
    # Calculate completion percentage
    completion_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    # Tasks by status
    tasks_by_status = {}
    for task_status in TaskStatus:
        tasks_by_status[task_status.value] = sum(1 for t in tasks if t.status == task_status)
    
    # Tasks by department
    tasks_by_department = {}
    for task in tasks:
        dept = task.department or "Unassigned"
        tasks_by_department[dept] = tasks_by_department.get(dept, 0) + 1
    
    stats = DashboardStats(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        in_progress_tasks=in_progress_tasks,
        overdue_tasks=overdue_tasks,
        tasks_due_today=0,  # TODO: Calculate
        completion_percentage=completion_percentage,
        avg_time_to_complete=None  # TODO: Calculate
    )
    
    return {
        "period": period,
        "stats": stats,
        "tasks_by_status": tasks_by_status,
        "tasks_by_department": tasks_by_department
    }


@router.post("/", response_model=Period, status_code=status.HTTP_201_CREATED)
async def create_period(
    period_data: PeriodCreate,
    roll_forward_tasks: bool = False,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """Create a new period and optionally roll forward tasks from templates."""
    # Check if period already exists
    existing = db.query(PeriodModel).filter(
        PeriodModel.month == period_data.month,
        PeriodModel.year == period_data.year
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Period already exists for this month and year"
        )
    
    # Create period
    db_period = PeriodModel(**period_data.dict())
    db.add(db_period)
    db.commit()
    db.refresh(db_period)
    
    # Roll forward tasks from templates if requested
    if roll_forward_tasks:
        templates = db.query(TaskTemplateModel).filter(
            TaskTemplateModel.close_type == period_data.close_type,
            TaskTemplateModel.is_active == True
        ).all()
        
        for template in templates:
            due_date = _compute_due_datetime(db_period, template.days_offset or 0)
            task = TaskModel(
                period_id=db_period.id,
                template_id=template.id,
                name=template.name,
                description=template.description,
                owner_id=template.default_owner_id or current_user.id,
                department=template.department,
                estimated_hours=template.estimated_hours,
                is_recurring=True,
                due_date=due_date
            )
            db.add(task)
        
        db.commit()
    
    return db_period


@router.put("/{period_id}", response_model=Period)
async def update_period(
    period_id: int,
    period_update: PeriodUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """Update a period."""
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    update_data = period_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(period, field, value)
    
    db.commit()
    db.refresh(period)
    return period


@router.patch("/{period_id}/activation", response_model=Period)
async def set_period_activation(
    period_id: int,
    is_active: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    period.is_active = is_active
    db.commit()
    db.refresh(period)

    return period


@router.delete("/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role([UserRole.ADMIN]))
):
    """Delete a period (admin only)."""
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    db.delete(period)
    db.commit()
    return None

