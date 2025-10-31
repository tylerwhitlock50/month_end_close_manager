from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session, joinedload
import os
import uuid
from datetime import datetime, timedelta

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    File as FileModel, 
    Task as TaskModel, 
    User as UserModel, 
    AuditLog as AuditLogModel,
    Period as PeriodModel,
    TrialBalance as TrialBalanceModel,
    TrialBalanceAccount as TrialBalanceAccountModel,
    TrialBalanceAttachment as TrialBalanceAttachmentModel
)
from backend.schemas import (
    File, 
    FileWithUser, 
    FileCabinetStructure, 
    TaskWithFiles,
    TrialBalanceFileInfo
)
from backend.config import settings
from backend.services.file_archiver import create_period_zip_archive, estimate_zip_size

router = APIRouter(prefix="/api/files", tags=["files"])


def get_file_age_days(file: FileModel) -> int:
    """Calculate file age in days."""
    if file.file_date:
        return (datetime.now().date() - file.file_date).days
    return (datetime.now() - file.uploaded_at).days


def _find_previous_period(db: Session, period: PeriodModel) -> Optional[PeriodModel]:
    prev_month = period.month - 1
    prev_year = period.year
    if prev_month <= 0:
        prev_month = 12
        prev_year -= 1

    candidate = (
        db.query(PeriodModel)
        .filter(
            PeriodModel.close_type == period.close_type,
            PeriodModel.year == prev_year,
            PeriodModel.month == prev_month,
        )
        .order_by(PeriodModel.id.desc())
        .first()
    )
    if candidate:
        return candidate

    return (
        db.query(PeriodModel)
        .filter(PeriodModel.close_type == period.close_type)
        .filter(
            (PeriodModel.year < period.year)
            | ((PeriodModel.year == period.year) & (PeriodModel.month < period.month))
        )
        .order_by(PeriodModel.year.desc(), PeriodModel.month.desc())
        .first()
    )


def _build_file_cabinet_structure(db: Session, period: PeriodModel) -> FileCabinetStructure:
    period_id = period.id

    period_files = db.query(FileModel).options(joinedload(FileModel.task)).filter(
        FileModel.period_id == period_id,
        FileModel.task_id.is_(None)
    ).all()

    def _with_user(file: FileModel):
        uploaded_by = None
        if file.uploaded_by_id:
            uploaded_by = db.query(UserModel).filter(UserModel.id == file.uploaded_by_id).first()
        return {
            "id": file.id,
            "task_id": file.task_id,
            "period_id": file.period_id,
            "filename": file.filename,
            "original_filename": file.original_filename,
            "file_size": file.file_size,
            "mime_type": file.mime_type,
            "description": file.description,
            "file_date": file.file_date,
            "is_external_link": file.is_external_link,
            "external_url": file.external_url,
            "uploaded_at": file.uploaded_at,
            "last_accessed_at": file.last_accessed_at,
            "uploaded_by": uploaded_by,
        }

    period_files_with_user = [_with_user(file) for file in period_files]

    tasks = db.query(TaskModel).filter(TaskModel.period_id == period_id).all()
    task_files_list = []
    for task in tasks:
        task_files = db.query(FileModel).filter(FileModel.task_id == task.id).all()
        files_with_user = [_with_user(file) for file in task_files]
        task_files_list.append(
            {
                "id": task.id,
                "name": task.name,
                "status": task.status,
                "files": files_with_user,
            }
        )

    trial_balance_files = []
    trial_balances = db.query(TrialBalanceModel).filter(
        TrialBalanceModel.period_id == period_id
    ).options(joinedload(TrialBalanceModel.accounts)).all()

    for tb in trial_balances:
        for account in tb.accounts:
            attachments = db.query(TrialBalanceAttachmentModel).filter(
                TrialBalanceAttachmentModel.account_id == account.id
            ).all()
            for attachment in attachments:
                trial_balance_files.append(
                    {
                        "id": attachment.id,
                        "account_id": account.id,
                        "account_number": account.account_number,
                        "account_name": account.account_name,
                        "filename": attachment.filename,
                        "original_filename": attachment.original_filename,
                        "file_size": attachment.file_size,
                        "mime_type": attachment.mime_type,
                        "description": attachment.description,
                        "file_date": attachment.file_date,
                        "uploaded_at": attachment.uploaded_at,
                        "file_path": attachment.file_path,
                    }
                )

    return {
        "period": period,
        "period_files": period_files_with_user,
        "task_files": task_files_list,
        "trial_balance_files": trial_balance_files,
    }
