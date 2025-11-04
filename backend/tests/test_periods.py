"""
Tests for Period Management Endpoints

Endpoint Testing:
- GET /api/periods/ - List all periods
- GET /api/periods/{period_id} - Get specific period
- GET /api/periods/{period_id}/progress - Get period progress stats
- GET /api/periods/{period_id}/detail - Get detailed period info
- POST /api/periods/ - Create new period
- PUT /api/periods/{period_id} - Update period
- PATCH /api/periods/{period_id}/activation - Set period activation
- DELETE /api/periods/{period_id} - Delete period
"""

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import Period as PeriodModel, Task as TaskModel, TaskStatus


class TestGetPeriods:
    """Test suite for GET /api/periods/"""

    def test_get_periods_success(self, client: TestClient, sample_period: PeriodModel):
        """Should return list of all periods"""
        response = client.get("/api/periods/")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Verify response structure
        period = data[0]
        assert "id" in period
        assert "name" in period
        assert "month" in period
        assert "year" in period
        assert "status" in period
        assert "close_type" in period

    def test_get_periods_filter_by_year(self, client: TestClient, sample_period: PeriodModel):
        """Should filter periods by year"""
        response = client.get("/api/periods/?year=2024")
        
        assert response.status_code == 200
        data = response.json()
        for period in data:
            assert period["year"] == 2024

    def test_get_periods_exclude_inactive(self, client: TestClient, sample_period: PeriodModel):
        """Should filter out inactive periods when requested"""
        response = client.get("/api/periods/?include_inactive=false")
        
        assert response.status_code == 200
        data = response.json()
        for period in data:
            assert period["is_active"] is True


