"""
Tests for Authentication Endpoints

Endpoint Testing:
- POST /api/auth/login - User login with OAuth2
- POST /api/auth/register - User registration
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import User as UserModel


class TestAuthLogin:
    """Test suite for POST /api/auth/login"""

    def test_login_success(self, client: TestClient, sample_user: UserModel):
        """Should successfully login with valid credentials"""
        response = client.post(
            "/api/auth/login",
            data={
                "username": "sample@example.com",  # OAuth2 uses 'username' field
                "password": "password123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0

    def test_login_invalid_email(self, client: TestClient):
        """Should return 401 for non-existent email"""
        response = client.post(
            "/api/auth/login",
            data={
                "username": "nonexistent@example.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    def test_login_invalid_password(self, client: TestClient, sample_user: UserModel):
        """Should return 401 for incorrect password"""
        response = client.post(
            "/api/auth/login",
            data={
                "username": "sample@example.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    def test_login_missing_credentials(self, client: TestClient):
        """Should return 422 when credentials are missing"""
        response = client.post("/api/auth/login", data={})
        
        assert response.status_code == 422  # Validation error


class TestAuthRegister:
    """Test suite for POST /api/auth/register"""

    def test_register_success(self, client: TestClient):
        """Should successfully register a new user"""
        user_data = {
            "email": "newuser@example.com",
            "name": "New User",
            "password": "securepass123",
            "role": "preparer",
            "department": "Accounting"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["name"] == user_data["name"]
        assert data["role"] == user_data["role"]
        assert data["department"] == user_data["department"]
        assert "id" in data
        assert "created_at" in data
        assert "password" not in data  # Password should not be in response
        assert "hashed_password" not in data

    def test_register_duplicate_email(self, client: TestClient, sample_user: UserModel):
        """Should return 400 when email already exists"""
        user_data = {
            "email": "sample@example.com",  # Already exists
            "name": "Duplicate User",
            "password": "password123",
            "role": "preparer"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_register_invalid_email(self, client: TestClient):
        """Should return 422 for invalid email format"""
        user_data = {
            "email": "not-an-email",
            "name": "Test User",
            "password": "password123",
            "role": "preparer"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 422

    def test_register_short_password(self, client: TestClient):
        """Should return 422 for password shorter than 8 characters"""
        user_data = {
            "email": "test@example.com",
            "name": "Test User",
            "password": "short",  # Less than 8 characters
            "role": "preparer"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 422

    def test_register_missing_required_fields(self, client: TestClient):
        """Should return 422 when required fields are missing"""
        user_data = {
            "email": "test@example.com"
            # Missing name, password, role
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 422

    def test_register_with_optional_fields(self, client: TestClient):
        """Should successfully register with optional fields"""
        user_data = {
            "email": "fulluser@example.com",
            "name": "Full User",
            "password": "password123",
            "role": "reviewer",
            "department": "Finance",
            "phone": "+1234567890",
            "slack_user_id": "U123456"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["phone"] == user_data["phone"]
        assert data["slack_user_id"] == user_data["slack_user_id"]

