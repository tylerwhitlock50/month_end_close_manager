"""
Tests for File Management Endpoints

Endpoint Testing:
- GET /api/files/task/{task_id} - Get files for task
- GET /api/files/{file_id} - Get file metadata
- GET /api/files/download/{file_id} - Download file
- GET /api/files/old-files/ - Get old files
- GET /api/files/period/{period_id}/all - Get all period files
- POST /api/files/upload - Upload file to task
- POST /api/files/link - Link external file
- POST /api/files/upload-period - Upload file to period
- DELETE /api/files/{file_id} - Delete file

Note: File upload tests require special handling for multipart form data
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import Task as TaskModel, Period as PeriodModel, File as FileModel


class TestGetTaskFiles:
    """Test suite for GET /api/files/task/{task_id}"""

    def test_get_task_files_success(self, client: TestClient, sample_task: TaskModel):
        """Should return files for a task"""
        response = client.get(f"/api/files/task/{sample_task.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_task_files_not_found(self, client: TestClient):
        """Should return 404 for non-existent task"""
        response = client.get("/api/files/task/99999")
        
        assert response.status_code == 404


class TestGetFile:
    """Test suite for GET /api/files/{file_id}"""

    def test_get_file_not_found(self, client: TestClient):
        """Should return 404 for non-existent file"""
        response = client.get("/api/files/99999")
        
        assert response.status_code == 404


class TestGetOldFiles:
    """Test suite for GET /api/files/old-files/"""

    def test_get_old_files_success(self, client: TestClient):
        """Should return old files based on threshold"""
        response = client.get("/api/files/old-files/?days_threshold=30")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_old_files_default_threshold(self, client: TestClient):
        """Should use default threshold when not specified"""
        response = client.get("/api/files/old-files/")
        
        assert response.status_code == 200


class TestGetPeriodFiles:
    """Test suite for GET /api/files/period/{period_id}/all"""

    def test_get_period_files_success(self, client: TestClient, sample_period: PeriodModel):
        """Should return all files for a period"""
        response = client.get(f"/api/files/period/{sample_period.id}/all")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert "period_files" in data
        assert "task_files" in data
        assert "trial_balance_files" in data
        
        assert isinstance(data["period_files"], list)
        assert isinstance(data["task_files"], list)
        assert isinstance(data["trial_balance_files"], list)

    def test_get_period_files_not_found(self, client: TestClient):
        """Should return 404 for non-existent period"""
        response = client.get("/api/files/period/99999/all")
        
        assert response.status_code == 404


class TestLinkExternalFile:
    """Test suite for POST /api/files/link"""

    def test_link_external_file_success(self, client: TestClient, sample_task: TaskModel):
        """Should successfully link an external file"""
        link_data = {
            "task_id": sample_task.id,
            "external_url": "https://example.com/document.pdf",
            "description": "External document"
        }
        
        response = client.post("/api/files/link", params=link_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["is_external_link"] is True
        assert data["external_url"] == link_data["external_url"]
        assert data["task_id"] == sample_task.id

    def test_link_external_file_invalid_task(self, client: TestClient):
        """Should return 404 for non-existent task"""
        link_data = {
            "task_id": 99999,
            "external_url": "https://example.com/document.pdf"
        }
        
        response = client.post("/api/files/link", params=link_data)
        
        assert response.status_code == 404


class TestDeleteFile:
    """Test suite for DELETE /api/files/{file_id}"""

    def test_delete_file_not_found(self, client: TestClient):
        """Should return 404 when deleting non-existent file"""
        response = client.delete("/api/files/99999")
        
        assert response.status_code == 404

