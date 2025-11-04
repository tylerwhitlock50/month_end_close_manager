from typing import List, Optional
from datetime import datetime, timedelta, timezone, date
import calendar

from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

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
    Comment as CommentModel,
    TaskStatus,
    task_dependencies
)
from backend.schemas import (
    Task,
    TaskCreate,
    TaskUpdate,
    TaskWithRelations,
    TaskBulkUpdateRequest,
    TaskBulkUpdateResult,
    TaskBulkDeleteRequest,
    TaskBulkDeleteResult,
    AuditLogWithUser,
    TaskActivityEvent,
    TaskActivityFeed,
    PriorTaskSnapshot,
    TaskFileSummary,
    TaskCommentSummary,
    TaskSummary,
    WorkflowResponse,
    WorkflowNode,
    WorkflowEdge,
    PositionUpdate
)
from backend.services.trial_balance_linker import auto_link_tasks_to_trial_balance_accounts
from backend.services.notifications import NotificationService

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


def _get_previous_period(db: Session, period: PeriodModel) -> Optional[PeriodModel]:
    prev_month = period.month - 1
    prev_year = period.year
    if prev_month <= 0:
        prev_month = 12
        prev_year -= 1

    candidate = (
        db.query(PeriodModel)
        .filter(
            PeriodModel.close_type == period.close_type,
            PeriodModel.year == prev_year,
            PeriodModel.month == prev_month,
        )
        .order_by(PeriodModel.id.desc())
        .first()
    )
    if candidate:
        return candidate

    return (
        db.query(PeriodModel)
        .filter(PeriodModel.close_type == period.close_type)
        .filter(
            (PeriodModel.year < period.year)
            | ((PeriodModel.year == period.year) & (PeriodModel.month < period.month))
        )
        .order_by(PeriodModel.year.desc(), PeriodModel.month.desc())
        .first()
    )


def _map_file_to_summary(db: Session, file: FileModel) -> TaskFileSummary:
    uploaded_by = file.uploaded_by if hasattr(file, "uploaded_by") else None
    if uploaded_by is None and file.uploaded_by_id:
        uploaded_by = db.query(UserModel).filter(UserModel.id == file.uploaded_by_id).first()

    return TaskFileSummary(
        id=file.id,
        filename=file.filename,
        original_filename=file.original_filename,
        file_size=file.file_size,
        mime_type=file.mime_type,
        uploaded_at=file.uploaded_at,
        uploaded_by=uploaded_by,
    )


def _map_comment_to_summary(comment: CommentModel) -> TaskCommentSummary:
    return TaskCommentSummary(
        id=comment.id,
        content=comment.content,
        created_at=comment.created_at,
        user=comment.user,
    )


def _map_task_to_summary(task: TaskModel) -> TaskSummary:
    return TaskSummary(
        id=task.id,
        name=task.name,
        status=task.status,
        due_date=task.due_date,
    )


