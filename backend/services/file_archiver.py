"""
File archiver service for creating zip archives of period files.
"""
import os
import zipfile
from io import BytesIO
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from backend.models import (
    File as FileModel,
    Task as TaskModel,
    Period as PeriodModel,
    TrialBalance as TrialBalanceModel,
    TrialBalanceAttachment as TrialBalanceAttachmentModel,
    TrialBalanceValidation as TrialBalanceValidationModel
)


def sanitize_filename(name: str) -> str:
    """Sanitize a filename for safe use in zip archives."""
    # Replace invalid characters with underscores
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, '_')
    return name


def create_period_zip_archive(db: Session, period_id: int) -> BytesIO:
    """
    Create a zip archive containing all files for a period.
    
    Returns a BytesIO object containing the zip file.
    """
    # Get period
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise ValueError(f"Period {period_id} not found")
    
    # Create in-memory zip file
    zip_buffer = BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Track filenames to avoid duplicates
        used_names: Dict[str, int] = {}
        
        # 1. Add period-level files
        period_files = db.query(FileModel).filter(
            FileModel.period_id == period_id,
            FileModel.task_id.is_(None)
        ).all()
        
        for file in period_files:
            if not file.is_external_link and os.path.exists(file.file_path):
                # Create unique filename if necessary
                base_name = file.original_filename
                if base_name in used_names:
                    used_names[base_name] += 1
                    name_parts = os.path.splitext(base_name)
                    base_name = f"{name_parts[0]}_{used_names[base_name]}{name_parts[1]}"
                else:
                    used_names[base_name] = 0
                
                zip_path = f"period_files/{sanitize_filename(base_name)}"
                zip_file.write(file.file_path, zip_path)
        
        # 2. Add task files organized by task
        tasks = db.query(TaskModel).filter(TaskModel.period_id == period_id).all()
        
        for task in tasks:
            task_files = db.query(FileModel).filter(FileModel.task_id == task.id).all()
            
            if task_files:
                task_folder = sanitize_filename(task.name)
                
                for file in task_files:
                    if not file.is_external_link and os.path.exists(file.file_path):
                        # Create unique filename within task folder
                        base_name = file.original_filename
                        file_key = f"{task_folder}/{base_name}"
                        
                        if file_key in used_names:
                            used_names[file_key] += 1
                            name_parts = os.path.splitext(base_name)
                            base_name = f"{name_parts[0]}_{used_names[file_key]}{name_parts[1]}"
                        else:
                            used_names[file_key] = 0
                        
                        zip_path = f"tasks/{task_folder}/{sanitize_filename(base_name)}"
                        zip_file.write(file.file_path, zip_path)
        
        # 3. Add trial balance files
        trial_balances = db.query(TrialBalanceModel).filter(
            TrialBalanceModel.period_id == period_id
        ).all()
        
        for tb in trial_balances:
            # Add the main trial balance CSV if it exists
            if os.path.exists(tb.file_path):
                zip_path = f"trial_balance/{sanitize_filename(tb.source_filename)}"
                zip_file.write(tb.file_path, zip_path)
            
            # Add account attachments
            for account in tb.accounts:
                attachments = db.query(TrialBalanceAttachmentModel).filter(
                    TrialBalanceAttachmentModel.account_id == account.id
                ).all()
                
                for attachment in attachments:
                    if not attachment.is_external_link and os.path.exists(attachment.file_path):
                        account_folder = f"{account.account_number}_{sanitize_filename(account.account_name)}"
                        base_name = attachment.original_filename
                        file_key = f"tb_account_{account_folder}/{base_name}"
                        
                        if file_key in used_names:
                            used_names[file_key] += 1
                            name_parts = os.path.splitext(base_name)
                            base_name = f"{name_parts[0]}_{used_names[file_key]}{name_parts[1]}"
                        else:
                            used_names[file_key] = 0
                        
                        zip_path = f"trial_balance/{account_folder}/{sanitize_filename(base_name)}"
                        zip_file.write(attachment.file_path, zip_path)
                
                # Add validation evidence files
                validations = db.query(TrialBalanceValidationModel).filter(
                    TrialBalanceValidationModel.account_id == account.id,
                    TrialBalanceValidationModel.evidence_path.isnot(None)
                ).all()
                
                for validation in validations:
                    if os.path.exists(validation.evidence_path):
                        account_folder = f"{account.account_number}_{sanitize_filename(account.account_name)}"
                        base_name = validation.evidence_original_filename or "evidence.pdf"
                        file_key = f"tb_validation_{account_folder}/{base_name}"
                        
                        if file_key in used_names:
                            used_names[file_key] += 1
                            name_parts = os.path.splitext(base_name)
                            base_name = f"{name_parts[0]}_{used_names[file_key]}{name_parts[1]}"
                        else:
                            used_names[file_key] = 0
                        
                        zip_path = f"trial_balance/{account_folder}/validations/{sanitize_filename(base_name)}"
                        zip_file.write(validation.evidence_path, zip_path)
    
    # Reset buffer position to beginning
    zip_buffer.seek(0)
    return zip_buffer


def estimate_zip_size(db: Session, period_id: int) -> int:
    """
    Estimate the total size of all files for a period (in bytes).
    
    Returns approximate size in bytes.
    """
    total_size = 0
    
    # Period files
    period_files = db.query(FileModel).filter(
        FileModel.period_id == period_id,
        FileModel.task_id.is_(None)
    ).all()
    total_size += sum(f.file_size for f in period_files if not f.is_external_link)
    
    # Task files
    task_files = db.query(FileModel).join(TaskModel).filter(
        TaskModel.period_id == period_id,
        FileModel.task_id.isnot(None)
    ).all()
    total_size += sum(f.file_size for f in task_files if not f.is_external_link)
    
    # Trial balance attachments
    tb_attachments = db.query(TrialBalanceAttachmentModel).join(
        TrialBalanceModel.accounts
    ).join(TrialBalanceModel).filter(
        TrialBalanceModel.period_id == period_id
    ).all()
    total_size += sum(a.file_size for a in tb_attachments if not a.is_external_link)
    
    return total_size








