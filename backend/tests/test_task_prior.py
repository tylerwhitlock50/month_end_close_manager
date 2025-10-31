from datetime import datetime, timedelta, timezone

from backend.models import (
    User,
    Period,
    Task,
    File,
    Comment,
    UserRole,
    TaskStatus,
    PeriodStatus,
    CloseType,
)


def seed_periods(session):
    user = User(
        id=900,
        email="seed@example.com",
        name="Seeder",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        is_active=True,
    )
    previous_period = Period(
        id=910,
        name="May 2025",
        month=5,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.CLOSED,
        is_active=False,
    )
    current_period = Period(
        id=911,
        name="June 2025",
        month=6,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )
    session.add_all([user, previous_period, current_period])
    session.commit()
    return user, previous_period, current_period


def seed_tasks_with_history(session):
    user, previous_period, current_period = seed_periods(session)

    prev_task = Task(
        id=920,
        period_id=previous_period.id,
        template_id=1000,
        name="Reconcile Cash",
        status=TaskStatus.COMPLETE,
        owner_id=user.id,
        due_date=datetime.now(timezone.utc) - timedelta(days=20),
    )
    current_task = Task(
        id=921,
        period_id=current_period.id,
        template_id=1000,
        name="Reconcile Cash",
        status=TaskStatus.IN_PROGRESS,
        owner_id=user.id,
    )
    session.add_all([prev_task, current_task])
    session.commit()

    file_record = File(
        id=930,
        period_id=previous_period.id,
        task_id=prev_task.id,
        filename="support.pdf",
        original_filename="support.pdf",
        file_path="/tmp/support.pdf",
        file_size=1024,
        mime_type="application/pdf",
        uploaded_at=datetime.now(timezone.utc) - timedelta(days=15),
        uploaded_by_id=user.id,
        is_external_link=False,
    )
    session.add(file_record)

    comment = Comment(
        id=940,
        task_id=prev_task.id,
        user_id=user.id,
        content="Prior period note",
    )
    session.add(comment)
    session.commit()

    return current_task.id, prev_task.id, previous_period.id


def test_prior_task_snapshot_returns_history(client, db_session):
    current_task_id, prev_task_id, previous_period_id = seed_tasks_with_history(db_session)

    response = client.get(f"/api/tasks/{current_task_id}/prior")
    assert response.status_code == 200

    payload = response.json()
    assert payload["task_id"] == prev_task_id
    assert payload["period_id"] == previous_period_id
    assert payload["files"]
    assert payload["comments"]
    assert payload["files"][0]["original_filename"] == "support.pdf"
    assert payload["comments"][0]["content"] == "Prior period note"


def test_prior_task_snapshot_not_found_when_missing(client, db_session):
    user, previous_period, current_period = seed_periods(db_session)

    current_task = Task(
        id=950,
        period_id=current_period.id,
        name="New Task",
        status=TaskStatus.NOT_STARTED,
        owner_id=user.id,
    )
    db_session.add(current_task)
    db_session.commit()

    response = client.get(f"/api/tasks/{current_task.id}/prior")
    assert response.status_code == 404
