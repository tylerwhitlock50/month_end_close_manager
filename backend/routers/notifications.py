from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Notification as NotificationModel, User as UserModel
from backend.schemas import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=List[Notification])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = (
        db.query(NotificationModel)
        .filter(NotificationModel.user_id == current_user.id)
        .order_by(NotificationModel.created_at.desc())
    )

    if unread_only:
        query = query.filter(NotificationModel.is_read.is_(False))

    notifications = query.limit(limit).all()
    return notifications


@router.get("/me", response_model=List[Notification])
async def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Convenience endpoint for the current user's notifications."""
    return await list_notifications(unread_only=False, limit=20, db=db, current_user=current_user)


@router.post("/{notification_id}/read", response_model=Notification)
@router.put("/{notification_id}/read", response_model=Notification)
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    notification = (
        db.query(NotificationModel)
        .filter(NotificationModel.id == notification_id, NotificationModel.user_id == current_user.id)
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)

    return notification


@router.post("/mark-all-read", response_model=int)
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    updated = (
        db.query(NotificationModel)
        .filter(NotificationModel.user_id == current_user.id, NotificationModel.is_read.is_(False))
        .update({
            NotificationModel.is_read: True,
            NotificationModel.read_at: datetime.utcnow(),
        })
    )
    db.commit()
    return updated
