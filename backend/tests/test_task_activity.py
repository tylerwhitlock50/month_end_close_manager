from datetime import datetime, timedelta, timezone

from backend.models import (
    User,
    Period,
    Task,
    Comment,
    AuditLog,
    TaskStatus,
    PeriodStatus,
    CloseType,
    UserRole,
)


def _utc_now():
    return datetime.now(timezone.utc)


def seed_task_with_activity(session):
    user = User(
        id=1,
        email="tester@example.com",
        name="Test Reviewer",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        is_active=True,
    )
    reviewer = User(
        id=2,
        email="approver@example.com",
        name="Approver",
        hashed_password="hashed",
        role=UserRole.REVIEWER,
        is_active=True,
    )

    period = Period(
        id=1,
        name="October 2025",
        month=10,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )

    task = Task(
        id=1,
        period_id=period.id,
        name="Reconcile cash",
        status=TaskStatus.IN_PROGRESS,
        owner_id=user.id,
    )

    base_time = _utc_now() - timedelta(hours=1)

    comment_latest = Comment(
        id=1,
        task_id=task.id,
        user_id=user.id,
        content="Reviewed the bank rec.",
        is_internal=False,
        created_at=base_time + timedelta(minutes=30),
    )

    comment_oldest = Comment(
        id=2,
        task_id=task.id,
        user_id=reviewer.id,
        content="Initial support uploaded.",
        is_internal=True,
        created_at=base_time,
    )

    audit_middle = AuditLog(
        id=1,
        task_id=task.id,
        user_id=reviewer.id,
        action="status_changed",
        entity_type="task",
        entity_id=task.id,
        old_value="TaskStatus.NOT_STARTED",
        new_value="TaskStatus.IN_PROGRESS",
        created_at=base_time + timedelta(minutes=10),
    )

    session.add_all([user, reviewer, period, task, comment_latest, comment_oldest, audit_middle])
    session.commit()

    return task.id


def test_task_activity_paginates_and_orders(client, db_session):
    task_id = seed_task_with_activity(db_session)

    response = client.get(f"/api/tasks/{task_id}/activity", params={"limit": 2, "offset": 0})
    assert response.status_code == 200

    payload = response.json()
    assert payload["total"] == 3
    assert payload["limit"] == 2
    assert payload["offset"] == 0
    assert len(payload["events"]) == 2

    # Events should be sorted newest first
    ids_in_order = [event["id"] for event in payload["events"]]
    assert ids_in_order[0].startswith("comment-1")
    assert ids_in_order[1].startswith("audit-1")

    # Second page returns remaining record
    response_page_two = client.get(
        f"/api/tasks/{task_id}/activity", params={"limit": 2, "offset": 2}
    )
    assert response_page_two.status_code == 200
    payload_two = response_page_two.json()
    assert payload_two["total"] == 3
    assert len(payload_two["events"]) == 1
    assert payload_two["events"][0]["id"].startswith("comment-2")


def test_task_activity_clamps_limits(client, db_session):
    task_id = seed_task_with_activity(db_session)
    response = client.get(f"/api/tasks/{task_id}/activity", params={"limit": 250})
    assert response.status_code == 422
