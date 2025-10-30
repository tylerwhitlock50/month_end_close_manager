# Month-End Close Manager

A self-hosted, lightweight month-end close management application that provides structure, transparency, and accountability across the finance team.

## 🎯 Features

### ✅ Task Management
- Templates per close cycle (monthly, quarterly, year-end)
- Task tracking with owner, due date, status, and dependencies
- Automatic task rollover for recurring close activities
- Kanban board and list views

### 📁 File Management
- Link local or cloud-stored supporting documents
- Age tracking for files with alerts
- Support for both uploaded files and external links (SharePoint, cloud storage)

### 🔄 Workflow & Approvals
- Assign reviewers/approvers per task
- Timestamped sign-off with notes
- Complete audit log for compliance

### 📊 Dashboards & Reporting
- Real-time close progress tracking
- Time-to-close metrics by period
- Export to CSV/PDF for management reporting
- Department and entity-level views

### 🔔 Notifications
- Email notifications for task assignments and approvals
- Slack integration for team updates
- Daily/weekly digest of open tasks

## 🛠️ Tech Stack

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React + TypeScript + Tailwind CSS
- **Auth**: JWT-based authentication with role-based access control
- **Deployment**: Docker + Docker Compose

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.11+ (for local development)
- Node.js 20+ (for local development)

### Option 1: Docker (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd month_end
```

2. **Create environment file**
```bash
cp .env.example .env
# Edit .env with your configurations
```

3. **Start the application**
```bash
docker-compose up -d
```

4. **Initialize the database**
```bash
docker-compose exec backend python init_db.py --seed
```

5. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

6. **Login with default credentials**
- Email: `admin@monthend.com`
- Password: `admin123`

### Option 2: Local Development

#### Backend Setup

1. **Create virtual environment**
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Set up PostgreSQL**
```bash
# Install PostgreSQL and create database
createdb monthend_db
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit DATABASE_URL and other settings
```

5. **Initialize database**
```bash
python init_db.py --seed
```

6. **Run backend server**
```bash
uvicorn backend.main:app --reload
```

#### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Run development server**
```bash
npm run dev
```

## 📖 User Guide

### User Roles

- **Admin**: Full access to all features, user management, system configuration
- **Reviewer**: Can approve tasks, view all tasks, manage periods
- **Preparer**: Can create and update assigned tasks, upload files
- **Viewer**: Read-only access to tasks and reports

### Creating a New Close Period

1. Navigate to **Periods** page
2. Click **New Period**
3. Fill in period details (name, month, year, close type)
4. Choose to roll forward tasks from templates
5. Click **Create**

### Managing Tasks

1. Navigate to **Tasks** page
2. Switch between **Board View** (Kanban) and **List View**
3. Filter by period or department
4. Click **New Task** to create a task manually
5. Drag tasks between columns in Board View to change status
6. Click on a task to view details, add files, or request approvals

### Uploading Files

1. Open a task
2. Click **Add File**
3. Choose to upload a file or link an external URL
4. Add description and file date
5. Files older than 30 days will be flagged for review

### Requesting Approvals

1. Open a task
2. Click **Request Approval**
3. Select reviewer
4. Add notes (optional)
5. Reviewer will be notified via email/Slack

### Generating Reports

1. Navigate to **Reports** page
2. Select period (or leave blank for all)
3. Click **Export CSV** or **Export PDF**
4. View period metrics and analytics

## 🔧 Configuration

### Email Notifications

Configure in `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@monthend.local
```

### Slack Integration

1. Create a Slack App and Bot
2. Add Bot to your workspace
3. Configure in `.env`:
```env
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL=#finance-close
```

### File Storage

Files are stored locally by default in `./files` directory. Configure path in `.env`:
```env
FILE_STORAGE_PATH=./files
MAX_FILE_SIZE_MB=50
```

## 🗄️ Database Schema

### Key Tables

- **users**: User accounts and roles
- **periods**: Close periods (monthly, quarterly, year-end)
- **tasks**: Individual close tasks
- **task_templates**: Reusable task templates
- **files**: Uploaded files and external links
- **approvals**: Task approval workflow
- **audit_logs**: Complete audit trail
- **notifications**: Email/Slack notifications

## 📊 API Documentation

Interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

- `POST /api/auth/login` - Authenticate user
- `GET /api/tasks/` - List tasks with filters
- `POST /api/tasks/` - Create new task
- `PUT /api/tasks/{id}` - Update task
- `GET /api/periods/` - List periods
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/reports/tasks` - Task reports

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- SQL injection protection via SQLAlchemy ORM
- CORS configuration for frontend access
- Environment-based secrets management

## 🚢 Deployment

### Production Deployment (DigitalOcean/AWS/Azure)

1. **Set up server** (Ubuntu 22.04 recommended)

2. **Install Docker**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

3. **Clone repository**
```bash
git clone <repository-url>
cd month_end
```

4. **Configure production environment**
```bash
cp .env.example .env
nano .env
# Set strong SECRET_KEY, database credentials, etc.
```

5. **Build and start containers**
```bash
docker-compose up -d --build
```

6. **Initialize database**
```bash
docker-compose exec backend python init_db.py --seed
```

7. **Set up reverse proxy (Nginx)**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

8. **Set up SSL with Let's Encrypt**
```bash
certbot --nginx -d your-domain.com
```

## 🧪 Testing

Run backend tests:
```bash
pytest
```

## 📝 License

This project is proprietary and confidential.

## 🤝 Contributing

Internal team contributions only. Please follow the standard PR process.

## 📞 Support

For issues or questions, contact the finance systems team.

## 🔮 Future Enhancements

- NetSuite API integration for auto-status updates
- AI document matching for reconciliation support
- Advanced analytics and bottleneck detection
- Mobile app for task management on-the-go
- Multi-entity consolidation workflows

