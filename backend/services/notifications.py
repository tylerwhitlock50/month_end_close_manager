import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import User, Notification as NotificationModel


class EmailService:
    """Service for sending email notifications."""
    
    @staticmethod
    def send_email(to_email: str, subject: str, body: str, html_body: str = None):
        """Send an email notification."""
        if not settings.smtp_user or not settings.smtp_password:
            print(f"Email configuration missing. Would send: {subject} to {to_email}")
            return
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = settings.email_from
            msg['To'] = to_email
            
            # Attach plain text and HTML versions
            part1 = MIMEText(body, 'plain')
            msg.attach(part1)
            
            if html_body:
                part2 = MIMEText(html_body, 'html')
                msg.attach(part2)
            
            # Send email
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            
            print(f"Email sent successfully to {to_email}")
            
        except Exception as e:
            print(f"Failed to send email to {to_email}: {str(e)}")
    
    @staticmethod
    def send_task_assigned_email(user: User, task_name: str, task_link: str):
        """Send task assignment notification."""
        subject = f"Task Assigned: {task_name}"
        body = f"""
Hello {user.name},

You have been assigned a new task: {task_name}

View task: {task_link}

Best regards,
Month-End Close Manager
        """
        
        html_body = f"""
<html>
<body>
    <h2>New Task Assignment</h2>
    <p>Hello {user.name},</p>
    <p>You have been assigned a new task: <strong>{task_name}</strong></p>
    <p><a href="{task_link}">View Task</a></p>
    <br>
    <p>Best regards,<br>Month-End Close Manager</p>
</body>
</html>
        """
        
        EmailService.send_email(user.email, subject, body, html_body)
    
    @staticmethod
    def send_approval_requested_email(user: User, task_name: str, task_link: str):
        """Send approval request notification."""
        subject = f"Approval Requested: {task_name}"
        body = f"""
Hello {user.name},

Your approval has been requested for: {task_name}

Review task: {task_link}

Best regards,
Month-End Close Manager
        """
        
        html_body = f"""
<html>
<body>
    <h2>Approval Request</h2>
    <p>Hello {user.name},</p>
    <p>Your approval has been requested for: <strong>{task_name}</strong></p>
    <p><a href="{task_link}">Review Task</a></p>
    <br>
    <p>Best regards,<br>Month-End Close Manager</p>
</body>
</html>
        """
        
        EmailService.send_email(user.email, subject, body, html_body)
    
    @staticmethod
    def send_daily_digest(user: User, pending_tasks: List[dict]):
        """Send daily digest of pending tasks."""
        subject = "Daily Close Digest - Pending Tasks"
        
        task_list = "\n".join([
            f"- {task['name']} (Due: {task['due_date']})" 
            for task in pending_tasks
        ])
        
        body = f"""
Hello {user.name},

Here's your daily digest of pending tasks:

{task_list}

Total pending tasks: {len(pending_tasks)}

Best regards,
Month-End Close Manager
        """
        
        task_html = "".join([
            f"<li>{task['name']} <em>(Due: {task['due_date']})</em></li>" 
            for task in pending_tasks
        ])
        
        html_body = f"""
<html>
<body>
    <h2>Daily Close Digest</h2>
    <p>Hello {user.name},</p>
    <p>Here's your daily digest of pending tasks:</p>
    <ul>{task_html}</ul>
    <p><strong>Total pending tasks: {len(pending_tasks)}</strong></p>
    <br>
    <p>Best regards,<br>Month-End Close Manager</p>
</body>
</html>
        """
        
        EmailService.send_email(user.email, subject, body, html_body)


class SlackService:
    """Service for sending Slack notifications."""
    
    def __init__(self):
        self.client = None
        if settings.slack_bot_token:
            self.client = WebClient(token=settings.slack_bot_token)
    
    def send_message(self, channel: str, text: str, blocks: list = None):
        """Send a Slack message."""
        if not self.client:
            print(f"Slack not configured. Would send: {text}")
            return
        
        try:
            response = self.client.chat_postMessage(
                channel=channel,
                text=text,
                blocks=blocks
            )
            print(f"Slack message sent: {response['ts']}")
        except SlackApiError as e:
            print(f"Failed to send Slack message: {e.response['error']}")
    
    def send_task_notification(self, task_name: str, user_name: str, action: str):
        """Send task notification to Slack."""
        text = f"Task {action}: *{task_name}* (Assigned to: {user_name})"
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Task {action}*"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Task:*\n{task_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Assigned to:*\n{user_name}"
                    }
                ]
            }
        ]
        
        self.send_message(settings.slack_channel, text, blocks)
    
    def send_close_summary(self, period_name: str, stats: dict):
        """Send close period summary to Slack."""
        text = f"Close Summary for {period_name}"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📊 Close Summary: {period_name}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Total Tasks:*\n{stats['total_tasks']}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Completed:*\n{stats['completed_tasks']}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*In Progress:*\n{stats['in_progress_tasks']}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Completion:*\n{stats['completion_percentage']}%"
                    }
                ]
            }
        ]
        
        self.send_message(settings.slack_channel, text, blocks)


class NotificationService:
    """Helpers for persisting and dispatching in-app notifications."""

    @staticmethod
    def create_notification(
        db: Session,
        *,
        user_id: int,
        title: str,
        message: str,
        notification_type: str,
        link_url: Optional[str] = None,
        commit: bool = False
    ) -> NotificationModel:
        notification = NotificationModel(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            link_url=link_url,
        )
        db.add(notification)
        if commit:
            db.commit()
            db.refresh(notification)
        return notification


# Service instances
email_service = EmailService()
slack_service = SlackService()

