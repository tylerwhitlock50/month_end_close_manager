from typing import Dict, List, Tuple, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta, timezone

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    Task as TaskModel,
    Period as PeriodModel,
    User as UserModel,
    TaskStatus,
    PeriodStatus,
    Approval as ApprovalModel,
    ApprovalStatus,
    File as FileModel,
    task_dependencies
)
from backend.schemas import (
    DashboardStats,
    TaskSummary,
    MyReviewsResponse,
    ReviewTask,
    ReviewApproval,
    CriticalPathItem,
)

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
    
    # Calculate overdue tasks using a single timezone-aware reference
    now_utc = datetime.now(timezone.utc)
    far_future = now_utc + timedelta(days=3650)

    def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    overdue_tasks = sum(
        1
        for t in tasks
        if (due_date := ensure_aware(t.due_date)) and due_date < now_utc and t.status != TaskStatus.COMPLETE
    )
    
    # Tasks due today
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    tasks_due_today = sum(
        1
        for t in tasks
        if (due_date := ensure_aware(t.due_date)) and today_start <= due_date < today_end and t.status != TaskStatus.COMPLETE
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
            (
                (ensure_aware(t.completed_at) - ensure_aware(t.started_at)).total_seconds() / 3600
            )
            for t in completed_with_times
        )
        avg_time_to_complete = total_hours / len(completed_with_times)
    
    def to_summary(task: TaskModel) -> TaskSummary:
        return TaskSummary(id=task.id, name=task.name, status=task.status, due_date=task.due_date)

    blocked_tasks = [to_summary(t) for t in tasks if t.status == TaskStatus.BLOCKED]
    review_tasks = [to_summary(t) for t in tasks if t.status == TaskStatus.REVIEW]

    at_risk_deadline = now_utc + timedelta(days=2)
    at_risk_tasks = [
        to_summary(t)
        for t in tasks
        if t.status != TaskStatus.COMPLETE
        and (due_date := ensure_aware(t.due_date))
        and due_date <= at_risk_deadline
    ]

    def summary_sort_key(summary: TaskSummary) -> datetime:
        return ensure_aware(summary.due_date) or far_future

    blocked_tasks.sort(key=summary_sort_key)
    review_tasks.sort(key=summary_sort_key)
    at_risk_tasks.sort(key=summary_sort_key)

    critical_path_items: List[CriticalPathItem] = []
    task_ids = [task.id for task in tasks]

    if task_ids:
        dependency_rows = (
            db.query(
                task_dependencies.c.depends_on_id.label("blocker_id"),
                TaskModel.id.label("dependent_id"),
                TaskModel.name.label("dependent_name"),
                TaskModel.status.label("dependent_status"),
                TaskModel.due_date.label("dependent_due"),
            )
            .join(TaskModel, TaskModel.id == task_dependencies.c.task_id)
            .filter(task_dependencies.c.depends_on_id.in_(task_ids))
            .filter(TaskModel.id.in_(task_ids))
            .all()
        )

        dependents_by_blocker: Dict[int, List[TaskSummary]] = {}

        for row in dependency_rows:
            dependent_status = row.dependent_status
            if dependent_status == TaskStatus.COMPLETE:
                continue

            dependents_by_blocker.setdefault(row.blocker_id, []).append(
                TaskSummary(
                    id=row.dependent_id,
                    name=row.dependent_name,
                    status=dependent_status,
                    due_date=row.dependent_due,
                )
            )

        if dependents_by_blocker:
            reference_now = now_utc
            candidates: List[Tuple[TaskModel, List[TaskSummary], int, int]] = []

            for task in tasks:
                dependents = dependents_by_blocker.get(task.id)
                if not dependents:
                    continue

                if task.status == TaskStatus.COMPLETE:
                    continue

                dependents.sort(key=summary_sort_key)
                blocked_count = len(dependents)
                task_due = ensure_aware(task.due_date)
                overdue_flag = 0 if task_due and task_due < reference_now else 1

                candidates.append((task, dependents, blocked_count, overdue_flag))

            candidates.sort(
                key=lambda item: (
                    item[3],
                    ensure_aware(item[0].due_date) or far_future,
                    -item[2],
                )
            )

            critical_path_items = [
                CriticalPathItem(
                    id=task.id,
                    name=task.name,
                    status=task.status,
                    due_date=task.due_date,
                    blocked_dependents=blocked_count,
                    dependents=dependents,
                )
                for task, dependents, blocked_count, _ in candidates[:5]
            ]

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
        at_risk_tasks=at_risk_tasks[:5],
        critical_path_tasks=critical_path_items,
    )


