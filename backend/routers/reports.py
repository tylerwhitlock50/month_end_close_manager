from typing import List
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import csv
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    Task as TaskModel,
    Period as PeriodModel,
    User as UserModel,
    TaskStatus
)
from backend.schemas import TaskReport, PeriodMetrics

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/tasks", response_model=List[TaskReport])
async def get_task_report(
    period_id: int = None,
    start_date: str = None,
    end_date: str = None,
    department: str = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get detailed task report."""
    query = db.query(TaskModel)
    
    if period_id:
        query = query.filter(TaskModel.period_id == period_id)
    
    if start_date:
        start = datetime.fromisoformat(start_date)
        query = query.filter(TaskModel.created_at >= start)
    
    if end_date:
        end = datetime.fromisoformat(end_date)
        query = query.filter(TaskModel.created_at <= end)
    
    if department:
        query = query.filter(TaskModel.department == department)
    
    tasks = query.all()
    
    report = []
    for task in tasks:
        days_to_complete = None
        if task.started_at and task.completed_at:
            days_to_complete = (task.completed_at - task.started_at).days
        
        report.append(TaskReport(
            task_id=task.id,
            task_name=task.name,
            period_name=task.period.name if task.period else "N/A",
            owner_name=task.owner.name if task.owner else "N/A",
            assignee_name=task.assignee.name if task.assignee else None,
            status=task.status,
            due_date=task.due_date,
            completed_at=task.completed_at,
            days_to_complete=days_to_complete,
            file_count=len(task.files),
            approval_count=len(task.approvals),
            department=task.department
        ))
    
    return report


@router.get("/periods", response_model=List[PeriodMetrics])
async def get_period_metrics(
    year: int = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get metrics for all periods."""
    query = db.query(PeriodModel)
    
    if year:
        query = query.filter(PeriodModel.year == year)
    
    periods = query.order_by(PeriodModel.year.desc(), PeriodModel.month.desc()).all()
    
    metrics = []
    for period in periods:
        tasks = db.query(TaskModel).filter(TaskModel.period_id == period.id).all()
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETE)
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Calculate days to close
        days_to_close = None
        if period.actual_close_date and period.target_close_date:
            days_to_close = (period.actual_close_date - period.target_close_date).days
        
        # Calculate average task completion time
        completed_with_times = [
            t for t in tasks 
            if t.status == TaskStatus.COMPLETE and t.started_at and t.completed_at
        ]
        
        avg_completion_days = None
        if completed_with_times:
            total_days = sum(
                (t.completed_at - t.started_at).days 
                for t in completed_with_times
            )
            avg_completion_days = total_days / len(completed_with_times)
        
        metrics.append(PeriodMetrics(
            period_id=period.id,
            period_name=period.name,
            target_close_date=period.target_close_date,
            actual_close_date=period.actual_close_date,
            days_to_close=days_to_close,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            completion_rate=round(completion_rate, 2),
            avg_task_completion_days=round(avg_completion_days, 2) if avg_completion_days else None
        ))
    
    return metrics


@router.get("/tasks/export/csv")
async def export_tasks_csv(
    period_id: int = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Export tasks to CSV."""
    query = db.query(TaskModel)
    
    if period_id:
        query = query.filter(TaskModel.period_id == period_id)
    
    tasks = query.all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Task ID", "Task Name", "Period", "Owner", "Assignee", 
        "Status", "Department", "Due Date", "Completed At", 
        "Priority", "Estimated Hours", "Actual Hours"
    ])
    
    # Write data
    for task in tasks:
        writer.writerow([
            task.id,
            task.name,
            task.period.name if task.period else "N/A",
            task.owner.name if task.owner else "N/A",
            task.assignee.name if task.assignee else "",
            task.status.value,
            task.department or "",
            task.due_date.isoformat() if task.due_date else "",
            task.completed_at.isoformat() if task.completed_at else "",
            task.priority,
            task.estimated_hours or "",
            task.actual_hours or ""
        ])
    
    # Return CSV
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=tasks_export_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


@router.get("/tasks/export/pdf")
async def export_tasks_pdf(
    period_id: int = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Export tasks to PDF."""
    query = db.query(TaskModel)
    
    if period_id:
        query = query.filter(TaskModel.period_id == period_id)
    
    tasks = query.all()
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    
    # Add title
    styles = getSampleStyleSheet()
    title = Paragraph("Task Report", styles['Heading1'])
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    # Create table data
    data = [["ID", "Task Name", "Owner", "Status", "Due Date", "Priority"]]
    
    for task in tasks[:50]:  # Limit to first 50 for PDF
        data.append([
            str(task.id),
            task.name[:40],  # Truncate long names
            task.owner.name if task.owner else "N/A",
            task.status.value,
            task.due_date.strftime('%Y-%m-%d') if task.due_date else "",
            str(task.priority)
        ])
    
    # Create table
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(table)
    
    # Build PDF
    doc.build(elements)
    
    # Return PDF
    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=tasks_export_{datetime.now().strftime('%Y%m%d')}.pdf"
        }
    )

