from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.config import settings
from backend.database import engine, Base
from backend.routers import (
    auth,
    users,
    periods,
    tasks,
    files,
    approvals,
    comments,
    dashboard,
    reports,
    trial_balance,
    task_templates,
    notifications,
    search,
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Self-hosted month-end close management application"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(periods.router)
app.include_router(tasks.router)
app.include_router(files.router)
app.include_router(approvals.router)
app.include_router(comments.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(trial_balance.router)
app.include_router(task_templates.router)
app.include_router(notifications.router)
app.include_router(search.router)

# Mount static files
if os.path.exists(settings.file_storage_path):
    app.mount("/files", StaticFiles(directory=settings.file_storage_path), name="files")


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "operational",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=settings.debug)