class TestGetPeriodById:
    """Test suite for GET /api/periods/{period_id}"""

    def test_get_period_success(self, client: TestClient, sample_period: PeriodModel):
        """Should return specific period by ID"""
        response = client.get(f"/api/periods/{sample_period.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_period.id
        assert data["name"] == sample_period.name
        assert data["month"] == sample_period.month
        assert data["year"] == sample_period.year

    def test_get_period_not_found(self, client: TestClient):
        """Should return 404 for non-existent period"""
        response = client.get("/api/periods/99999")
        
        assert response.status_code == 404
        assert "Period not found" in response.json()["detail"]


class TestGetPeriodProgress:
    """Test suite for GET /api/periods/{period_id}/progress"""

    def test_get_period_progress_success(self, client: TestClient, sample_period: PeriodModel, sample_task: TaskModel):
        """Should return period progress statistics"""
        response = client.get(f"/api/periods/{sample_period.id}/progress")
        
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "stats" in data
        assert "tasks_by_status" in data
        assert "tasks_by_department" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_tasks" in stats
        assert "completed_tasks" in stats
        assert "in_progress_tasks" in stats
        assert "completion_percentage" in stats

    def test_get_period_progress_not_found(self, client: TestClient):
        """Should return 404 for non-existent period"""
        response = client.get("/api/periods/99999/progress")
        
        assert response.status_code == 404


class TestGetPeriodDetail:
    """Test suite for GET /api/periods/{period_id}/detail"""

    def test_get_period_detail_success(self, client: TestClient, sample_period: PeriodModel, sample_task: TaskModel):
        """Should return detailed period information"""
        response = client.get(f"/api/periods/{sample_period.id}/detail")
        
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "completion_percentage" in data
        assert "total_tasks" in data
        assert "status_counts" in data
        assert "tasks_by_status" in data
        assert "overdue_tasks" in data
        assert "upcoming_tasks" in data
        assert "department_breakdown" in data
        assert "period_files_count" in data
        assert "task_files_count" in data
        assert "trial_balance_files_count" in data


class TestGetPeriodSummary:
    """Test suite for GET /api/periods/{period_id}/summary"""

    def test_get_period_summary_success(
        self,
        client: TestClient,
        db_session: Session,
        sample_period: PeriodModel,
        sample_task: TaskModel,
    ):
        # Mark task as completed to exercise stats
        sample_task.status = TaskStatus.COMPLETE
        sample_task.due_date = datetime.now(timezone.utc) - timedelta(days=1)
        db_session.commit()

        response = client.get(f"/api/periods/{sample_period.id}/summary")

        assert response.status_code == 200
        data = response.json()
        assert data["period_id"] == sample_period.id
        assert data["period_name"] == sample_period.name
        assert data["status"] == sample_period.status.value
        assert "completion_percentage" in data
        assert data["total_tasks"] >= 1
        assert data["completed_tasks"] >= 1
        assert data["overdue_tasks"] >= 0

    def test_get_period_summary_not_found(self, client: TestClient):
        response = client.get("/api/periods/99999/summary")
        assert response.status_code == 404


class TestCreatePeriod:
    """Test suite for POST /api/periods/"""

    def test_create_period_success(self, client: TestClient):
        """Should successfully create a new period"""
        period_data = {
            "name": "February 2024",
            "month": 2,
            "year": 2024,
            "close_type": "monthly",
            "target_close_date": "2024-03-05",
            "is_active": True
        }
        
        response = client.post("/api/periods/", json=period_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == period_data["name"]
        assert data["month"] == period_data["month"]
        assert data["year"] == period_data["year"]
        assert "id" in data

    def test_create_period_duplicate(self, client: TestClient, sample_period: PeriodModel):
        """Should return 400 when creating duplicate period"""
        period_data = {
            "name": "Duplicate",
            "month": sample_period.month,
            "year": sample_period.year,
            "close_type": "monthly"
        }
        
        response = client.post("/api/periods/", json=period_data)
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_create_period_with_roll_forward(self, client: TestClient):
        """Should create period and roll forward tasks when requested"""
        period_data = {
            "name": "March 2024",
            "month": 3,
            "year": 2024,
            "close_type": "monthly"
        }
        
        response = client.post("/api/periods/?roll_forward_tasks=true", json=period_data)
        
        assert response.status_code == 201

    def test_create_period_invalid_month(self, client: TestClient):
        """Should return 422 for invalid month"""
        period_data = {
            "name": "Invalid Period",
            "month": 13,  # Invalid
            "year": 2024,
            "close_type": "monthly"
        }
        
        response = client.post("/api/periods/", json=period_data)
        
        assert response.status_code == 422


class TestUpdatePeriod:
    """Test suite for PUT /api/periods/{period_id}"""

    def test_update_period_success(self, client: TestClient, sample_period: PeriodModel):
        """Should successfully update period"""
        update_data = {
            "name": "Updated January 2024",
            "status": "under_review"
        }
        
        response = client.put(f"/api/periods/{sample_period.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated January 2024"

    def test_update_period_not_found(self, client: TestClient):
        """Should return 404 when updating non-existent period"""
        response = client.put("/api/periods/99999", json={"name": "Test"})
        
        assert response.status_code == 404


class TestSetPeriodActivation:
    """Test suite for PATCH /api/periods/{period_id}/activation"""

    def test_deactivate_period_success(self, client: TestClient, sample_period: PeriodModel):
        """Should successfully deactivate a period"""
        response = client.patch(
            f"/api/periods/{sample_period.id}/activation",
            json={"is_active": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    def test_activate_period_success(self, client: TestClient, sample_period: PeriodModel):
        """Should successfully activate a period"""
        response = client.patch(
            f"/api/periods/{sample_period.id}/activation",
            json={"is_active": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True


class TestDeletePeriod:
    """Test suite for DELETE /api/periods/{period_id}"""

    def test_delete_period_success(self, client: TestClient, sample_period: PeriodModel):
        """Should successfully delete a period"""
        response = client.delete(f"/api/periods/{sample_period.id}")
        
        assert response.status_code == 204

    def test_delete_period_not_found(self, client: TestClient):
        """Should return 404 when deleting non-existent period"""
        response = client.delete("/api/periods/99999")
        
        assert response.status_code == 404

