from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any, Literal
from decimal import Decimal
from datetime import datetime, date
from backend.models import UserRole, TaskStatus, PeriodStatus, ApprovalStatus, CloseType


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.PREPARER
    department: Optional[str] = None
    phone: Optional[str] = None
    slack_user_id: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    slack_user_id: Optional[str] = None
    is_active: Optional[bool] = None


class User(UserBase):
    id: int
    is_active: bool
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# Period Schemas
class PeriodBase(BaseModel):
    name: str
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020)
    close_type: CloseType = CloseType.MONTHLY
    target_close_date: Optional[date] = None
    is_active: bool = True


class PeriodCreate(PeriodBase):
    pass


class PeriodUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[PeriodStatus] = None
    target_close_date: Optional[date] = None
    actual_close_date: Optional[date] = None
    is_active: Optional[bool] = None


class Period(PeriodBase):
    id: int
    status: PeriodStatus
    actual_close_date: Optional[date] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Task Template Schemas
class TaskTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    close_type: CloseType
    department: Optional[str] = None
    default_owner_id: Optional[int] = None
    days_offset: int = 0
    estimated_hours: Optional[float] = None
    sort_order: int = 0
    default_account_numbers: List[str] = Field(default_factory=list)
    position_x: Optional[float] = None
    position_y: Optional[float] = None

    @field_validator('default_account_numbers', mode='before')
    def ensure_default_account_numbers(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [item for item in value if item]
        return []


class TaskTemplateCreate(TaskTemplateBase):
    dependency_ids: Optional[List[int]] = []


class TaskTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    default_owner_id: Optional[int] = None
    days_offset: Optional[int] = None
    estimated_hours: Optional[float] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    default_account_numbers: Optional[List[str]] = None
    dependency_ids: Optional[List[int]] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class TaskTemplate(TaskTemplateBase):
    id: int
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Task Schemas
class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    owner_id: int
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None
    department: Optional[str] = None
    entity: Optional[str] = None
    priority: int = Field(5, ge=1, le=10)
    estimated_hours: Optional[float] = None
    notes: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class TaskCreate(TaskBase):
    period_id: int
    template_id: Optional[int] = None
    dependency_ids: Optional[List[int]] = []


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    owner_id: Optional[int] = None
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None
    department: Optional[str] = None
    entity: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    notes: Optional[str] = None
    dependency_ids: Optional[List[int]] = None


class Task(TaskBase):
    id: int
    period_id: int
    template_id: Optional[int] = None
    status: TaskStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    actual_hours: Optional[float] = None
    is_recurring: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class TaskSummary(BaseModel):
    id: int
    name: str
    status: TaskStatus
    due_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TaskWithRelations(Task):
    owner: User
    assignee: Optional[User] = None
    period: Period
    file_count: int = 0
    pending_approvals: int = 0
    dependencies: List[int] = []
    dependency_details: List[TaskSummary] = []
    dependent_details: List[TaskSummary] = []


class CriticalPathItem(BaseModel):
    id: int
    name: str
    status: TaskStatus
    due_date: Optional[datetime] = None
    blocked_dependents: int = 0
    dependents: List[TaskSummary] = []

    model_config = ConfigDict(from_attributes=True)


# File Schemas
class FileBase(BaseModel):
    description: Optional[str] = None
    file_date: Optional[date] = None


class FileCreate(FileBase):
    task_id: Optional[int] = None
    period_id: Optional[int] = None
    is_external_link: bool = False
    external_url: Optional[str] = None


class File(FileBase):
    id: int
    task_id: Optional[int] = None
    period_id: Optional[int] = None
    filename: str
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    is_external_link: bool
    external_url: Optional[str] = None
    uploaded_at: datetime
    last_accessed_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class FileWithUser(File):
    uploaded_by: Optional[User] = None


# Approval Schemas
class ApprovalBase(BaseModel):
    notes: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    task_id: int
    reviewer_id: int


class ApprovalUpdate(BaseModel):
    status: ApprovalStatus
    notes: Optional[str] = None


class Approval(ApprovalBase):
    id: int
    task_id: int
    reviewer_id: int
    status: ApprovalStatus
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class ApprovalWithReviewer(Approval):
    reviewer: User


# Comment Schemas
class CommentBase(BaseModel):
    content: str
    is_internal: bool = False


class CommentCreate(CommentBase):
    task_id: int


class CommentUpdate(BaseModel):
    content: Optional[str] = None
    is_internal: Optional[bool] = None


class Comment(CommentBase):
    id: int
    task_id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class CommentWithUser(Comment):
    user: User


# Audit Log Schemas
class AuditLog(BaseModel):
    id: int
    task_id: Optional[int] = None
    user_id: int
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class AuditLogWithUser(AuditLog):
    user: User


class TaskActivityEvent(BaseModel):
    id: str
    event_type: str
    message: str
    created_at: datetime
    user: Optional[User]
    metadata: Optional[Dict[str, Any]] = None


class TaskActivityFeed(BaseModel):
    total: int
    limit: int
    offset: int
    events: List[TaskActivityEvent]


class TaskBulkUpdateRequest(BaseModel):
    task_ids: List[int]
    status: Optional[TaskStatus] = None
    assignee_id: Optional[int] = None


class TaskBulkUpdateResult(BaseModel):
    updated: int


class TaskBulkDeleteRequest(BaseModel):
    task_ids: List[int]


class TaskBulkDeleteResult(BaseModel):
    deleted: int


class MissingTaskSuggestion(BaseModel):
    """Suggestion for a missing task based on template and account."""
    template_id: int
    template_name: str
    account_id: int
    account_number: str
    account_name: str
    department: Optional[str] = None
    estimated_hours: Optional[float] = None
    default_owner_id: Optional[int] = None


# Notification Schemas
class Notification(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    link_url: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Authentication Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Dashboard Schemas
class DashboardStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    tasks_due_today: int
    completion_percentage: float
    avg_time_to_complete: Optional[float] = None
    blocked_tasks: List[TaskSummary] = []
    review_tasks: List[TaskSummary] = []
    at_risk_tasks: List[TaskSummary] = []
    critical_path_tasks: List[CriticalPathItem] = []


class PeriodProgress(BaseModel):
    period: Period
    stats: DashboardStats
    tasks_by_status: dict
    tasks_by_department: dict


class DepartmentSummary(BaseModel):
    department: Optional[str]
    total_tasks: int
    completed_tasks: int


class PeriodDetail(BaseModel):
    period: Period
    completion_percentage: float
    total_tasks: int
    status_counts: Dict[str, int]
    tasks_by_status: Dict[str, List[TaskSummary]]
    overdue_tasks: List[TaskSummary]
    upcoming_tasks: List[TaskSummary]
    department_breakdown: List[DepartmentSummary]
    period_files_count: int
    task_files_count: int
    trial_balance_files_count: int


class PeriodSummary(BaseModel):
    period_id: int
    period_name: str
    status: PeriodStatus
    target_close_date: Optional[date] = None
    days_until_close: Optional[int] = None
    completion_percentage: float
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int


# Review Queue Schemas
class ReviewTask(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: TaskStatus
    due_date: Optional[datetime] = None
    assignee: Optional[User] = None
    period: Period
    file_count: int = 0
    is_overdue: bool = False
    department: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ReviewApproval(BaseModel):
    id: int
    task_id: int
    task_name: str
    status: ApprovalStatus
    notes: Optional[str] = None
    requested_at: datetime
    period: Period
    assignee: Optional[User] = None
    file_count: int = 0
    is_overdue: bool = False
    
    model_config = ConfigDict(from_attributes=True)


class MyReviewsResponse(BaseModel):
    review_tasks: List[ReviewTask] = []
    pending_approvals: List[ReviewApproval] = []
    total_pending: int = 0
    overdue_count: int = 0


# Reporting Schemas
class TaskReport(BaseModel):
    task_id: int
    task_name: str
    period_name: str
    owner_name: str
    assignee_name: Optional[str] = None
    status: TaskStatus
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    days_to_complete: Optional[int] = None
    file_count: int
    approval_count: int
    department: Optional[str] = None


class PeriodMetrics(BaseModel):
    period_id: int
    period_name: str
    target_close_date: Optional[date] = None
    actual_close_date: Optional[date] = None
    days_to_close: Optional[int] = None
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    avg_task_completion_days: Optional[float] = None


# Trial Balance Schemas
class TrialBalanceAttachmentBase(BaseModel):
    description: Optional[str] = None
    file_date: Optional[date] = None


class TrialBalanceAttachmentCreate(TrialBalanceAttachmentBase):
    is_external_link: bool = False
    external_url: Optional[str] = None


class TrialBalanceAttachmentLink(TrialBalanceAttachmentBase):
    external_url: str


class TrialBalanceAttachment(TrialBalanceAttachmentBase):
    id: int
    account_id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    is_external_link: bool
    external_url: Optional[str] = None
    uploaded_by_id: Optional[int] = None
    uploaded_at: datetime
    last_accessed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TrialBalanceAccountBase(BaseModel):
    notes: Optional[str] = None
    is_verified: bool = False


class TrialBalanceAccountUpdate(BaseModel):
    notes: Optional[str] = None
    is_verified: Optional[bool] = None


class TrialBalanceAccountTasksUpdate(BaseModel):
    task_ids: List[int] = []


class TrialBalanceValidation(BaseModel):
    id: int
    account_id: int
    task_id: Optional[int] = None
    task: Optional[TaskSummary] = None
    supporting_amount: Decimal
    difference: Decimal
    matches_balance: bool
    notes: Optional[str] = None
    evidence_original_filename: Optional[str] = None
    evidence_size: Optional[int] = None
    evidence_mime_type: Optional[str] = None
    evidence_file_date: Optional[date] = None
    evidence_uploaded_at: Optional[datetime] = None
    evidence_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={Decimal: lambda v: float(v) if v is not None else None},
    )


class TrialBalanceAccount(TrialBalanceAccountBase):
    id: int
    trial_balance_id: int
    account_number: str
    account_name: str
    account_type: Optional[str] = None
    debit: Optional[Decimal] = None
    credit: Optional[Decimal] = None
    ending_balance: Optional[Decimal] = None
    verified_at: Optional[datetime] = None
    verified_by_id: Optional[int] = None
    tasks: List[TaskSummary] = []
    attachments: List[TrialBalanceAttachment] = []
    validations: List[TrialBalanceValidation] = []

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={Decimal: lambda v: float(v) if v is not None else None},
    )


class TrialBalance(BaseModel):
    id: int
    period_id: int
    name: str
    source_filename: str
    stored_filename: str
    total_debit: Optional[Decimal] = None
    total_credit: Optional[Decimal] = None
    total_balance: Optional[Decimal] = None
    uploaded_at: datetime
    accounts: List[TrialBalanceAccount] = []

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={Decimal: lambda v: float(v) if v is not None else None},
    )


