"""
Tests for Task Management Endpoints

Endpoint Testing:
- GET /api/tasks/ - List tasks with filters
- GET /api/tasks/my-tasks - Get current user's tasks
- GET /api/tasks/review-queue - Get tasks in review
- GET /api/tasks/{task_id} - Get specific task
- GET /api/tasks/{task_id}/audit-logs - Get task audit logs
- GET /api/tasks/{task_id}/activity - Get task activity feed
- POST /api/tasks/ - Create new task
- POST /api/tasks/bulk-update - Bulk update tasks
- PUT /api/tasks/{task_id} - Update task
- DELETE /api/tasks/{task_id} - Delete task
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import Task as TaskModel, Period as PeriodModel, User as UserModel


class TestGetTasks:
    """Test suite for GET /api/tasks/"""

    def test_get_tasks_success(self, client: TestClient, sample_task: TaskModel):
        """Should return list of tasks"""
        response = client.get("/api/tasks/")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Verify response structure
        task = data[0]
        assert "id" in task
        assert "name" in task
        assert "status" in task
        assert "owner" in task
        assert "period" in task
        assert "file_count" in task
        assert "pending_approvals" in task

    def test_get_tasks_filter_by_period(self, client: TestClient, sample_task: TaskModel, sample_period: PeriodModel):
        """Should filter tasks by period_id"""
        response = client.get(f"/api/tasks/?period_id={sample_period.id}")
        
        assert response.status_code == 200
        data = response.json()
        for task in data:
            assert task["period_id"] == sample_period.id

    def test_get_tasks_filter_by_status(self, client: TestClient, sample_task: TaskModel):
        """Should filter tasks by status"""
        response = client.get("/api/tasks/?status=not_started")
        
        assert response.status_code == 200
        data = response.json()
        for task in data:
            assert task["status"] == "not_started"

    def test_get_tasks_filter_mine(self, client: TestClient, sample_task: TaskModel):
        """Should filter to current user's tasks"""
        response = client.get("/api/tasks/?mine=true")
        
        assert response.status_code == 200
        data = response.json()
        # All tasks should belong to current user as owner or assignee
        assert isinstance(data, list)

    def test_get_tasks_pagination(self, client: TestClient, sample_task: TaskModel):
        """Should support pagination with skip and limit"""
        response = client.get("/api/tasks/?skip=0&limit=10")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 10


