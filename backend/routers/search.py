from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    Task as TaskModel,
    TaskTemplate as TaskTemplateModel,
    TrialBalanceAccount as TrialBalanceAccountModel,
    TrialBalance as TrialBalanceModel,
    Period as PeriodModel,
    User as UserModel,
    UserRole,
)
from backend.schemas import SearchResults, SearchResultItem


router = APIRouter(prefix="/api/search", tags=["search"])


STATIC_PAGES = [
    {
        "title": "Dashboard",
        "subtitle": "Close overview and KPIs",
        "url": "/dashboard",
        "keywords": ["overview", "home", "metrics"],
    },
    {
        "title": "Tasks",
        "subtitle": "Manage and update close tasks",
        "url": "/tasks",
        "keywords": ["task", "close", "work"],
    },
    {
        "title": "Trial Balance",
        "subtitle": "Upload and reconcile trial balance",
        "url": "/trial-balance",
        "keywords": ["tb", "accounts", "reconcile"],
    },
    {
        "title": "Workflow Builder",
        "subtitle": "Design dependencies and flow",
        "url": "/workflow",
        "keywords": ["dependency", "builder", "flow"],
    },
    {
        "title": "Reports",
        "subtitle": "Export close metrics and workload",
        "url": "/reports",
        "keywords": ["report", "analytics", "download"],
    },
]


def _task_query_for_user(db: Session, current_user: UserModel):
    """Return a task query filtered by user permissions."""

    query = db.query(TaskModel)
    if current_user.role not in {UserRole.ADMIN, UserRole.REVIEWER}:
        query = query.filter(
            or_(
                TaskModel.owner_id == current_user.id,
                TaskModel.assignee_id == current_user.id,
            )
        )
    return query


@router.get("/", response_model=SearchResults)
async def universal_search(
    q: str = Query(..., min_length=2, max_length=100, alias="query"),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> SearchResults:
    search_term = f"%{q.strip()}%"

    # Tasks
    task_items: List[SearchResultItem] = []
    task_query = (
        _task_query_for_user(db, current_user)
        .options(selectinload(TaskModel.period))
        .filter(TaskModel.name.ilike(search_term))
        .order_by(TaskModel.updated_at.desc().nullslast(), TaskModel.id.desc())
        .limit(limit)
        .all()
    )
    for task in task_query:
        parts: List[str] = []
        if task.period:
            parts.append(task.period.name)
        if task.due_date:
            parts.append(task.due_date.strftime("%b %d"))
        parts.append(task.status.replace("_", " ").title())
        task_items.append(
            SearchResultItem(
                id=task.id,
                title=task.name,
                subtitle=" • ".join(parts),
                url=f"/tasks?highlight={task.id}",
                type="task",
            )
        )

    # Templates
    template_items: List[SearchResultItem] = []
    template_query = (
        db.query(TaskTemplateModel)
        .filter(TaskTemplateModel.name.ilike(search_term))
        .order_by(TaskTemplateModel.updated_at.desc().nullslast(), TaskTemplateModel.id.desc())
        .limit(limit)
        .all()
    )
    for template in template_query:
        parts: List[str] = [template.close_type.value.replace("_", " ").title()]
        if template.department:
            parts.append(template.department)
        template_items.append(
            SearchResultItem(
                id=template.id,
                title=template.name,
                subtitle=" • ".join(parts),
                url=f"/templates?templateId={template.id}",
                type="template",
            )
        )

    # Trial balance accounts
    account_items: List[SearchResultItem] = []
    accounts_query = (
        db.query(TrialBalanceAccountModel, TrialBalanceModel, PeriodModel)
        .join(TrialBalanceModel, TrialBalanceAccountModel.trial_balance_id == TrialBalanceModel.id)
        .join(PeriodModel, TrialBalanceModel.period_id == PeriodModel.id)
        .filter(
            or_(
                TrialBalanceAccountModel.account_name.ilike(search_term),
                TrialBalanceAccountModel.account_number.ilike(search_term),
            )
        )
        .order_by(func.lower(TrialBalanceAccountModel.account_number))
        .limit(limit)
        .all()
    )
    for account, trial_balance, period in accounts_query:
        subtitle_parts = [period.name, account.account_number]
        account_items.append(
            SearchResultItem(
                id=account.id,
                title=account.account_name,
                subtitle=" • ".join(subtitle_parts),
                url=f"/trial-balance?accountId={account.id}&periodId={period.id}",
                type="account",
            )
        )

    # Static pages (filter client-side keywords)
    q_lower = q.lower().strip()
    page_items: List[SearchResultItem] = []
    for page in STATIC_PAGES:
        haystack = " ".join([page["title"], page["subtitle"], *page["keywords"]]).lower()
        if q_lower in haystack:
            page_items.append(
                SearchResultItem(
                    id=None,
                    title=page["title"],
                    subtitle=page["subtitle"],
                    url=page["url"],
                    type="page",
                )
            )
        if len(page_items) >= limit:
            break

    return SearchResults(
        tasks=task_items,
        templates=template_items,
        accounts=account_items,
        pages=page_items,
    )
