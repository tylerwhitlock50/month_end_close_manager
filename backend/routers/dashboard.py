from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    Task as TaskModel,
    Period as PeriodModel,
    User as UserModel,
    TaskStatus,
    PeriodStatus
)
from backend.schemas import DashboardStats, TaskSummary

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    period_id: int = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get overall dashboard statistics."""
    query = db.query(TaskModel)
    
    # Filter by period if specified
    if period_id:
        query = query.filter(TaskModel.period_id == period_id)
    else:
        # Default to current/active periods
        active_periods = db.query(PeriodModel).filter(
            PeriodModel.status.in_([PeriodStatus.IN_PROGRESS, PeriodStatus.UNDER_REVIEW])
        ).all()
        period_ids = [p.id for p in active_periods]
        if period_ids:
            query = query.filter(TaskModel.period_id.in_(period_ids))
    
    tasks = query.all()
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETE)
    in_progress_tasks = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    
    # Calculate overdue tasks
    now = datetime.utcnow()
    overdue_tasks = sum(
        1 for t in tasks 
        if t.due_date and t.due_date < now and t.status != TaskStatus.COMPLETE
    )
    
    # Tasks due today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    tasks_due_today = sum(
        1 for t in tasks 
        if t.due_date and today_start <= t.due_date < today_end and t.status != TaskStatus.COMPLETE
    )
    
    # Calculate completion percentage
    completion_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    # Calculate average time to complete
    completed_with_times = [
        t for t in tasks 
        if t.status == TaskStatus.COMPLETE and t.started_at and t.completed_at
    ]
    
    avg_time_to_complete = None
    if completed_with_times:
        total_hours = sum(
            (t.completed_at - t.started_at).total_seconds() / 3600 
            for t in completed_with_times
        )
        avg_time_to_complete = total_hours / len(completed_with_times)
    
    def to_summary(task: TaskModel) -> TaskSummary:
        return TaskSummary(id=task.id, name=task.name, status=task.status, due_date=task.due_date)

    blocked_tasks = [to_summary(t) for t in tasks if t.status == TaskStatus.BLOCKED]
    review_tasks = [to_summary(t) for t in tasks if t.status == TaskStatus.REVIEW]

    at_risk_deadline = datetime.utcnow() + timedelta(days=2)
    at_risk_tasks = [
        to_summary(t)
        for t in tasks
        if t.status != TaskStatus.COMPLETE and t.due_date and t.due_date <= at_risk_deadline
    ]

    blocked_tasks.sort(key=lambda item: item.due_date or datetime.max)
    review_tasks.sort(key=lambda item: item.due_date or datetime.max)
    at_risk_tasks.sort(key=lambda item: item.due_date or datetime.max)

    return DashboardStats(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        in_progress_tasks=in_progress_tasks,
        overdue_tasks=overdue_tasks,
        tasks_due_today=tasks_due_today,
        completion_percentage=round(completion_percentage, 2),
        avg_time_to_complete=round(avg_time_to_complete, 2) if avg_time_to_complete else None,
        blocked_tasks=blocked_tasks[:5],
        review_tasks=review_tasks[:5],
        at_risk_tasks=at_risk_tasks[:5]
    )

