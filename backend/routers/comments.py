from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    Comment as CommentModel,
    Task as TaskModel,
    User as UserModel,
    AuditLog as AuditLogModel,
)
from backend.schemas import Comment, CommentCreate, CommentUpdate, CommentWithUser

router = APIRouter(prefix="/api/comments", tags=["comments"])


@router.get("/task/{task_id}", response_model=List[CommentWithUser])
async def get_task_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all comments for a specific task."""
    # Verify task exists
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comments = db.query(CommentModel).filter(CommentModel.task_id == task_id)\
                                     .order_by(CommentModel.created_at.desc()).all()
    
    result = []
    for comment in comments:
        result.append({
            **comment.__dict__,
            "user": comment.user
        })
    
    return result


@router.post("/", response_model=Comment, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new comment on a task."""
    # Verify task exists
    task = db.query(TaskModel).filter(TaskModel.id == comment_data.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Create comment
    db_comment = CommentModel(
        task_id=comment_data.task_id,
        user_id=current_user.id,
        content=comment_data.content,
        is_internal=comment_data.is_internal
    )
    
    db.add(db_comment)
    db.flush()

    audit_log = AuditLogModel(
        task_id=comment_data.task_id,
        user_id=current_user.id,
        action="comment_added",
        entity_type="comment",
        entity_id=db_comment.id,
        details=comment_data.content[:500]
    )
    db.add(audit_log)

    db.commit()
    db.refresh(db_comment)

    return db_comment


@router.put("/{comment_id}", response_model=Comment)
async def update_comment(
    comment_id: int,
    update_data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update an existing comment. Only the author can edit."""
    comment = db.query(CommentModel).filter(CommentModel.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own comments"
        )

    if update_data.content is not None:
        comment.content = update_data.content
    if update_data.is_internal is not None:
        comment.is_internal = update_data.is_internal

    db.commit()
    db.refresh(comment)

    return comment


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete a comment (only by the author)."""
    comment = db.query(CommentModel).filter(CommentModel.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Only the comment author can delete it
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments"
        )
    
    db.delete(comment)
    db.commit()
    
    return None

