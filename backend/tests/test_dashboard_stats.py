from datetime import datetime, timedelta, timezone

from backend.models import (
    User,
    Period,
    Task,
    TaskStatus,
    PeriodStatus,
    CloseType,
    UserRole,
)


def seed_period_with_dependencies(session):
    user = User(
        id=1,
        email="controller@example.com",
        name="Controller",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        is_active=True,
    )

    period = Period(
        id=1,
        name="November 2025",
        month=11,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )

    blocker = Task(
        id=1,
        period_id=period.id,
        name="Close cash ledger",
        status=TaskStatus.IN_PROGRESS,
        owner_id=user.id,
        due_date=datetime.now(timezone.utc) + timedelta(days=1),
    )

    dependent_one = Task(
        id=2,
        period_id=period.id,
        name="Prepare bank reconciliation",
        status=TaskStatus.IN_PROGRESS,
        owner_id=user.id,
        due_date=datetime.now(timezone.utc) + timedelta(days=2),
    )
    dependent_one.dependencies.append(blocker)

    dependent_two = Task(
        id=3,
        period_id=period.id,
        name="Review outstanding checks",
        status=TaskStatus.NOT_STARTED,
        owner_id=user.id,
        due_date=datetime.now(timezone.utc) + timedelta(days=3),
    )
    dependent_two.dependencies.append(blocker)

    completed_dependent = Task(
        id=4,
        period_id=period.id,
        name="Archive prior month close",
        status=TaskStatus.COMPLETE,
        owner_id=user.id,
        due_date=datetime.now(timezone.utc) - timedelta(days=10),
    )
    completed_dependent.dependencies.append(blocker)

    session.add_all([user, period, blocker, dependent_one, dependent_two, completed_dependent])
    session.commit()


def test_dashboard_stats_includes_critical_path(client, db_session):
    seed_period_with_dependencies(db_session)

    response = client.get('/api/dashboard/stats')
    assert response.status_code == 200

    payload = response.json()
    critical = payload['critical_path_tasks']
    assert len(critical) == 1

    primary = critical[0]
    assert primary['name'] == 'Close cash ledger'
    assert primary['blocked_dependents'] == 2

    dependent_names = {dep['name'] for dep in primary['dependents']}
    assert dependent_names == {'Prepare bank reconciliation', 'Review outstanding checks'}
