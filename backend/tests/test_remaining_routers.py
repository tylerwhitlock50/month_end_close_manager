"""
Tests for Remaining API Endpoints

This file tests the remaining routers:
- Approvals
- Comments
- Notifications
- Reports
- Trial Balance
- Task Templates
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import (
    Task as TaskModel,
    Period as PeriodModel,
    User as UserModel,
    Approval as ApprovalModel,
    Comment as CommentModel,
    Notification as NotificationModel,
    TaskTemplate as TaskTemplateModel,
    TrialBalance as TrialBalanceModel,
    TrialBalanceAccount as TrialBalanceAccountModel,
    TaskStatus,
    CloseType
)


# ============================================================================
# APPROVALS TESTS
# ============================================================================

class TestApprovals:
    """Test suite for approval endpoints"""

    def test_get_task_approvals(self, client: TestClient, sample_task: TaskModel):
        """GET /api/approvals/task/{task_id} - Should return approvals for task"""
        response = client.get(f"/api/approvals/task/{sample_task.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_approval(self, client: TestClient, sample_task: TaskModel, sample_user: UserModel):
        """POST /api/approvals/ - Should create a new approval request"""
        approval_data = {
            "task_id": sample_task.id,
            "reviewer_id": sample_user.id,
            "notes": "Please review this task"
        }
        
        response = client.post("/api/approvals/", json=approval_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["task_id"] == sample_task.id
        assert data["reviewer_id"] == sample_user.id
        assert data["status"] == "pending"

    def test_update_approval(self, client: TestClient, db_session: Session, sample_task: TaskModel, sample_user: UserModel):
        """PUT /api/approvals/{approval_id} - Should update approval status"""
        # Create approval first
        approval = ApprovalModel(
            task_id=sample_task.id,
            reviewer_id=sample_user.id,
            status="pending"
        )
        db_session.add(approval)
        db_session.commit()
        db_session.refresh(approval)
        
        update_data = {
            "status": "approved",
            "notes": "Looks good"
        }
        
        response = client.put(f"/api/approvals/{approval.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"


# ============================================================================
# COMMENTS TESTS
# ============================================================================

class TestComments:
    """Test suite for comment endpoints"""

    def test_get_task_comments(self, client: TestClient, sample_task: TaskModel):
        """GET /api/comments/task/{task_id} - Should return comments for task"""
        response = client.get(f"/api/comments/task/{sample_task.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_comment(self, client: TestClient, sample_task: TaskModel):
        """POST /api/comments/ - Should create a new comment"""
        comment_data = {
            "task_id": sample_task.id,
            "content": "This is a test comment",
            "is_internal": False
        }
        
        response = client.post("/api/comments/", json=comment_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == comment_data["content"]
        assert data["task_id"] == sample_task.id

    def test_update_comment(self, client: TestClient, db_session: Session, sample_task: TaskModel):
        """PUT /api/comments/{comment_id} - Should update comment"""
        # Create comment first
        comment = CommentModel(
            task_id=sample_task.id,
            user_id=1,
            content="Original comment"
        )
        db_session.add(comment)
        db_session.commit()
        db_session.refresh(comment)
        
        update_data = {
            "content": "Updated comment"
        }
        
        response = client.put(f"/api/comments/{comment.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Updated comment"

    def test_delete_comment(self, client: TestClient, db_session: Session, sample_task: TaskModel):
        """DELETE /api/comments/{comment_id} - Should delete comment"""
        # Create comment first
        comment = CommentModel(
            task_id=sample_task.id,
            user_id=1,
            content="Comment to delete"
        )
        db_session.add(comment)
        db_session.commit()
        db_session.refresh(comment)
        
        response = client.delete(f"/api/comments/{comment.id}")
        
        assert response.status_code == 204


# ============================================================================
# NOTIFICATIONS TESTS
# ============================================================================

class TestNotifications:
    """Test suite for notification endpoints"""

    def test_get_my_notifications(self, client: TestClient):
        """GET /api/notifications/me - Should return user's notifications"""
        response = client.get("/api/notifications/me")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_mark_notification_read(self, client: TestClient, db_session: Session):
        """PUT /api/notifications/{notification_id}/read - Should mark as read"""
        # Create notification first
        notification = NotificationModel(
            user_id=1,
            title="Test Notification",
            message="Test message",
            notification_type="info",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)
        
        response = client.put(f"/api/notifications/{notification.id}/read")
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_read"] is True

    def test_mark_all_read(self, client: TestClient):
        """POST /api/notifications/mark-all-read - Should mark all as read"""
        response = client.post("/api/notifications/mark-all-read")
        
        assert response.status_code == 200


# ============================================================================
# TASK TEMPLATES TESTS
# ============================================================================

