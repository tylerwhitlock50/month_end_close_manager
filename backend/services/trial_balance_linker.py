from __future__ import annotations

from typing import Iterable, Optional, Sequence

from sqlalchemy.orm import Session, selectinload

from backend.models import (
    Task as TaskModel,
    TaskTemplate as TaskTemplateModel,
    TrialBalance as TrialBalanceModel,
    TrialBalanceAccount as TrialBalanceAccountModel,
)


def _normalize(value: Optional[str]) -> str:
    return (value or "").strip()


def _normalize_lower(value: Optional[str]) -> str:
    return _normalize(value).lower()


def _matches_account(candidate: str, account: TrialBalanceAccountModel) -> bool:
    candidate_clean = candidate.strip()
    if not candidate_clean:
        return False

    candidate_lower = candidate_clean.lower()
    account_number_lower = _normalize_lower(account.account_number)
    account_name_lower = _normalize_lower(account.account_name)

    if candidate_lower.endswith("*"):
        prefix = candidate_lower[:-1]
        if prefix and account_number_lower.startswith(prefix):
            return True

    if candidate_lower == account_number_lower:
        return True

    if candidate_lower and candidate_lower in account_name_lower:
        return True

    return False


def auto_link_tasks_to_trial_balance_accounts(
    db: Session,
    *,
    period_id: int,
    trial_balance_id: Optional[int] = None,
    accounts: Optional[Sequence[TrialBalanceAccountModel]] = None,
    task_ids: Optional[Sequence[int]] = None,
) -> dict[int, list[int]]:
    """Attach tasks to trial balance accounts using template defaults.

    Returns a mapping of account_id -> list of task_ids that were linked.
    """
    trial_balance = None
    if trial_balance_id is not None:
        trial_balance = db.query(TrialBalanceModel).filter(TrialBalanceModel.id == trial_balance_id).first()
    else:
        trial_balance = (
            db.query(TrialBalanceModel)
            .filter(TrialBalanceModel.period_id == period_id)
            .order_by(TrialBalanceModel.uploaded_at.desc())
            .first()
        )

    if not trial_balance:
        return {}

    if accounts is None:
        accounts = (
            db.query(TrialBalanceAccountModel)
            .options(selectinload(TrialBalanceAccountModel.tasks))
            .filter(TrialBalanceAccountModel.trial_balance_id == trial_balance.id)
            .all()
        )

    if not accounts:
        return {}

    account_list = list(accounts)

    task_query = db.query(TaskModel).options(selectinload(TaskModel.template))
    task_query = task_query.filter(TaskModel.period_id == period_id)

    if task_ids:
        task_query = task_query.filter(TaskModel.id.in_(task_ids))

    tasks = task_query.all()
    if not tasks:
        return {}

    linked: dict[int, list[int]] = {}

    for task in tasks:
        template: Optional[TaskTemplateModel] = task.template
        candidates: Iterable[str] = template.default_account_numbers if template and template.default_account_numbers else []

        for candidate in candidates:
            candidate_lower = candidate.strip().lower()
            if not candidate_lower:
                continue

            for account_model in account_list:
                if _matches_account(candidate_lower, account_model):
                    if task not in account_model.tasks:
                        account_model.tasks.append(task)
                        linked.setdefault(account_model.id, []).append(task.id)

    if linked:
        db.flush()

    return linked