@router.get("/task/{task_id}", response_model=List[File])
async def get_task_files(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all files for a specific task."""
    # Verify task exists
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    files = db.query(FileModel).filter(FileModel.task_id == task_id).all()
    return files


@router.get("/{file_id}", response_model=File)
async def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get a specific file by ID."""
    file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Update last accessed timestamp
    file.last_accessed_at = datetime.utcnow()
    db.commit()
    
    return file


@router.get("/download/{file_id}")
async def stream_file(
    file_id: int,
    inline: bool = True,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.is_external_link:
        raise HTTPException(status_code=400, detail="External links cannot be previewed")

    if not file.file_path or not os.path.exists(file.file_path):
        raise HTTPException(status_code=404, detail="File content missing")

    file.last_accessed_at = datetime.utcnow()
    db.commit()

    disposition = 'inline' if inline else 'attachment'
    headers = {
        "Content-Disposition": f"{disposition}; filename=\"{file.original_filename}\""
    }

    return FileResponse(
        path=file.file_path,
        media_type=file.mime_type or 'application/octet-stream',
        filename=file.original_filename,
        headers=headers
    )


@router.get("/old-files/", response_model=List[File])
async def get_old_files(
    days_threshold: int = 30,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get files older than specified days threshold."""
    threshold_date = datetime.now() - timedelta(days=days_threshold)
    
    files = db.query(FileModel).filter(
        FileModel.uploaded_at < threshold_date
    ).all()
    
    return files


@router.post("/upload", response_model=File, status_code=status.HTTP_201_CREATED)
async def upload_file(
    task_id: int,
    file: UploadFile = FastAPIFile(...),
    description: str = None,
    file_date: str = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Upload a file and attach it to a task."""
    # Verify task exists
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check file size
    max_size_bytes = settings.max_file_size_mb * 1024 * 1024
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.max_file_size_mb}MB"
        )
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create task-specific directory
    task_dir = os.path.join(settings.file_storage_path, str(task_id))
    os.makedirs(task_dir, exist_ok=True)
    
    file_path = os.path.join(task_dir, unique_filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Parse file_date if provided
    parsed_file_date = None
    if file_date:
        try:
            parsed_file_date = datetime.fromisoformat(file_date).date()
        except ValueError:
            pass
    
    # Create file record
    db_file = FileModel(
        task_id=task_id,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        description=description,
        file_date=parsed_file_date,
        uploaded_by_id=current_user.id,
        is_external_link=False
    )
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    # Log file upload
    audit_log = AuditLogModel(
        task_id=task_id,
        user_id=current_user.id,
        action="file_uploaded",
        entity_type="file",
        entity_id=db_file.id,
        details=f"Uploaded file: {file.filename}"
    )
    db.add(audit_log)
    db.commit()
    
    return db_file


@router.post("/link", response_model=File, status_code=status.HTTP_201_CREATED)
async def link_external_file(
    task_id: int,
    external_url: str,
    description: str = None,
    file_date: str = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Link an external file (e.g., SharePoint, cloud storage) to a task."""
    # Verify task exists
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Parse file_date if provided
    parsed_file_date = None
    if file_date:
        try:
            parsed_file_date = datetime.fromisoformat(file_date).date()
        except ValueError:
            pass
    
    # Extract filename from URL
    filename = external_url.split("/")[-1] or "External Link"
    
    # Create file record
    db_file = FileModel(
        task_id=task_id,
        filename=filename,
        original_filename=filename,
        file_path="",
        file_size=0,
        description=description,
        file_date=parsed_file_date,
        uploaded_by_id=current_user.id,
        is_external_link=True,
        external_url=external_url
    )
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    # Log file link
    audit_log = AuditLogModel(
        task_id=task_id,
        user_id=current_user.id,
        action="external_file_linked",
        entity_type="file",
        entity_id=db_file.id,
        details=f"Linked external file: {external_url}"
    )
    db.add(audit_log)
    db.commit()
    
    return db_file


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete a file."""
    file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete physical file if not external link
    if not file.is_external_link and os.path.exists(file.file_path):
        os.remove(file.file_path)
    
    # Log file deletion
    audit_log = AuditLogModel(
        task_id=file.task_id,
        user_id=current_user.id,
        action="file_deleted",
        entity_type="file",
        entity_id=file.id,
        details=f"Deleted file: {file.original_filename}"
    )
    db.add(audit_log)
    
    db.delete(file)
    db.commit()
    
    return None


@router.get("/period/{period_id}/all", response_model=FileCabinetStructure)
async def get_period_files(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all files for a period organized by category."""
    # Verify period exists
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    return _build_file_cabinet_structure(db, period)


@router.get("/period/{period_id}/prior", response_model=FileCabinetStructure)
async def get_prior_period_files(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get file cabinet structure for the previous period."""
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    previous_period = _find_previous_period(db, period)
    if not previous_period:
        raise HTTPException(status_code=404, detail="No previous period available")

    return _build_file_cabinet_structure(db, previous_period)


@router.post("/upload-period", response_model=File, status_code=status.HTTP_201_CREATED)
async def upload_period_file(
    period_id: int,
    file: UploadFile = FastAPIFile(...),
    description: str = None,
    file_date: str = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Upload a file directly to a period (not associated with a task)."""
    # Verify period exists
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    # Check file size
    max_size_bytes = settings.max_file_size_mb * 1024 * 1024
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.max_file_size_mb}MB"
        )
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create period-specific directory
    period_name = f"{period.year}{period.month:02d}"
    period_dir = os.path.join(settings.file_storage_path, period_name)
    os.makedirs(period_dir, exist_ok=True)
    
    file_path = os.path.join(period_dir, unique_filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Parse file_date if provided
    parsed_file_date = None
    if file_date:
        try:
            parsed_file_date = datetime.fromisoformat(file_date).date()
        except ValueError:
            pass
    
    # Create file record
    db_file = FileModel(
        period_id=period_id,
        task_id=None,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        description=description,
        file_date=parsed_file_date,
        uploaded_by_id=current_user.id,
        is_external_link=False
    )
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    # Log file upload
    audit_log = AuditLogModel(
        task_id=None,
        user_id=current_user.id,
        action="period_file_uploaded",
        entity_type="file",
        entity_id=db_file.id,
        details=f"Uploaded period file: {file.filename} to period {period.name}"
    )
    db.add(audit_log)
    db.commit()
    
    return db_file


@router.get("/period/{period_id}/download-zip")
async def download_period_zip(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Download all files for a period as a zip archive."""
    # Verify period exists
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    # Estimate size (optional, for logging/monitoring)
    estimated_size = estimate_zip_size(db, period_id)
    
    # Create zip archive
    try:
        zip_buffer = create_period_zip_archive(db, period_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create zip archive: {str(e)}"
        )
    
    # Log download
    audit_log = AuditLogModel(
        task_id=None,
        user_id=current_user.id,
        action="period_zip_downloaded",
        entity_type="period",
        entity_id=period_id,
        details=f"Downloaded zip archive for period {period.name}"
    )
    db.add(audit_log)
    db.commit()
    
    # Create filename
    zip_filename = f"{period.name.replace(' ', '_')}_files.zip"
    
    # Return streaming response
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={zip_filename}"
        }
    )