class TestGetMyTasks:
    """Test suite for GET /api/tasks/my-tasks"""

    def test_get_my_tasks_success(self, client: TestClient, sample_task: TaskModel):
        """Should return tasks owned by or assigned to current user"""
        response = client.get("/api/tasks/my-tasks")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestGetReviewQueue:
    """Test suite for GET /api/tasks/review-queue"""

    def test_get_review_queue_success(self, client: TestClient, db_session: Session, sample_task: TaskModel):
        """Should return tasks in review status"""
        # Update task to review status
        sample_task.status = "review"
        db_session.commit()
        
        response = client.get("/api/tasks/review-queue")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestGetTaskById:
    """Test suite for GET /api/tasks/{task_id}"""

    def test_get_task_success(self, client: TestClient, sample_task: TaskModel):
        """Should return specific task by ID"""
        response = client.get(f"/api/tasks/{sample_task.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_task.id
        assert data["name"] == sample_task.name
        assert "owner" in data
        assert "period" in data

    def test_get_task_not_found(self, client: TestClient):
        """Should return 404 for non-existent task"""
        response = client.get("/api/tasks/99999")
        
        assert response.status_code == 404
        assert "Task not found" in response.json()["detail"]


class TestGetTaskAuditLogs:
    """Test suite for GET /api/tasks/{task_id}/audit-logs"""

    def test_get_audit_logs_success(self, client: TestClient, sample_task: TaskModel):
        """Should return audit logs for task"""
        response = client.get(f"/api/tasks/{sample_task.id}/audit-logs")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_audit_logs_not_found(self, client: TestClient):
        """Should return 404 for non-existent task"""
        response = client.get("/api/tasks/99999/audit-logs")
        
        assert response.status_code == 404


class TestGetTaskActivity:
    """Test suite for GET /api/tasks/{task_id}/activity"""

    def test_get_task_activity_success(self, client: TestClient, sample_task: TaskModel):
        """Should return activity feed for task"""
        response = client.get(f"/api/tasks/{sample_task.id}/activity")
        
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert "events" in data
        assert isinstance(data["events"], list)

    def test_get_task_activity_with_pagination(self, client: TestClient, sample_task: TaskModel):
        """Should support pagination parameters"""
        response = client.get(f"/api/tasks/{sample_task.id}/activity?limit=5&offset=0")
        
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 5
        assert data["offset"] == 0


class TestCreateTask:
    """Test suite for POST /api/tasks/"""

    def test_create_task_success(self, client: TestClient, sample_period: PeriodModel, sample_user: UserModel):
        """Should successfully create a new task"""
        task_data = {
            "name": "New Task",
            "description": "Task description",
            "period_id": sample_period.id,
            "owner_id": sample_user.id,
            "department": "Finance",
            "priority": 7
        }
        
        response = client.post("/api/tasks/", json=task_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == task_data["name"]
        assert data["description"] == task_data["description"]
        assert data["period_id"] == task_data["period_id"]
        assert "id" in data

    def test_create_task_with_dependencies(self, client: TestClient, sample_period: PeriodModel, sample_user: UserModel, sample_task: TaskModel):
        """Should create task with dependencies"""
        task_data = {
            "name": "Dependent Task",
            "period_id": sample_period.id,
            "owner_id": sample_user.id,
            "dependency_ids": [sample_task.id]
        }
        
        response = client.post("/api/tasks/", json=task_data)
        
        assert response.status_code == 201

    def test_create_task_invalid_period(self, client: TestClient, sample_user: UserModel):
        """Should return 404 for non-existent period"""
        task_data = {
            "name": "Task",
            "period_id": 99999,
            "owner_id": sample_user.id
        }
        
        response = client.post("/api/tasks/", json=task_data)
        
        assert response.status_code == 404

    def test_create_task_missing_required_fields(self, client: TestClient):
        """Should return 422 when required fields are missing"""
        task_data = {
            "name": "Incomplete Task"
            # Missing period_id and owner_id
        }
        
        response = client.post("/api/tasks/", json=task_data)
        
        assert response.status_code == 422


class TestBulkUpdateTasks:
    """Test suite for POST /api/tasks/bulk-update"""

    def test_bulk_update_status_success(self, client: TestClient, sample_task: TaskModel):
        """Should successfully update multiple tasks"""
        update_data = {
            "task_ids": [sample_task.id],
            "status": "in_progress"
        }
        
        response = client.post("/api/tasks/bulk-update", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] == 1

    def test_bulk_update_assignee(self, client: TestClient, sample_task: TaskModel, sample_user: UserModel):
        """Should update assignee for multiple tasks"""
        update_data = {
            "task_ids": [sample_task.id],
            "assignee_id": sample_user.id
        }
        
        response = client.post("/api/tasks/bulk-update", json=update_data)
        
        assert response.status_code == 200

    def test_bulk_update_no_task_ids(self, client: TestClient):
        """Should return 400 when no task IDs provided"""
        update_data = {
            "task_ids": [],
            "status": "in_progress"
        }
        
        response = client.post("/api/tasks/bulk-update", json=update_data)
        
        assert response.status_code == 400


class TestUpdateTask:
    """Test suite for PUT /api/tasks/{task_id}"""

    def test_update_task_success(self, client: TestClient, sample_task: TaskModel):
        """Should successfully update task"""
        update_data = {
            "name": "Updated Task Name",
            "status": "in_progress",
            "priority": 9
        }
        
        response = client.put(f"/api/tasks/{sample_task.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Task Name"
        assert data["status"] == "in_progress"
        assert data["priority"] == 9

    def test_update_task_partial(self, client: TestClient, sample_task: TaskModel):
        """Should support partial updates"""
        update_data = {
            "status": "complete"
        }
        
        response = client.put(f"/api/tasks/{sample_task.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "complete"

    def test_update_task_not_found(self, client: TestClient):
        """Should return 404 when updating non-existent task"""
        response = client.put("/api/tasks/99999", json={"name": "Test"})
        
        assert response.status_code == 404


class TestDeleteTask:
    """Test suite for DELETE /api/tasks/{task_id}"""

    def test_delete_task_success(self, client: TestClient, sample_task: TaskModel):
        """Should successfully delete a task"""
        response = client.delete(f"/api/tasks/{sample_task.id}")
        
        assert response.status_code == 204

    def test_delete_task_not_found(self, client: TestClient):
        """Should return 404 when deleting non-existent task"""
        response = client.delete("/api/tasks/99999")
        
        assert response.status_code == 404

