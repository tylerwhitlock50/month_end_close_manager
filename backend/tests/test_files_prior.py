from datetime import datetime

from backend.models import (
    User,
    Period,
    Task,
    File,
    TrialBalance,
    TrialBalanceAccount,
    TrialBalanceAttachment,
    UserRole,
    TaskStatus,
    PeriodStatus,
    CloseType,
)


def seed_periods_with_files(session):
    user = User(
        id=100,
        email="files@example.com",
        name="Files User",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        is_active=True,
    )
    prev_period = Period(
        id=200,
        name="March 2025",
        month=3,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.CLOSED,
        is_active=False,
    )
    current_period = Period(
        id=201,
        name="April 2025",
        month=4,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )
    session.add_all([user, prev_period, current_period])
    session.commit()

    task = Task(
        id=300,
        period_id=prev_period.id,
        name="Reconcile cash",
        status=TaskStatus.COMPLETE,
        owner_id=user.id,
    )
    session.add(task)
    session.commit()

    period_file = File(
        id=400,
        period_id=prev_period.id,
        task_id=None,
        filename="period.txt",
        original_filename="period.txt",
        file_path="/tmp/period.txt",
        file_size=100,
        mime_type="text/plain",
        uploaded_at=datetime.utcnow(),
        uploaded_by_id=user.id,
        is_external_link=False,
    )

    task_file = File(
        id=401,
        period_id=prev_period.id,
        task_id=task.id,
        filename="task.txt",
        original_filename="task.txt",
        file_path="/tmp/task.txt",
        file_size=120,
        mime_type="text/plain",
        uploaded_at=datetime.utcnow(),
        uploaded_by_id=user.id,
        is_external_link=False,
    )

    session.add_all([period_file, task_file])
    session.commit()

    tb = TrialBalance(
        id=500,
        period_id=prev_period.id,
        name="TB",
        source_filename="tb.csv",
        stored_filename="tb.csv",
        file_path="/tmp/tb.csv",
        uploaded_by_id=user.id,
    )
    session.add(tb)
    session.flush()

    account = TrialBalanceAccount(
        id=501,
        trial_balance_id=tb.id,
        account_number="100",
        account_name="Cash",
    )
    session.add(account)
    session.flush()

    attachment = TrialBalanceAttachment(
        id=502,
        account_id=account.id,
        filename="support.pdf",
        original_filename="support.pdf",
        file_path="/tmp/support.pdf",
        file_size=200,
        mime_type="application/pdf",
        uploaded_at=datetime.utcnow(),
    )
    session.add(attachment)
    session.commit()

    return current_period.id


def test_prior_period_files_endpoint(client, db_session):
    current_period_id = seed_periods_with_files(db_session)

    response = client.get(f"/api/files/period/{current_period_id}/prior")
    assert response.status_code == 200
    payload = response.json()

    assert payload["period"]["name"] == "March 2025"
    assert len(payload["period_files"]) == 1
    assert len(payload["task_files"]) == 1
    assert len(payload["trial_balance_files"]) == 1


def test_prior_period_files_404_when_missing(client, db_session):
    current_period = Period(
        id=3000,
        name="July 2025",
        month=7,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )
    user = User(
        id=3001,
        email="user@example.com",
        name="User",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add_all([user, current_period])
    db_session.commit()

    response = client.get(f"/api/files/period/{current_period.id}/prior")
    assert response.status_code == 404
