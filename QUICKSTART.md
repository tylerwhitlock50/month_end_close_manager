# Quick Start Guide

Get the Month-End Close Manager running in 5 minutes!

## Windows (Recommended for Your Setup)

### Prerequisites
1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Ensure Docker Desktop is running

### Setup (One-time)

1. **Open PowerShell in the project directory**
```powershell
cd C:\Users\tylerw\month_end
```

2. **Run the setup script**
```powershell
.\setup.ps1
```

That's it! The script will:
- ✅ Check Docker installation
- ✅ Create necessary files and directories
- ✅ Build Docker containers
- ✅ Start all services (database, backend, frontend)
- ✅ Initialize the database with sample data

### Access the Application

After setup completes (2-3 minutes):

- **Web Application**: http://localhost:5173
- **API Documentation**: http://localhost:8000/docs
- **Backend API**: http://localhost:8000

### Login

Use these credentials to sign in:
- **Email**: `admin@monthend.com`
- **Password**: `admin123`

## Common Commands

### Start the application
```powershell
docker-compose up -d
```

### Stop the application
```powershell
docker-compose down
```

### View logs
```powershell
docker-compose logs -f
```

### Restart services
```powershell
docker-compose restart
```

### Reset database
```powershell
docker-compose exec backend python init_db.py --reset --seed
```

## Alternative: Local Development (Without Docker)

If you prefer running without Docker:

### Backend

1. **Install Python 3.11+** and PostgreSQL

2. **Create virtual environment**
```powershell
python -m venv venv
venv\Scripts\activate
```

3. **Install dependencies**
```powershell
pip install -r requirements.txt
```

4. **Set up database**
- Install PostgreSQL
- Create database: `monthend_db`
- Update `DATABASE_URL` in `.env`

5. **Initialize database**
```powershell
python init_db.py --seed
```

6. **Run backend**
```powershell
uvicorn backend.main:app --reload
```

### Frontend

1. **Install Node.js 20+**

2. **Install dependencies**
```powershell
cd frontend
npm install
```

3. **Run frontend**
```powershell
npm run dev
```

## Next Steps

1. **Change default password**
   - Login with admin credentials
   - Go to Settings → Security
   - Update password

2. **Create your first period**
   - Navigate to Periods
   - Click "New Period"
   - Fill in details and roll forward tasks from templates

3. **Invite team members**
   - Go to Users
   - Click "Add User"
   - Set appropriate roles (Admin, Reviewer, Preparer)

4. **Configure notifications** (optional)
   - Edit `.env` file
   - Add SMTP settings for email
   - Add Slack token for Slack notifications
   - Restart services: `docker-compose restart`

5. **Import your trial balance**
   - Go to **Trial Balance** and select either *Standard CSV* or *NetSuite Export*
   - Upload the current period file; the summary panel will confirm totals and metadata
   - Review the "What's New" banner and the prior-period comparison columns to spot variances immediately

## Troubleshooting

### Port already in use
If ports 5173, 8000, or 5432 are already in use:
```powershell
# Find and stop the conflicting process
netstat -ano | findstr :5173
# Or change ports in docker-compose.yml
```

### Database connection errors
```powershell
# Check if database is running
docker-compose ps

# View database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

### Frontend not loading
```powershell
# Rebuild frontend container
docker-compose up -d --build frontend

# Check frontend logs
docker-compose logs frontend
```

### Reset everything
```powershell
# Stop and remove all containers
docker-compose down -v

# Rebuild and start
.\setup.ps1
```

## Production Deployment

See [README.md](README.md) for detailed production deployment instructions.

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review [README.md](README.md)
3. Contact your finance systems team

