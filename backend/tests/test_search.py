from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import (
    Task as TaskModel,
    TaskStatus,
    Period as PeriodModel,
    CloseType,
    PeriodStatus,
    TaskTemplate as TaskTemplateModel,
    TrialBalance as TrialBalanceModel,
    TrialBalanceAccount as TrialBalanceAccountModel,
)


def seed_data(db_session: Session):
    period = PeriodModel(
        id=99,
        name="March 2025",
        month=3,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )
    db_session.add(period)
    db_session.flush()

    task = TaskModel(
        period_id=period.id,
        name="Cash Reconciliation",
        description="Match bank statements",
        status=TaskStatus.IN_PROGRESS,
        owner_id=1,
        assignee_id=1,
        due_date=None,
        department="Accounting",
    )
    db_session.add(task)

    template = TaskTemplateModel(
        name="Cash Account Review",
        description="Monthly review",
        close_type=CloseType.MONTHLY,
        department="Accounting",
        sort_order=1,
        is_active=True,
    )
    db_session.add(template)

    tb = TrialBalanceModel(
        period_id=period.id,
        name="March TB",
        source_filename="tb.csv",
        stored_filename="tb.csv",
        file_path="/tmp/tb.csv",
    )
    db_session.add(tb)
    db_session.flush()

    account = TrialBalanceAccountModel(
        trial_balance_id=tb.id,
        account_number="1000",
        account_name="Cash and Cash Equivalents",
        ending_balance=Decimal("1250.00"),
    )
    db_session.add(account)
    db_session.commit()

    return task, template, account


def test_search_returns_matches(client: TestClient, db_session: Session):
    task, template, account = seed_data(db_session)

    response = client.get("/api/search", params={"query": "cash"})

    assert response.status_code == 200
    payload = response.json()

    assert any(item["id"] == task.id for item in payload["tasks"])
    assert any(item["id"] == template.id for item in payload["templates"])
    assert any(item["id"] == account.id for item in payload["accounts"])
    assert any(page["url"] == "/dashboard" for page in payload["pages"])


def test_search_requires_min_length(client: TestClient):
    response = client.get("/api/search", params={"query": "a"})
    assert response.status_code == 422