@router.get("/my-reviews", response_model=MyReviewsResponse)
async def get_my_reviews(
    period_id: int = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all items awaiting review by the current user."""
    # Get tasks in review status where user is owner or assignee
    tasks_query = (
        db.query(TaskModel)
        .join(PeriodModel)
        .filter(TaskModel.status == TaskStatus.REVIEW)
        .filter(
            or_(
                TaskModel.owner_id == current_user.id,
                TaskModel.assignee_id == current_user.id
            )
        )
    )
    
    if period_id:
        tasks_query = tasks_query.filter(TaskModel.period_id == period_id)
    else:
        tasks_query = tasks_query.filter(PeriodModel.is_active == True)
    
    tasks = tasks_query.order_by(TaskModel.due_date.asc()).all()
    
    # Get pending approvals assigned to user
    approvals_query = (
        db.query(ApprovalModel)
        .join(TaskModel, ApprovalModel.task_id == TaskModel.id)
        .join(PeriodModel, TaskModel.period_id == PeriodModel.id)
        .filter(ApprovalModel.reviewer_id == current_user.id)
        .filter(ApprovalModel.status == ApprovalStatus.PENDING)
    )
    
    if period_id:
        approvals_query = approvals_query.filter(TaskModel.period_id == period_id)
    else:
        approvals_query = approvals_query.filter(PeriodModel.is_active == True)
    
    approvals = approvals_query.order_by(ApprovalModel.requested_at.asc()).all()

    now_aware = datetime.now(timezone.utc)
    now_naive = now_aware.replace(tzinfo=None)

    def is_overdue_due_date(due_date: datetime | None) -> bool:
        if not due_date:
            return False
        if due_date.tzinfo is None:
            return due_date < now_naive
        return due_date.astimezone(timezone.utc) < now_aware
    
    # Build review tasks
    review_tasks = []
    overdue_count = 0
    
    for task in tasks:
        file_count = db.query(FileModel).filter(FileModel.task_id == task.id).count()
        is_overdue = is_overdue_due_date(task.due_date)
        if is_overdue:
            overdue_count += 1
        
        review_tasks.append(ReviewTask(
            id=task.id,
            name=task.name,
            description=task.description,
            status=task.status,
            due_date=task.due_date,
            assignee=task.assignee,
            period=task.period,
            file_count=file_count,
            is_overdue=is_overdue,
            department=task.department
        ))
    
    # Build approval items
    pending_approvals = []
    
    for approval in approvals:
        task = approval.task
        file_count = db.query(FileModel).filter(FileModel.task_id == task.id).count()
        is_overdue = is_overdue_due_date(task.due_date)
        if is_overdue:
            overdue_count += 1
        
        pending_approvals.append(ReviewApproval(
            id=approval.id,
            task_id=task.id,
            task_name=task.name,
            status=approval.status,
            notes=approval.notes,
            requested_at=approval.requested_at,
            period=task.period,
            assignee=task.assignee,
            file_count=file_count,
            is_overdue=is_overdue
        ))
    
    total_pending = len(review_tasks) + len(pending_approvals)
    
    return MyReviewsResponse(
        review_tasks=review_tasks,
        pending_approvals=pending_approvals,
        total_pending=total_pending,
        overdue_count=overdue_count
    )