class TestTaskTemplates:
    """Test suite for task template endpoints"""

    def test_get_task_templates(self, client: TestClient):
        """GET /api/task-templates/ - Should return list of templates"""
        response = client.get("/api/task-templates/")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_task_template(self, client: TestClient, sample_user: UserModel):
        """POST /api/task-templates/ - Should create a new template"""
        template_data = {
            "name": "Monthly Reconciliation",
            "description": "Reconcile accounts",
            "close_type": "monthly",
            "department": "Accounting",
            "default_owner_id": sample_user.id,
            "days_offset": 5,
            "estimated_hours": 2.5,
            "sort_order": 1,
            "default_account_numbers": ["1000", "1010"]
        }
        
        response = client.post("/api/task-templates/", json=template_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == template_data["name"]
        assert data["close_type"] == template_data["close_type"]

    def test_get_task_template_by_id(self, client: TestClient, db_session: Session, sample_user: UserModel):
        """GET /api/task-templates/{template_id} - Should return specific template"""
        # Create template first
        template = TaskTemplateModel(
            name="Test Template",
            close_type=CloseType.MONTHLY,
            default_owner_id=sample_user.id
        )
        db_session.add(template)
        db_session.commit()
        db_session.refresh(template)
        
        response = client.get(f"/api/task-templates/{template.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Template"

    def test_update_task_template(self, client: TestClient, db_session: Session, sample_user: UserModel):
        """PUT /api/task-templates/{template_id} - Should update template"""
        # Create template first
        template = TaskTemplateModel(
            name="Original Template",
            close_type=CloseType.MONTHLY,
            default_owner_id=sample_user.id
        )
        db_session.add(template)
        db_session.commit()
        db_session.refresh(template)
        
        update_data = {
            "name": "Updated Template"
        }
        
        response = client.put(f"/api/task-templates/{template.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Template"

    def test_delete_task_template(self, client: TestClient, db_session: Session, sample_user: UserModel):
        """DELETE /api/task-templates/{template_id} - Should delete template"""
        # Create template first
        template = TaskTemplateModel(
            name="Template to Delete",
            close_type=CloseType.MONTHLY,
            default_owner_id=sample_user.id
        )
        db_session.add(template)
        db_session.commit()
        db_session.refresh(template)
        
        response = client.delete(f"/api/task-templates/{template.id}")
        
        assert response.status_code == 204


# ============================================================================
# REPORTS TESTS
# ============================================================================

class TestReports:
    """Test suite for report endpoints"""

    def test_get_task_report(self, client: TestClient):
        """GET /api/reports/tasks - Should return task report"""
        response = client.get("/api/reports/tasks")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_period_metrics(self, client: TestClient):
        """GET /api/reports/period-metrics - Should return period metrics"""
        response = client.get("/api/reports/period-metrics")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ============================================================================
# TRIAL BALANCE TESTS
# ============================================================================

class TestTrialBalance:
    """Test suite for trial balance endpoints"""

    def test_get_trial_balances(self, client: TestClient, sample_period: PeriodModel):
        """GET /api/trial-balance/period/{period_id} - Should return trial balances"""
        response = client.get(f"/api/trial-balance/period/{sample_period.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_trial_balance_not_found(self, client: TestClient):
        """Should return 404 for non-existent period"""
        response = client.get("/api/trial-balance/period/99999")
        
        assert response.status_code == 404

    def test_create_task_from_trial_balance_account(
        self,
        client: TestClient,
        db_session: Session,
        sample_period: PeriodModel,
        sample_user: UserModel,
    ):
        trial_balance = TrialBalanceModel(
            period_id=sample_period.id,
            name="January TB",
            source_filename="tb.csv",
            stored_filename="tb.csv",
            file_path="/tmp/tb.csv",
            uploaded_by_id=sample_user.id,
        )
        db_session.add(trial_balance)
        db_session.flush()

        account = TrialBalanceAccountModel(
            trial_balance_id=trial_balance.id,
            account_number="1000",
            account_name="Cash",
            ending_balance=Decimal("1250.00"),
        )
        db_session.add(account)
        db_session.commit()

        payload = {
            "name": "Reconcile Cash",
            "description": "Prepare monthly reconciliation",
            "owner_id": sample_user.id,
            "status": TaskStatus.IN_PROGRESS.value,
            "priority": 6,
            "save_as_template": True,
            "template_name": "Cash Reconciliation"
        }

        response = client.post(
            f"/api/trial-balance/accounts/{account.id}/tasks",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Reconcile Cash"
        assert data["owner"]["id"] == sample_user.id
        assert data["dependencies"] == []

        db_session.refresh(account)
        assert len(account.tasks) == 1
        assert account.tasks[0].template_id is not None
        assert account.tasks[0].department == "Accounting"
        assert account.tasks[0].estimated_hours == pytest.approx(0.25)

        template = db_session.query(TaskTemplateModel).filter(
            TaskTemplateModel.id == account.tasks[0].template_id
        ).first()
        assert template is not None
        assert template.department == "Accounting"
        assert template.estimated_hours == pytest.approx(0.25)
        assert template.default_account_numbers == ["1000"]