@router.get("/", response_model=List[TaskWithRelations])
async def get_tasks(
    skip: int = 0,
    limit: int = 100,
    period_id: Optional[int] = None,
    status: Optional[TaskStatus] = None,
    owner_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    department: Optional[str] = None,
    mine: bool = Query(False),
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
    if mine:
        query = query.filter(
            or_(
                TaskModel.owner_id == current_user.id,
                TaskModel.assignee_id == current_user.id
            )
        )
    
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
        dependency_details = [_map_task_to_summary(dep) for dep in task.dependencies]
        dependent_details = [_map_task_to_summary(dep) for dep in task.dependent_tasks]

        task_dict = {
            **task.__dict__,
            "owner": task.owner,
            "assignee": task.assignee,
            "period": task.period,
            "file_count": file_count,
            "pending_approvals": pending_approvals,
            "dependencies": dependency_ids,
            "dependency_details": dependency_details,
            "dependent_details": dependent_details,
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
        dependency_details = [_map_task_to_summary(dep) for dep in task.dependencies]
        dependent_details = [_map_task_to_summary(dep) for dep in task.dependent_tasks]

        task_dict = {
            **task.__dict__,
            "owner": task.owner,
            "assignee": task.assignee,
            "period": task.period,
            "file_count": file_count,
            "pending_approvals": pending_approvals,
            "dependencies": dependency_ids,
            "dependency_details": dependency_details,
            "dependent_details": dependent_details,
        }
        result.append(task_dict)
    
    return result


@router.get("/review-queue", response_model=List[TaskWithRelations])
async def get_review_queue(
    skip: int = 0,
    limit: int = 100,
    period_id: Optional[int] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Tasks awaiting review for the current user."""
    query = (
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
        query = query.filter(TaskModel.period_id == period_id)
    else:
        query = query.filter(PeriodModel.is_active == True)

    if department:
        query = query.filter(TaskModel.department == department)

    tasks = (
        query
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
        dependency_details = [_map_task_to_summary(dep) for dep in task.dependencies]
        dependent_details = [_map_task_to_summary(dep) for dep in task.dependent_tasks]

        task_dict = {
            **task.__dict__,
            "owner": task.owner,
            "assignee": task.assignee,
            "period": task.period,
            "file_count": file_count,
            "pending_approvals": pending_approvals,
            "dependencies": dependency_ids,
            "dependency_details": dependency_details,
            "dependent_details": dependent_details,
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
    dependency_details = [_map_task_to_summary(dep) for dep in task.dependencies]
    dependent_details = [_map_task_to_summary(dep) for dep in task.dependent_tasks]

    return {
        **task.__dict__,
        "owner": task.owner,
        "assignee": task.assignee,
        "period": task.period,
        "file_count": file_count,
        "pending_approvals": pending_approvals,
        "dependencies": dependency_ids,
        "dependency_details": dependency_details,
        "dependent_details": dependent_details,
    }


@router.get("/{task_id}/audit-logs", response_model=List[AuditLogWithUser])
async def get_task_audit_logs(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    logs = (
        db.query(AuditLogModel)
        .options(selectinload(AuditLogModel.user))
        .filter(AuditLogModel.task_id == task_id)
        .order_by(AuditLogModel.created_at.desc())
        .all()
    )

    return logs


@router.get("/{task_id}/activity", response_model=TaskActivityFeed)
async def get_task_activity(
    task_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    comments = (
        db.query(CommentModel)
        .options(selectinload(CommentModel.user))
        .filter(CommentModel.task_id == task_id)
        .all()
    )

    audit_logs = (
        db.query(AuditLogModel)
        .options(selectinload(AuditLogModel.user))
        .filter(AuditLogModel.task_id == task_id)
        .order_by(AuditLogModel.created_at.desc())
        .all()
    )

    def format_status_label(raw: Optional[str]) -> Optional[str]:
        if not raw:
            return None
        value = raw
        if raw.startswith("TaskStatus."):
            value = raw.split(".", 1)[1]
        normalized = value.lower()
        mapping = {
            "not_started": "Not Started",
            "in_progress": "In Progress",
            "review": "Ready for Review",
            "complete": "Complete",
            "blocked": "Blocked",
        }
        return mapping.get(normalized, value.replace("_", " ").title())

    def format_log_message(log: AuditLogModel) -> str:
        if log.action == "status_changed":
            old_label = format_status_label(log.old_value)
            new_label = format_status_label(log.new_value)
            if old_label and new_label:
                return f"Status changed from {old_label} to {new_label}"
            return "Status updated"
        if log.action == "file_uploaded":
            return log.details or "File uploaded"
        if log.action == "file_deleted":
            return log.details or "File removed"
        if log.action == "created":
            return "Task created"
        if log.details:
            return log.details
        return log.action.replace("_", " ").title()

    events: List[TaskActivityEvent] = []

    for comment in comments:
        events.append(
            TaskActivityEvent(
                id=f"comment-{comment.id}",
                event_type="comment",
                message=comment.content,
                created_at=comment.created_at,
                user=comment.user,
                metadata={"is_internal": comment.is_internal}
            )
        )

    for log in audit_logs:
        events.append(
            TaskActivityEvent(
                id=f"audit-{log.id}",
                event_type="activity",
                message=format_log_message(log),
                created_at=log.created_at,
                user=log.user,
                metadata={
                    "action": log.action,
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                }
            )
        )

    events.sort(key=lambda event: event.created_at, reverse=True)

    total_events = len(events)
    start = min(offset, total_events)
    end = min(start + limit, total_events)
    sliced = events[start:end]

    return TaskActivityFeed(
        total=total_events,
        limit=limit,
        offset=offset,
        events=sliced,
    )


@router.get("/{task_id}/prior", response_model=PriorTaskSnapshot)
async def get_prior_task_snapshot(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    period = db.query(PeriodModel).filter(PeriodModel.id == task.period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    previous_period = _get_previous_period(db, period)
    if not previous_period:
        raise HTTPException(status_code=404, detail="Previous period not found")

    candidate_query = db.query(TaskModel).filter(TaskModel.period_id == previous_period.id)
    candidate = None

    if task.template_id:
        candidate = (
            candidate_query
            .filter(TaskModel.template_id == task.template_id)
            .order_by(TaskModel.id.desc())
            .first()
        )

    if not candidate:
        candidate = (
            candidate_query
            .filter(TaskModel.name == task.name)
            .order_by(TaskModel.id.desc())
            .first()
        )

    if not candidate:
        raise HTTPException(status_code=404, detail="No matching task in previous period")

    files = (
        db.query(FileModel)
        .options(selectinload(FileModel.uploaded_by))
        .filter(FileModel.task_id == candidate.id)
        .order_by(FileModel.uploaded_at.desc())
        .all()
    )

    comments = (
        db.query(CommentModel)
        .options(selectinload(CommentModel.user))
        .filter(CommentModel.task_id == candidate.id)
        .order_by(CommentModel.created_at.desc())
        .limit(10)
        .all()
    )

    file_summaries = [_map_file_to_summary(db, file) for file in files]
    comment_summaries = [_map_comment_to_summary(comment) for comment in comments]

    return PriorTaskSnapshot(
        task_id=candidate.id,
        period_id=previous_period.id,
        period_name=previous_period.name,
        name=candidate.name,
        status=candidate.status,
        due_date=candidate.due_date,
        files=file_summaries,
        comments=comment_summaries,
    )


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
    task_dict = task_data.model_dump(exclude={"dependency_ids"})

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

    if db_task.assignee_id and db_task.assignee_id != current_user.id:
        NotificationService.create_notification(
            db,
            user_id=db_task.assignee_id,
            title="New task assigned",
            message=f"You have been assigned '{db_task.name}'.",
            notification_type="task_assigned",
            link_url=f"/tasks?mine=1&highlight={db_task.id}",
        )

    # Log creation
    log_task_change(db, db_task, current_user, "created")
    db.commit()

    return db_task


@router.post("/bulk-update", response_model=TaskBulkUpdateResult)
async def bulk_update_tasks(
    payload: TaskBulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if not payload.task_ids:
        raise HTTPException(status_code=400, detail="Provide one or more task ids")

    if payload.status is None and payload.assignee_id is None:
        raise HTTPException(status_code=400, detail="No updates were specified")

    assignee = None
    if payload.assignee_id is not None:
        assignee = db.query(UserModel).filter(UserModel.id == payload.assignee_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found")

    tasks = db.query(TaskModel).filter(TaskModel.id.in_(payload.task_ids)).all()
    if not tasks:
        return TaskBulkUpdateResult(updated=0)

    updated_count = 0
    now = datetime.utcnow()

    for task in tasks:
        changes_made = False

        if payload.status is not None and task.status != payload.status:
            old_status = task.status
            task.status = payload.status
            changes_made = True

            if payload.status == TaskStatus.IN_PROGRESS and not task.started_at:
                task.started_at = now
            if payload.status == TaskStatus.COMPLETE and not task.completed_at:
                task.completed_at = now

            log_task_change(db, task, current_user, "status_changed", str(old_status), str(payload.status))

            if payload.status == TaskStatus.REVIEW and task.owner_id and task.owner_id != current_user.id:
                NotificationService.create_notification(
                    db,
                    user_id=task.owner_id,
                    title="Task ready for review",
                    message=f"{task.name} is ready for your review.",
                    notification_type="task_review",
                    link_url=f"/tasks?review=1&highlight={task.id}",
                )

        if payload.assignee_id is not None and task.assignee_id != payload.assignee_id:
            old_value = str(task.assignee_id) if task.assignee_id else None
            task.assignee_id = payload.assignee_id
            changes_made = True
            log_task_change(db, task, current_user, "assignee_changed", old_value, str(payload.assignee_id))

            if task.assignee_id and task.assignee_id != current_user.id:
                NotificationService.create_notification(
                    db,
                    user_id=task.assignee_id,
                    title="Task assigned",
                    message=f"You have been assigned '{task.name}'.",
                    notification_type="task_assigned",
                    link_url=f"/tasks?mine=1&highlight={task.id}",
                )

        if changes_made:
            updated_count += 1

    db.commit()

    return TaskBulkUpdateResult(updated=updated_count)


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
    
    update_data = task_update.model_dump(exclude_unset=True, exclude={"dependency_ids"})
    previous_assignee = task.assignee_id
    
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

            if value == TaskStatus.REVIEW and task.owner_id and task.owner_id != current_user.id:
                NotificationService.create_notification(
                    db,
                    user_id=task.owner_id,
                    title="Task ready for review",
                    message=f"{task.name} is ready for your review.",
                    notification_type="task_review",
                    link_url=f"/tasks?review=1&highlight={task.id}",
                )
    
    # Update dependencies if provided
    if task_update.dependency_ids is not None:
        existing_dependency_ids = sorted(dep.id for dep in task.dependencies)

        task.dependencies = []
        new_dependency_ids: List[int] = []

        for dep_id in task_update.dependency_ids:
            dep_task = db.query(TaskModel).filter(TaskModel.id == dep_id).first()
            if dep_task:
                task.dependencies.append(dep_task)
                new_dependency_ids.append(dep_task.id)

        new_dependency_ids.sort()

        if existing_dependency_ids != new_dependency_ids:
            log_task_change(
                db,
                task,
                current_user,
                "dependencies_updated",
                str(existing_dependency_ids),
                str(new_dependency_ids),
            )

    if (
        task_update.assignee_id is not None
        and task.assignee_id is not None
        and task.assignee_id != previous_assignee
        and task.assignee_id != current_user.id
    ):
        NotificationService.create_notification(
            db,
            user_id=task.assignee_id,
            title="Task assigned",
            message=f"You have been assigned '{task.name}'.",
            notification_type="task_assigned",
            link_url=f"/tasks?mine=1&highlight={task.id}",
        )

    db.commit()
    db.refresh(task)

    return task


@router.post("/bulk-delete", response_model=TaskBulkDeleteResult)
async def bulk_delete_tasks(
    payload: TaskBulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Bulk delete tasks."""
    if not payload.task_ids:
        raise HTTPException(status_code=400, detail="Provide one or more task ids")
    
    tasks = db.query(TaskModel).filter(TaskModel.id.in_(payload.task_ids)).all()
    if not tasks:
        return TaskBulkDeleteResult(deleted=0)
    
    deleted_count = 0
    for task in tasks:
        # Log deletion
        log_task_change(db, task, current_user, "deleted")
        db.delete(task)
        deleted_count += 1
    
    db.commit()
    return TaskBulkDeleteResult(deleted=deleted_count)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete a single task."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Log deletion
    log_task_change(db, task, current_user, "deleted")
    
    # Delete the task
    db.delete(task)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Workflow Builder Endpoints

@router.get("/period/{period_id}/workflow")
async def get_period_workflow(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all tasks for a period as workflow nodes with computed edges."""
    try:
        # Verify period exists
        period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Period not found")
        
        tasks = db.query(TaskModel).filter(TaskModel.period_id == period_id).all()
        
        # Build workflow nodes
        nodes = []
        for task in tasks:
            dependency_ids = [dep.id for dep in task.dependencies]
            node_data = {
                "id": task.id,
                "name": task.name,
                "description": task.description,
                "status": task.status.value if task.status else None,
                "department": task.department,
                "owner": {"id": task.owner.id, "name": task.owner.name} if task.owner else None,
                "assignee": {"id": task.assignee.id, "name": task.assignee.name} if task.assignee else None,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "priority": task.priority,
                "position_x": task.position_x,
                "position_y": task.position_y,
                "dependency_ids": dependency_ids
            }
            nodes.append(node_data)
        
        # Compute edges from dependencies
        edges = []
        for task in tasks:
            for dep in task.dependencies:
                edges.append({
                    "id": f"{dep.id}-{task.id}",
                    "source": dep.id,
                    "target": task.id
                })
        
        return {"nodes": nodes, "edges": edges}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{task_id}/position")
async def update_task_position(
    task_id: int,
    position: PositionUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update the visual position of a task in the workflow builder."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.position_x = position.position_x
    task.position_y = position.position_y
    
    db.commit()
    return {"success": True, "message": "Position updated"}


@router.put("/{task_id}/dependencies")
async def update_task_dependencies(
    task_id: int,
    dependency_ids: List[int],
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update the dependencies for a task."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check for circular dependencies
    def has_circular_dependency(task_id: int, target_id: int, visited: set = None) -> bool:
        if visited is None:
            visited = set()
        if task_id == target_id:
            return True
        if task_id in visited:
            return False
        visited.add(task_id)
        
        task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
        if not task:
            return False
        
        for dep in task.dependencies:
            if has_circular_dependency(dep.id, target_id, visited):
                return True
        return False
    
    # Validate no circular dependencies
    for dep_id in dependency_ids:
        if has_circular_dependency(dep_id, task_id):
            raise HTTPException(
                status_code=400, 
                detail=f"Circular dependency detected: task {dep_id} creates a cycle"
            )
    
    # Log the change
    old_dependency_ids = sorted([dep.id for dep in task.dependencies])
    
    # Update dependencies
    task.dependencies = []
    for dep_id in dependency_ids:
        dep_task = db.query(TaskModel).filter(TaskModel.id == dep_id).first()
        if dep_task:
            task.dependencies.append(dep_task)
    
    # Log if dependencies changed
    new_dependency_ids = sorted(dependency_ids)
    if old_dependency_ids != new_dependency_ids:
        log_task_change(
            db,
            task,
            current_user,
            "dependencies_updated",
            str(old_dependency_ids),
            str(new_dependency_ids)
        )
    
    db.commit()
    return {"success": True, "message": "Dependencies updated", "dependency_ids": dependency_ids}
