"""
Tests for Dashboard Endpoints

Endpoint Testing:
- GET /api/dashboard/stats - Get dashboard statistics
- GET /api/dashboard/my-reviews - Get items awaiting review
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import Task as TaskModel, Period as PeriodModel


class TestGetDashboardStats:
    """Test suite for GET /api/dashboard/stats"""

    def test_get_stats_success(self, client: TestClient, sample_task: TaskModel):
        """Should return dashboard statistics"""
        response = client.get("/api/dashboard/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "total_tasks" in data
        assert "completed_tasks" in data
        assert "in_progress_tasks" in data
        assert "overdue_tasks" in data
        assert "tasks_due_today" in data
        assert "completion_percentage" in data
        assert "blocked_tasks" in data
        assert "review_tasks" in data
        assert "at_risk_tasks" in data
        assert "critical_path_tasks" in data
        
        # Verify types
        assert isinstance(data["total_tasks"], int)
        assert isinstance(data["completion_percentage"], (int, float))
        assert isinstance(data["blocked_tasks"], list)
        assert isinstance(data["critical_path_tasks"], list)

    def test_get_stats_with_period_filter(self, client: TestClient, sample_period: PeriodModel):
        """Should filter stats by period_id"""
        response = client.get(f"/api/dashboard/stats?period_id={sample_period.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert "total_tasks" in data

    def test_get_stats_empty(self, client: TestClient):
        """Should handle empty state gracefully"""
        response = client.get("/api/dashboard/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_tasks"] >= 0


class TestGetMyReviews:
    """Test suite for GET /api/dashboard/my-reviews"""

    def test_get_my_reviews_success(self, client: TestClient):
        """Should return review items for current user"""
        response = client.get("/api/dashboard/my-reviews")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "review_tasks" in data
        assert "pending_approvals" in data
        assert "total_pending" in data
        assert "overdue_count" in data
        
        # Verify types
        assert isinstance(data["review_tasks"], list)
        assert isinstance(data["pending_approvals"], list)
        assert isinstance(data["total_pending"], int)
        assert isinstance(data["overdue_count"], int)

    def test_get_my_reviews_with_period_filter(self, client: TestClient, sample_period: PeriodModel):
        """Should filter reviews by period_id"""
        response = client.get(f"/api/dashboard/my-reviews?period_id={sample_period.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert "review_tasks" in data

    def test_get_my_reviews_empty(self, client: TestClient):
        """Should handle empty review queue"""
        response = client.get("/api/dashboard/my-reviews")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_pending"] >= 0

