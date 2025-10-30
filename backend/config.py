from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://monthend_user:password@localhost:5432/monthend_db"
    
    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Application
    app_name: str = "Month-End Close Manager"
    app_version: str = "1.0.0"
    debug: bool = True
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"
    
    # File Storage
    file_storage_path: str = "./files"
    max_file_size_mb: int = 50
    
    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@monthend.local"
    
    # Slack
    slack_bot_token: str = ""
    slack_channel: str = "#finance-close"
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # Timezone
    tz: str = "America/New_York"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]


settings = Settings()

# Ensure file storage directory exists
os.makedirs(settings.file_storage_path, exist_ok=True)

