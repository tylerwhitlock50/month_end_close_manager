"""
PyTest Configuration and Fixtures for API Testing

This module provides shared fixtures and utilities for testing the Month-End Close API.
All tests use an in-memory SQLite database for fast, isolated testing.
"""

import pytest
from datetime import datetime, date
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.auth import get_current_user, get_password_hash
from backend.models import (
    User as UserModel,
    UserRole,
    Period as PeriodModel,
    Task as TaskModel,
    TaskStatus,
    PeriodStatus,
    CloseType
)
from backend.routers import (
    auth,
    users,
    periods,
    tasks,
    files,
    approvals,
    comments,
    dashboard,
    reports,
    trial_balance,
    task_templates,
    notifications,
    search,
)


# Ensure the NetSuite sample file used in tests exists even when the repository
# is checked out without binary assets. This mirrors the file supplied for beta
# validation so the NetSuite importer test can stream real CSV content.
NETSUITE_SAMPLE_PATH = Path(__file__).resolve().parents[2] / "netsuite_file" / "TrialBalance677.csv"
if not NETSUITE_SAMPLE_PATH.exists():
    NETSUITE_SAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    NETSUITE_SAMPLE_PATH.write_text(
        """"Future Comp, LLC"
Parent Company (Consolidated)
Trial Balance
End of Oct 2025

Account ,Debit ,Credit 
10000 - Cash,,
10010 - Checking Account,,
10010 - Checking Account,"$165,289.63",
Total - 10010 - Checking Account,"$165,289.63",$0.00
Total - 10000 - Cash,"$165,289.63",$0.00
12000 - Inventory,,
12010 - Raw Material,"$1,740,812.83",
12030 - Inventory - WIP,"$139,463.91",
12050 - Inventory - FG,"$491,410.90",
12090 - Inventory Allowance,,"$759,638.37"
Total - 12000 - Inventory,"$2,371,687.64","$759,638.37"
25000 - Current Liabilities,,
25061 - Accrued Bonus,"$87,500.00",
Total - 25000 - Current Liabilities,"$87,500.00",$0.00
""" + "\n",
        encoding="utf-8",
    )

# Create an in-memory SQLite database that persists for the lifespan of the tests
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    """Create all tables once for the SQLite test database."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_database():
    """Ensure each test starts with a clean schema."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture
def db_session():
    """Provides a clean database session for each test."""
    session = TestingSessionLocal()
    try:
        yield session
        session.commit()
    finally:
        session.close()


class _FakeUser:
    """Mock user for authentication bypass in tests."""
    id = 1
    email = "tester@example.com"
    name = "Test Admin"
    role = UserRole.ADMIN
    department = "Finance"
    is_active = True


@pytest.fixture
def mock_user():
    """Returns a mock user instance."""
    return _FakeUser()


@pytest.fixture
def client():
    """
    FastAPI test client with all routers included and auth bypassed.
    Uses in-memory SQLite database for isolation.
    """
    app = FastAPI()
    
    # Include all routers
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(periods.router)
    app.include_router(tasks.router)
    app.include_router(files.router)
    app.include_router(approvals.router)
    app.include_router(comments.router)
    app.include_router(dashboard.router)
    app.include_router(reports.router)
    app.include_router(trial_balance.router)
    app.include_router(task_templates.router)
    app.include_router(notifications.router)
    app.include_router(search.router)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
            db.commit()
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: _FakeUser()

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_user(db_session: Session) -> UserModel:
    """Creates and returns a sample user in the database."""
    user = UserModel(
        email="sample@example.com",
        name="Sample User",
        hashed_password=get_password_hash("password123"),
        role=UserRole.PREPARER,
        department="Accounting",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_admin(db_session: Session) -> UserModel:
    """Creates and returns a sample admin user in the database."""
    admin = UserModel(
        email="admin@example.com",
        name="Admin User",
        hashed_password=get_password_hash("admin123"),
        role=UserRole.ADMIN,
        department="Finance",
        is_active=True
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def sample_period(db_session: Session) -> PeriodModel:
    """Creates and returns a sample period in the database."""
    period = PeriodModel(
        name="January 2024",
        month=1,
        year=2024,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        target_close_date=date(2024, 2, 5),
        is_active=True
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)
    return period


@pytest.fixture
def sample_task(db_session: Session, sample_period: PeriodModel, sample_user: UserModel) -> TaskModel:
    """Creates and returns a sample task in the database."""
    task = TaskModel(
        name="Sample Task",
        description="This is a test task",
        period_id=sample_period.id,
        owner_id=sample_user.id,
        status=TaskStatus.NOT_STARTED,
        department="Accounting",
        priority=5,
        is_recurring=False
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)
    return task
