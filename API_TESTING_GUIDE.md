# API Testing Guide

## Overview

This document provides comprehensive documentation for all API endpoints in the Month-End Close application, including expected request/response types, authentication requirements, and testing strategies.

## Table of Contents

- [Running Tests](#running-tests)
- [Authentication](#authentication)
- [User Management](#user-management)
- [Period Management](#period-management)
- [Task Management](#task-management)
- [File Management](#file-management)
- [Dashboard](#dashboard)
- [Approvals](#approvals)
- [Comments](#comments)
- [Notifications](#notifications)
- [Task Templates](#task-templates)
- [Reports](#reports)
- [Trial Balance](#trial-balance)

---

## Running Tests

### Local Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest backend/tests/test_auth.py

# Run with coverage
pytest --cov=backend

# Run with verbose output
pytest -v

# Run specific test class
pytest backend/tests/test_users.py::TestGetUsers

# Run specific test method
pytest backend/tests/test_users.py::TestGetUsers::test_get_users_success
```

### Docker Testing

```bash
# Run tests in Docker container
docker-compose exec backend pytest

# Run with coverage
docker-compose exec backend pytest --cov=backend

# Run specific tests
docker-compose exec backend pytest backend/tests/test_auth.py -v
```

---

## Authentication

Base path: `/api/auth`

### POST /api/auth/login

**Description:** Login with email and password to receive JWT access token

**Request Type:** `application/x-www-form-urlencoded` (OAuth2 format)

**Request Body:**
```
username=user@example.com&password=secret123
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `422 Unprocessable Entity`: Validation error

**Test Coverage:**
- ✅ Successful login with valid credentials
- ✅ Invalid email
- ✅ Invalid password
- ✅ Missing credentials

---

### POST /api/auth/register

**Description:** Register a new user account

**Request Type:** `application/json`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "name": "John Doe",
  "password": "securepass123",
  "role": "preparer",
  "department": "Accounting",
  "phone": "+1234567890",
  "slack_user_id": "U123456"
}
```

**Required Fields:** `email`, `name`, `password`

**Success Response (201):**
```json
{
  "id": 1,
  "email": "newuser@example.com",
  "name": "John Doe",
  "role": "preparer",
  "department": "Accounting",
  "phone": "+1234567890",
  "slack_user_id": "U123456",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Email already registered
- `422 Unprocessable Entity`: Validation error (invalid email, short password, missing fields)

**Test Coverage:**
- ✅ Successful registration
- ✅ Duplicate email
- ✅ Invalid email format
- ✅ Short password (< 8 characters)
- ✅ Missing required fields
- ✅ Registration with optional fields

---

## User Management

Base path: `/api/users`

### GET /api/users/

**Description:** List all users with pagination

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Maximum number of records to return (default: 100)

**Request Type:** `GET`

**Success Response (200):**
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "preparer",
    "department": "Accounting",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

---

### GET /api/users/me

**Description:** Get current authenticated user's information

**Authentication:** Required

**Request Type:** `GET`

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin",
  "department": "Finance",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### GET /api/users/{user_id}

**Description:** Get specific user by ID

**Authentication:** Required

**Request Type:** `GET`

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "preparer",
  "department": "Accounting",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found`: User does not exist

---

### PUT /api/users/{user_id}

**Description:** Update user details (Admin only)

**Authentication:** Required (Admin role)

**Request Type:** `application/json`

**Request Body:**
```json
{
  "name": "Updated Name",
  "role": "reviewer",
  "department": "Finance",
  "is_active": true
}
```

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Updated Name",
  "role": "reviewer",
  "department": "Finance",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found`: User does not exist

---

### DELETE /api/users/{user_id}

**Description:** Delete user (Admin only)

**Authentication:** Required (Admin role)

**Request Type:** `DELETE`

**Success Response (204):** No content

**Error Responses:**
- `404 Not Found`: User does not exist

---

## Period Management

Base path: `/api/periods`

### GET /api/periods/

**Description:** List all periods with optional filters

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Pagination offset (default: 0)
- `limit` (int): Max records (default: 100)
- `year` (int): Filter by year
- `include_inactive` (bool): Include inactive periods (default: true)

**Request Type:** `GET`

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "January 2024",
    "month": 1,
    "year": 2024,
    "close_type": "monthly",
    "status": "in_progress",
    "target_close_date": "2024-02-05",
    "actual_close_date": null,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### POST /api/periods/

**Description:** Create a new period

**Authentication:** Required (Admin or Reviewer role)

**Query Parameters:**
- `roll_forward_tasks` (bool): Auto-create tasks from templates (default: false)

**Request Type:** `application/json`

**Request Body:**
```json
{
  "name": "February 2024",
  "month": 2,
  "year": 2024,
  "close_type": "monthly",
  "target_close_date": "2024-03-05",
  "is_active": true
}
```

**Success Response (201):**
```json
{
  "id": 2,
  "name": "February 2024",
  "month": 2,
  "year": 2024,
  "close_type": "monthly",
  "status": "not_started",
  "target_close_date": "2024-03-05",
  "is_active": true,
  "created_at": "2024-02-01T00:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Period already exists for month/year
- `422 Unprocessable Entity`: Invalid month (not 1-12)

---

### GET /api/periods/{period_id}/progress

**Description:** Get detailed progress statistics for a period

**Authentication:** Required

**Request Type:** `GET`

**Success Response (200):**
```json
{
  "period": { /* Period object */ },
  "stats": {
    "total_tasks": 50,
    "completed_tasks": 35,
    "in_progress_tasks": 10,
    "overdue_tasks": 2,
    "tasks_due_today": 3,
    "completion_percentage": 70.0,
    "avg_time_to_complete": 4.5
  },
  "tasks_by_status": {
    "not_started": 5,
    "in_progress": 10,
    "review": 0,
    "complete": 35,
    "blocked": 0
  },
  "tasks_by_department": {
    "Accounting": 25,
    "Finance": 15,
    "IT": 10
  }
}
```

---

## Task Management

Base path: `/api/tasks`

### GET /api/tasks/

**Description:** List tasks with multiple filter options

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Pagination offset
- `limit` (int): Max records
- `period_id` (int): Filter by period
- `status` (string): Filter by status (not_started, in_progress, review, complete, blocked)
- `owner_id` (int): Filter by owner
- `assignee_id` (int): Filter by assignee
- `department` (string): Filter by department
- `mine` (bool): Filter to current user's tasks

**Request Type:** `GET`

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Bank Reconciliation",
    "description": "Reconcile all bank accounts",
    "period_id": 1,
    "owner_id": 2,
    "assignee_id": 3,
    "status": "in_progress",
    "due_date": "2024-02-05T17:00:00Z",
    "department": "Accounting",
    "priority": 8,
    "owner": { /* User object */ },
    "assignee": { /* User object */ },
    "period": { /* Period object */ },
    "file_count": 3,
    "pending_approvals": 0,
    "dependencies": []
  }
]
```

---

### POST /api/tasks/

**Description:** Create a new task

**Authentication:** Required

**Request Type:** `application/json`

**Request Body:**
```json
{
  "name": "New Task",
  "description": "Task description",
  "period_id": 1,
  "owner_id": 2,
  "assignee_id": 3,
  "department": "Finance",
  "priority": 7,
  "estimated_hours": 4.0,
  "dependency_ids": [5, 6]
}
```

**Success Response (201):**
```json
{
  "id": 10,
  "name": "New Task",
  "status": "not_started",
  /* ... other fields ... */
}
```

**Error Responses:**
- `404 Not Found`: Period does not exist

---

### PUT /api/tasks/{task_id}

**Description:** Update a task

**Authentication:** Required

**Request Type:** `application/json`

**Request Body:**
```json
{
  "name": "Updated Task Name",
  "status": "in_progress",
  "priority": 9
}
```

**Success Response (200):** Updated task object

---

### DELETE /api/tasks/{task_id}

**Description:** Delete a task

**Authentication:** Required

**Request Type:** `DELETE`

**Success Response (204):** No content

---

### POST /api/tasks/bulk-update

**Description:** Update multiple tasks at once

**Authentication:** Required

**Request Type:** `application/json`

**Request Body:**
```json
{
  "task_ids": [1, 2, 3],
  "status": "in_progress",
  "assignee_id": 5
}
```

**Success Response (200):**
```json
{
  "updated": 3
}
```

---

## File Management

Base path: `/api/files`

### GET /api/files/task/{task_id}

**Description:** Get all files for a specific task

**Authentication:** Required

**Request Type:** `GET`

**Success Response (200):**
```json
[
  {
    "id": 1,
    "task_id": 5,
    "filename": "uuid-filename.pdf",
    "original_filename": "document.pdf",
    "file_size": 102400,
    "mime_type": "application/pdf",
    "is_external_link": false,
    "uploaded_at": "2024-01-15T10:30:00Z"
  }
]
```

---

### POST /api/files/link

**Description:** Link an external file (e.g., SharePoint URL) to a task

**Authentication:** Required

**Request Type:** Query parameters

**Query Parameters:**
- `task_id` (int): Task ID
- `external_url` (string): URL to external file
- `description` (string, optional): File description

**Success Response (201):**
```json
{
  "id": 10,
  "task_id": 5,
  "filename": "document.pdf",
  "is_external_link": true,
  "external_url": "https://sharepoint.com/document.pdf",
  "uploaded_at": "2024-01-15T10:30:00Z"
}
```

---

### GET /api/files/period/{period_id}/all

**Description:** Get all files for a period (organized by category)

**Authentication:** Required

**Request Type:** `GET`

**Success Response (200):**
```json
{
  "period": { /* Period object */ },
  "period_files": [ /* Files directly attached to period */ ],
  "task_files": [
    {
      "id": 1,
      "name": "Task Name",
      "status": "complete",
      "files": [ /* File objects */ ]
    }
  ],
  "trial_balance_files": [ /* Trial balance attachments */ ]
}
```

---

## Dashboard

Base path: `/api/dashboard`

### GET /api/dashboard/stats

**Description:** Get comprehensive dashboard statistics

**Authentication:** Required

**Query Parameters:**
- `period_id` (int, optional): Filter by specific period

**Request Type:** `GET`

**Success Response (200):**
```json
{
  "total_tasks": 50,
  "completed_tasks": 35,
  "in_progress_tasks": 10,
  "overdue_tasks": 2,
  "tasks_due_today": 3,
  "completion_percentage": 70.0,
  "avg_time_to_complete": 4.5,
  "blocked_tasks": [ /* Task summaries */ ],
  "review_tasks": [ /* Task summaries */ ],
  "at_risk_tasks": [ /* Task summaries */ ],
  "critical_path_tasks": [ /* Critical path items */ ]
}
```

---

### GET /api/dashboard/my-reviews

**Description:** Get all items awaiting review by current user

**Authentication:** Required

**Request Type:** `GET`

**Success Response (200):**
```json
{
  "review_tasks": [ /* Tasks in review status */ ],
  "pending_approvals": [ /* Approval requests */ ],
  "total_pending": 5,
  "overdue_count": 1
}
```

---

## Testing Best Practices

### 1. Request Type Verification

Always verify you're using the correct HTTP method and content type:

```python
# Correct
response = client.post("/api/tasks/", json=task_data)

# Incorrect - using params instead of json
response = client.post("/api/tasks/", params=task_data)
```

### 2. Authentication

Most endpoints require authentication. Tests use a mock user fixture:

```python
# Mock user is automatically injected by conftest.py
response = client.get("/api/users/me")
# Returns mock user: tester@example.com (Admin)
```

### 3. Database Isolation

Each test gets a clean database:

```python
def test_example(client, sample_user, sample_task):
    # sample_user and sample_task are fresh for this test
    # Changes don't affect other tests
```

### 4. Testing Response Structure

Always verify both status code AND response structure:

```python
def test_get_user(client, sample_user):
    response = client.get(f"/api/users/{sample_user.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "email" in data
    assert data["email"] == sample_user.email
```

---

## Common HTTP Status Codes

- `200 OK`: Successful GET/PUT request
- `201 Created`: Successful POST (resource created)
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Business logic error
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error (Pydantic)

---

## Coverage Report

To generate a coverage report:

```bash
# Generate HTML coverage report
pytest --cov=backend --cov-report=html

# Open the report
open backend/tests/coverage_html/index.html
```

Target coverage: 80% or higher for all routers

---

## Troubleshooting

### Tests fail with "no such table" error
- Make sure database migrations are up to date
- Check that `Base.metadata.create_all()` is called in conftest.py

### Tests pass individually but fail when run together
- Check for shared state between tests
- Ensure fixtures properly clean up after themselves
- Verify `clean_database` fixture is working

### Import errors
- Verify virtual environment is activated
- Run `pip install -r requirements.txt`
- Check Python path includes project root

---

## Additional Resources

- FastAPI Testing: https://fastapi.tiangolo.com/tutorial/testing/
- PyTest Documentation: https://docs.pytest.org/
- SQLAlchemy Testing: https://docs.sqlalchemy.org/en/14/orm/session_transaction.html

