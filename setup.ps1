# Month-End Close Manager Setup Script for Windows
# This script helps set up the application quickly

Write-Host "🚀 Month-End Close Manager Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "⚠️  Please edit .env file with your configuration" -ForegroundColor Yellow
    Write-Host ""
}

# Create files directory
Write-Host "📁 Creating files directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path files | Out-Null
Write-Host ""

# Build and start containers
Write-Host "🐳 Building Docker containers..." -ForegroundColor Cyan
docker-compose build
Write-Host ""

Write-Host "🚀 Starting services..." -ForegroundColor Cyan
docker-compose up -d
Write-Host ""

# Wait for database to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host ""

# Initialize database
Write-Host "🗄️  Initializing database..." -ForegroundColor Cyan
docker-compose exec -T backend python init_db.py --seed
Write-Host ""

Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Access the application:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173"
Write-Host "   Backend API: http://localhost:8000"
Write-Host "   API Docs: http://localhost:8000/docs"
Write-Host ""
Write-Host "🔐 Default login credentials:" -ForegroundColor Yellow
Write-Host "   Email: admin@monthend.local"
Write-Host "   Password: admin123"
Write-Host ""
Write-Host "⚠️  Remember to:" -ForegroundColor Yellow
Write-Host "   1. Change the default password after first login"
Write-Host "   2. Update SECRET_KEY in .env for production"
Write-Host "   3. Configure email/Slack if needed"
Write-Host ""
Write-Host "🎉 Happy closing!" -ForegroundColor Green

