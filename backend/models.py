from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text,
    Boolean, Enum, Table, Float, Date, Numeric, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import os
import enum
from backend.database import Base


# Enums
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    REVIEWER = "reviewer"
    PREPARER = "preparer"
    VIEWER = "viewer"


class TaskStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETE = "complete"
    BLOCKED = "blocked"


class PeriodStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    UNDER_REVIEW = "under_review"
    CLOSED = "closed"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"


class CloseType(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEAR_END = "year_end"


# Association table for task dependencies (many-to-many)
task_dependencies = Table(
    'task_dependencies',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    Column('depends_on_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True)
)


# Association table for task template dependencies (many-to-many)
task_template_dependencies = Table(
    'task_template_dependencies',
    Base.metadata,
    Column('template_id', Integer, ForeignKey('task_templates.id', ondelete='CASCADE'), primary_key=True),
    Column('depends_on_id', Integer, ForeignKey('task_templates.id', ondelete='CASCADE'), primary_key=True)
)


trial_balance_account_tasks = Table(
    'trial_balance_account_tasks',
    Base.metadata,
    Column('account_id', Integer, ForeignKey('trial_balance_accounts.id', ondelete='CASCADE'), primary_key=True),
    Column('task_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True)
)


# Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.PREPARER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    department = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    slack_user_id = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owned_tasks = relationship("Task", back_populates="owner", foreign_keys="Task.owner_id")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    approvals = relationship("Approval", back_populates="reviewer")
    audit_logs = relationship("AuditLog", back_populates="user")
    comments = relationship("Comment", back_populates="user")


class Period(Base):
    __tablename__ = "periods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # e.g., "September 2025"
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)
    close_type = Column(Enum(CloseType), default=CloseType.MONTHLY, nullable=False)
    status = Column(Enum(PeriodStatus), default=PeriodStatus.PLANNED, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    target_close_date = Column(Date, nullable=True)
    actual_close_date = Column(Date, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    tasks = relationship("Task", back_populates="period", cascade="all, delete-orphan")


class TaskTemplate(Base):
    __tablename__ = "task_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    close_type = Column(Enum(CloseType), nullable=False)
    department = Column(String(100), nullable=True)
    default_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    days_offset = Column(Integer, default=0)  # Days relative to period end
    estimated_hours = Column(Float, nullable=True)
    default_account_numbers = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0)
    
    # Workflow visualization positions
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tasks = relationship("Task", back_populates="template")
    
    # Self-referential many-to-many for template dependencies
    dependencies = relationship(
        "TaskTemplate",
        secondary=task_template_dependencies,
        primaryjoin=id == task_template_dependencies.c.template_id,
        secondaryjoin=id == task_template_dependencies.c.depends_on_id,
        backref="dependent_templates"
    )


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    period_id = Column(Integer, ForeignKey("periods.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("task_templates.id"), nullable=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.NOT_STARTED, nullable=False)
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    due_date = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    department = Column(String(100), nullable=True)
    entity = Column(String(100), nullable=True)
    priority = Column(Integer, default=5)  # 1-10, 10 being highest
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, nullable=True)
    
    notes = Column(Text, nullable=True)
    is_recurring = Column(Boolean, default=False)
    
    # Workflow visualization positions
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    period = relationship("Period", back_populates="tasks")
    template = relationship("TaskTemplate", back_populates="tasks")
    owner = relationship("User", back_populates="owned_tasks", foreign_keys=[owner_id])
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assignee_id])
    files = relationship("File", back_populates="task", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="task", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    
    # Self-referential many-to-many for dependencies
    dependencies = relationship(
        "Task",
        secondary=task_dependencies,
        primaryjoin=id == task_dependencies.c.task_id,
        secondaryjoin=id == task_dependencies.c.depends_on_id,
        backref="dependent_tasks"
    )


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    period_id = Column(Integer, ForeignKey("periods.id", ondelete="CASCADE"), nullable=True)
    
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    mime_type = Column(String(100), nullable=True)
    
    description = Column(Text, nullable=True)
    is_external_link = Column(Boolean, default=False)
    external_url = Column(String(500), nullable=True)
    
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)
    
    # File age tracking
    file_date = Column(Date, nullable=True)  # The effective date of the file content
    
    # Relationships
    task = relationship("Task", back_populates="files")
    period = relationship("Period")
    uploaded_by = relationship("User")


class TrialBalance(Base):
    __tablename__ = "trial_balances"

    id = Column(Integer, primary_key=True, index=True)
    period_id = Column(Integer, ForeignKey("periods.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    source_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    total_debit = Column(Numeric(18, 2), nullable=True)
    total_credit = Column(Numeric(18, 2), nullable=True)
    total_balance = Column(Numeric(18, 2), nullable=True)
    notes = Column(Text, nullable=True)

    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    period = relationship("Period", backref="trial_balances")
    uploaded_by = relationship("User")
    accounts = relationship("TrialBalanceAccount", back_populates="trial_balance", cascade="all, delete-orphan")


class TrialBalanceAccount(Base):
    __tablename__ = "trial_balance_accounts"

    id = Column(Integer, primary_key=True, index=True)
    trial_balance_id = Column(Integer, ForeignKey("trial_balances.id", ondelete="CASCADE"), nullable=False)

    account_number = Column(String(100), nullable=False)
    account_name = Column(String(255), nullable=False)
    account_type = Column(String(100), nullable=True)

    debit = Column(Numeric(18, 2), nullable=True)
    credit = Column(Numeric(18, 2), nullable=True)
    ending_balance = Column(Numeric(18, 2), nullable=True)

    notes = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    trial_balance = relationship("TrialBalance", back_populates="accounts")
    verified_by = relationship("User")
    tasks = relationship("Task", secondary=trial_balance_account_tasks, backref="trial_balance_accounts")
    attachments = relationship("TrialBalanceAttachment", back_populates="account", cascade="all, delete-orphan")
    validations = relationship("TrialBalanceValidation", back_populates="account", cascade="all, delete-orphan")


class TrialBalanceAttachment(Base):
    __tablename__ = "trial_balance_attachments"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trial_balance_accounts.id", ondelete="CASCADE"), nullable=False)

    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=True)

    description = Column(Text, nullable=True)
    is_external_link = Column(Boolean, default=False, nullable=False)
    external_url = Column(String(500), nullable=True)
    file_date = Column(Date, nullable=True)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)

    account = relationship("TrialBalanceAccount", back_populates="attachments")
    uploaded_by = relationship("User")


class TrialBalanceValidation(Base):
    __tablename__ = "trial_balance_validations"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("trial_balance_accounts.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)

    supporting_amount = Column(Numeric(18, 2), nullable=False)
    difference = Column(Numeric(18, 2), nullable=False)
    matches_balance = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    evidence_filename = Column(String(255), nullable=True)
    evidence_original_filename = Column(String(255), nullable=True)
    evidence_path = Column(String(500), nullable=True)
    evidence_relative_path = Column(String(500), nullable=True)
    evidence_size = Column(Integer, nullable=True)
    evidence_mime_type = Column(String(100), nullable=True)
    evidence_file_date = Column(Date, nullable=True)
    evidence_uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    account = relationship("TrialBalanceAccount", back_populates="validations")
    task = relationship("Task")

    @property
    def evidence_url(self) -> str:
        if self.evidence_relative_path:
            return f"/files/{self.evidence_relative_path.replace(os.sep, '/')}"
        return None


class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False)
    notes = Column(Text, nullable=True)
    
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    task = relationship("Task", back_populates="approvals")
    reviewer = relationship("User", back_populates="approvals")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    action = Column(String(100), nullable=False)  # e.g., "created", "status_changed", "file_uploaded"
    entity_type = Column(String(50), nullable=False)  # e.g., "task", "file", "approval"
    entity_id = Column(Integer, nullable=True)
    
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    task = relationship("Task", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)  # Internal notes vs shared comments
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    task = relationship("Task", back_populates="comments")
    user = relationship("User", back_populates="comments")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)  # e.g., "task_assigned", "approval_requested"
    
    is_read = Column(Boolean, default=False)
    is_sent_email = Column(Boolean, default=False)
    is_sent_slack = Column(Boolean, default=False)
    
    link_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
