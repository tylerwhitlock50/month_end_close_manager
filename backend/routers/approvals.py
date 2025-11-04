from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    Approval as ApprovalModel,
    Task as TaskModel,
    User as UserModel,
    AuditLog as AuditLogModel,
    ApprovalStatus
)
from backend.schemas import Approval, ApprovalCreate, ApprovalUpdate, ApprovalWithReviewer

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("/task/{task_id}", response_model=List[ApprovalWithReviewer])
async def get_task_approvals(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all approvals for a specific task."""
    # Verify task exists
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    approvals = db.query(ApprovalModel).filter(ApprovalModel.task_id == task_id).all()
    
    result = []
    for approval in approvals:
        result.append({
            **approval.__dict__,
            "reviewer": approval.reviewer
        })
    
    return result


@router.get("/my-approvals", response_model=List[ApprovalWithReviewer])
async def get_my_approvals(
    status: ApprovalStatus = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get approvals assigned to the current user."""
    query = db.query(ApprovalModel).filter(ApprovalModel.reviewer_id == current_user.id)
    
    if status:
        query = query.filter(ApprovalModel.status == status)
    
    approvals = query.all()
    
    result = []
    for approval in approvals:
        result.append({
            **approval.__dict__,
            "reviewer": approval.reviewer
        })
    
    return result


@router.post("/", response_model=Approval, status_code=status.HTTP_201_CREATED)
async def create_approval(
    approval_data: ApprovalCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Request an approval for a task."""
    # Verify task exists
    task = db.query(TaskModel).filter(TaskModel.id == approval_data.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify reviewer exists
    reviewer = db.query(UserModel).filter(UserModel.id == approval_data.reviewer_id).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    
    # Create approval
    db_approval = ApprovalModel(**approval_data.model_dump())
    db.add(db_approval)
    db.commit()
    db.refresh(db_approval)
    
    # Log approval request
    audit_log = AuditLogModel(
        task_id=approval_data.task_id,
        user_id=current_user.id,
        action="approval_requested",
        entity_type="approval",
        entity_id=db_approval.id,
        details=f"Requested approval from {reviewer.name}"
    )
    db.add(audit_log)
    db.commit()
    
    return db_approval


@router.put("/{approval_id}", response_model=Approval)
async def update_approval(
    approval_id: int,
    approval_update: ApprovalUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update an approval (approve, reject, or request revision)."""
    approval = db.query(ApprovalModel).filter(ApprovalModel.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    # Only the assigned reviewer can update the approval
    if approval.reviewer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned reviewer can update this approval"
        )
    
    old_status = approval.status
    
    # Update approval
    approval.status = approval_update.status
    if approval_update.notes:
        approval.notes = approval_update.notes
    approval.reviewed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(approval)
    
    # Log approval update
    audit_log = AuditLogModel(
        task_id=approval.task_id,
        user_id=current_user.id,
        action="approval_updated",
        entity_type="approval",
        entity_id=approval.id,
        old_value=str(old_status),
        new_value=str(approval_update.status),
        details=approval_update.notes
    )
    db.add(audit_log)
    db.commit()
    
    return approval


@router.delete("/{approval_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval(
    approval_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete an approval request."""
    approval = db.query(ApprovalModel).filter(ApprovalModel.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    # Log approval deletion
    audit_log = AuditLogModel(
        task_id=approval.task_id,
        user_id=current_user.id,
        action="approval_deleted",
        entity_type="approval",
        entity_id=approval.id
    )
    db.add(audit_log)
    
    db.delete(approval)
    db.commit()
    
    return None