class TrialBalanceSummary(BaseModel):
    trial_balance_id: int
    period_id: int
    account_count: int
    total_debit: Optional[float] = None
    total_credit: Optional[float] = None
    total_balance: Optional[float] = None
    metadata: Optional[dict[str, Optional[str]]] = None
    warnings: List[str] = []


class TrialBalanceComparisonAccount(BaseModel):
    account_number: str
    account_name: Optional[str] = None
    current_account_id: Optional[int] = None
    previous_account_id: Optional[int] = None
    current_balance: Optional[float] = None
    previous_balance: Optional[float] = None
    delta: Optional[float] = None
    delta_percent: Optional[float] = None


class TrialBalanceComparison(BaseModel):
    period_id: int
    previous_period_id: Optional[int]
    accounts: List[TrialBalanceComparisonAccount] = []


class TrialBalanceAccountTaskCreate(BaseModel):
    name: str
    owner_id: int
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    status: TaskStatus = TaskStatus.NOT_STARTED
    due_date: Optional[datetime] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    department: Optional[str] = None
    save_as_template: bool = False
    template_name: Optional[str] = None
    template_department: Optional[str] = None
    template_estimated_hours: Optional[float] = Field(None, ge=0)
    template_default_account_numbers: Optional[List[str]] = None


class TaskFileSummary(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    uploaded_at: datetime
    uploaded_by: Optional[User] = None


class TaskCommentSummary(BaseModel):
    id: int
    content: str
    created_at: datetime
    user: Optional[User]


class PriorTaskSnapshot(BaseModel):
    task_id: int
    period_id: int
    period_name: str
    name: str
    status: TaskStatus
    due_date: Optional[datetime]
    files: List[TaskFileSummary] = []
    comments: List[TaskCommentSummary] = []


# File Cabinet Schemas
class TaskWithFiles(BaseModel):
    id: int
    name: str
    status: TaskStatus
    files: List[FileWithUser] = []
    
    model_config = ConfigDict(from_attributes=True)


class TrialBalanceFileInfo(BaseModel):
    id: int
    account_id: int
    account_number: str
    account_name: str
    filename: str
    original_filename: str
    file_size: int
    mime_type: Optional[str] = None
    description: Optional[str] = None
    file_date: Optional[date] = None
    uploaded_at: datetime
    file_path: str
    
    model_config = ConfigDict(from_attributes=True)


class FileCabinetStructure(BaseModel):
    period: Period
    period_files: List[FileWithUser] = []
    task_files: List[TaskWithFiles] = []
    trial_balance_files: List[TrialBalanceFileInfo] = []


# Workflow Builder Schemas
class PositionUpdate(BaseModel):
    """Schema for updating node position in workflow builder"""
    position_x: float
    position_y: float


class SimpleUser(BaseModel):
    """Simplified user schema for workflow nodes"""
    id: int
    name: str
    
    model_config = ConfigDict(from_attributes=True)


class WorkflowNode(BaseModel):
    """Schema for a node in the workflow builder"""
    id: int
    name: str
    description: Optional[str] = None
    status: Optional[str] = None  # Only for tasks, not templates
    department: Optional[str] = None
    owner: Optional[SimpleUser] = None
    assignee: Optional[SimpleUser] = None
    due_date: Optional[datetime] = None
    priority: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    dependency_ids: List[int] = []


class WorkflowEdge(BaseModel):
    """Schema for an edge connecting two nodes in the workflow"""
    id: str
    source: int  # Source node ID
    target: int  # Target node ID


class WorkflowResponse(BaseModel):
    """Schema for workflow data with nodes and computed edges"""
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]


class SearchResultItem(BaseModel):
    id: Optional[int] = None
    title: str
    subtitle: Optional[str] = None
    url: str
    type: Literal['task', 'template', 'account', 'page']


class SearchResults(BaseModel):
    tasks: List[SearchResultItem] = []
    templates: List[SearchResultItem] = []
    accounts: List[SearchResultItem] = []
    pages: List[SearchResultItem] = []
