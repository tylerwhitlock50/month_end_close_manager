from datetime import datetime, timedelta, timezone

from backend.models import (
    User,
    Period,
    Task,
    Approval,
    TaskStatus,
    PeriodStatus,
    CloseType,
    ApprovalStatus,
    UserRole,
)


def seed_review_data(session):
    now = datetime.now(timezone.utc)

    reviewer = User(
        id=1,
        email="reviewer@example.com",
        name="Lead Reviewer",
        hashed_password="hashed",
        role=UserRole.REVIEWER,
        is_active=True,
        department="Accounting",
    )

    owner = User(
        id=2,
        email="owner@example.com",
        name="Task Owner",
        hashed_password="hashed",
        role=UserRole.PREPARER,
        is_active=True,
        department="Accounting",
    )

    period = Period(
        id=1,
        name="December 2025",
        month=12,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )

    task_overdue = Task(
        id=1,
        period_id=period.id,
        name="Reconcile AR",
        status=TaskStatus.REVIEW,
        owner_id=owner.id,
        assignee_id=reviewer.id,
        due_date=now - timedelta(days=1),
        department="Accounting",
    )

    task_upcoming = Task(
        id=2,
        period_id=period.id,
        name="Review cash forecast",
        status=TaskStatus.REVIEW,
        owner_id=owner.id,
        assignee_id=reviewer.id,
        due_date=now + timedelta(days=2),
        department="FP&A",
    )

    approval_pending = Approval(
        id=1,
        task_id=task_upcoming.id,
        reviewer_id=reviewer.id,
        status=ApprovalStatus.PENDING,
        requested_at=now - timedelta(hours=6),
        notes="Please confirm attachments",
    )

    session.add_all([reviewer, owner, period, task_overdue, task_upcoming, approval_pending])
    session.commit()


def test_my_reviews_returns_tasks_and_approvals(client, db_session):
    seed_review_data(db_session)

    response = client.get('/api/dashboard/my-reviews')
    assert response.status_code == 200

    payload = response.json()
    assert payload['total_pending'] == 3
    assert payload['overdue_count'] == 1

    task_names = {task['name'] for task in payload['review_tasks']}
    assert task_names == {'Reconcile AR', 'Review cash forecast'}

    approvals = payload['pending_approvals']
    assert len(approvals) == 1
    assert approvals[0]['task_name'] == 'Review cash forecast'


def test_my_reviews_handles_inactive_periods(client, db_session):
    seed_review_data(db_session)

    # Deactivate the period to simulate a closed cycle
    db_session.query(Period).update({Period.status: PeriodStatus.CLOSED, Period.is_active: False})
    db_session.commit()

    response = client.get('/api/dashboard/my-reviews')
    assert response.status_code == 200
    payload = response.json()
    assert payload['total_pending'] == 0
    assert payload['review_tasks'] == []
    assert payload['pending_approvals'] == []
