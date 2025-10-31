"""
Tests for User Management Endpoints

Endpoint Testing:
- GET /api/users/ - List all users
- GET /api/users/me - Get current user info
- GET /api/users/{user_id} - Get specific user
- PUT /api/users/{user_id} - Update user (admin only)
- DELETE /api/users/{user_id} - Delete user (admin only)
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import User as UserModel


class TestGetUsers:
    """Test suite for GET /api/users/"""

    def test_get_users_success(self, client: TestClient, sample_user: UserModel, sample_admin: UserModel):
        """Should return list of all users"""
        response = client.get("/api/users/")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # At least sample_user and sample_admin
        
        # Verify response structure
        user = data[0]
        assert "id" in user
        assert "email" in user
        assert "name" in user
        assert "role" in user
        assert "is_active" in user
        assert "created_at" in user

    def test_get_users_with_pagination(self, client: TestClient, sample_user: UserModel):
        """Should support skip and limit parameters"""
        response = client.get("/api/users/?skip=0&limit=1")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 1


class TestGetCurrentUser:
    """Test suite for GET /api/users/me"""

    def test_get_current_user_success(self, client: TestClient):
        """Should return current authenticated user's info"""
        response = client.get("/api/users/me")
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "tester@example.com"  # Mock user from conftest
        assert data["name"] == "Test Admin"
        assert data["role"] == "admin"


class TestGetUserById:
    """Test suite for GET /api/users/{user_id}"""

    def test_get_user_success(self, client: TestClient, sample_user: UserModel):
        """Should return specific user by ID"""
        response = client.get(f"/api/users/{sample_user.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_user.id
        assert data["email"] == sample_user.email
        assert data["name"] == sample_user.name

    def test_get_user_not_found(self, client: TestClient):
        """Should return 404 for non-existent user"""
        response = client.get("/api/users/99999")
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]


class TestUpdateUser:
    """Test suite for PUT /api/users/{user_id}"""

    def test_update_user_success(self, client: TestClient, sample_user: UserModel):
        """Should successfully update user details"""
        update_data = {
            "name": "Updated Name",
            "department": "Finance",
            "role": "reviewer"
        }
        
        response = client.put(f"/api/users/{sample_user.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["department"] == "Finance"
        assert data["role"] == "reviewer"

    def test_update_user_partial(self, client: TestClient, sample_user: UserModel):
        """Should support partial updates"""
        update_data = {
            "name": "New Name Only"
        }
        
        response = client.put(f"/api/users/{sample_user.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name Only"
        # Other fields should remain unchanged
        assert data["email"] == sample_user.email

    def test_update_user_not_found(self, client: TestClient):
        """Should return 404 when updating non-existent user"""
        update_data = {"name": "Test"}
        response = client.put("/api/users/99999", json=update_data)
        
        assert response.status_code == 404


class TestDeleteUser:
    """Test suite for DELETE /api/users/{user_id}"""

    def test_delete_user_success(self, client: TestClient, sample_user: UserModel):
        """Should successfully delete a user"""
        response = client.delete(f"/api/users/{sample_user.id}")
        
        assert response.status_code == 204
        
        # Verify user is deleted
        get_response = client.get(f"/api/users/{sample_user.id}")
        assert get_response.status_code == 404

    def test_delete_user_not_found(self, client: TestClient):
        """Should return 404 when deleting non-existent user"""
        response = client.delete("/api/users/99999")
        
        assert response.status_code == 404

