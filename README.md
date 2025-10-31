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

### Trial Balance Imports & Comparisons

- Open **Trial Balance** and choose between **Standard CSV** and the new **NetSuite Export** mode. NetSuite mode parses the native NetSuite trial balance export (no manual column mapping required) and stores import metadata for review.
- After an import, the page surfaces a **What's New This Period** banner highlighting new accounts, items without linked tasks, and entries still awaiting verification.
- The accounts grid now shows **prior-period balances and deltas**. Click **Manage** on any row to see the previous period's files and comments directly inside the task modal for quick comparisons.
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

This project includes comprehensive API tests using PyTest to ensure all endpoints work correctly and return the expected data types.

### Test Structure

```
backend/tests/
├── conftest.py                    # Shared fixtures and test configuration
├── test_auth.py                   # Authentication endpoint tests
├── test_users.py                  # User management tests
├── test_periods.py                # Period management tests
├── test_tasks.py                  # Task management tests
├── test_files.py                  # File upload/download tests
├── test_dashboard.py              # Dashboard endpoint tests
├── test_remaining_routers.py      # Tests for approvals, comments, etc.
└── test_task_activity.py          # Existing task activity tests
```

### Running Tests

#### Quick Start (Docker - Recommended)

```bash
# Windows
run_tests.bat

# Linux/Mac
./run_tests.sh --docker

# With coverage report
./run_tests.sh --docker --coverage

# Run specific test file
./run_tests.sh --docker --file backend/tests/test_auth.py

# Verbose output
./run_tests.sh --docker --verbose
```

#### Manual Docker Commands

```bash
# Start containers if not running
docker-compose up -d

# Run all tests
docker-compose exec backend pytest

# Run with coverage
docker-compose exec backend pytest --cov=backend --cov-report=term-missing

# Run specific test file
docker-compose exec backend pytest backend/tests/test_auth.py -v

# Run specific test class
docker-compose exec backend pytest backend/tests/test_users.py::TestGetUsers -v

# Run specific test method
docker-compose exec backend pytest backend/tests/test_auth.py::TestAuthLogin::test_login_success -v
```

#### Local Testing (Without Docker)

```bash
# Activate virtual environment
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Run all tests
pytest

# Run with coverage
pytest --cov=backend --cov-report=html

# Run specific tests
pytest backend/tests/test_auth.py -v
```

### Test Coverage

The test suite covers:

- ✅ **Authentication**: Login, registration, token validation
- ✅ **User Management**: CRUD operations, role-based access
- ✅ **Period Management**: Creation, updates, progress tracking
- ✅ **Task Management**: CRUD, bulk updates, dependencies, activity logs
- ✅ **File Management**: Upload, download, external links
- ✅ **Dashboard**: Statistics, review queues
- ✅ **Approvals**: Request, approve/reject workflow
- ✅ **Comments**: Add, update, delete comments
- ✅ **Notifications**: Create, mark as read
- ✅ **Task Templates**: Template management
- ✅ **Reports**: Task reports, period metrics

Target coverage: **80%+** for all routers

### Viewing Coverage Reports

After running tests with coverage:

```bash
# Coverage report is generated in backend/tests/coverage_html/
# Open in browser:

# Windows
start backend/tests/coverage_html/index.html

# Mac
open backend/tests/coverage_html/index.html

# Linux
xdg-open backend/tests/coverage_html/index.html
```

### API Documentation

For detailed endpoint documentation including:
- Expected request types (GET, POST, PUT, DELETE)
- Request body schemas
- Response formats
- Error codes
- Example requests/responses

See: **[API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md)**

### Common Issues

**Issue**: Tests fail with "no such table" error
```bash
# Solution: Ensure database is initialized
docker-compose exec backend python init_db.py
```

**Issue**: Import errors
```bash
# Solution: Install test dependencies
pip install -r requirements.txt
```

**Issue**: Container not running
```bash
# Solution: Start containers
docker-compose up -d
# Wait for services to be ready (check with docker-compose ps)
```

### Writing New Tests

When adding new endpoints or modifying existing ones:

1. Add tests to the appropriate test file
2. Use fixtures from `conftest.py` for database setup
3. Verify both success and error cases
4. Check response structure and data types
5. Run linter: `pytest --pylint`

Example test:
```python
def test_get_user_success(client: TestClient, sample_user: UserModel):
    """Should return specific user by ID"""
    response = client.get(f"/api/users/{sample_user.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == sample_user.id
    assert data["email"] == sample_user.email
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

