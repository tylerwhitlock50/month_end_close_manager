#!/bin/bash

# Month-End Close Manager Setup Script
# This script helps set up the application quickly

set -e

echo "🚀 Month-End Close Manager Setup"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
    echo ""
fi

# Create files directory
echo "📁 Creating files directory..."
mkdir -p files
echo ""

# Build and start containers
echo "🐳 Building Docker containers..."
docker-compose build
echo ""

echo "🚀 Starting services..."
docker-compose up -d
echo ""

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10
echo ""

# Initialize database
echo "🗄️  Initializing database..."
docker-compose exec -T backend python init_db.py --seed
echo ""

echo "✅ Setup complete!"
echo ""
echo "📊 Access the application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "🔐 Default login credentials:"
echo "   Email: admin@monthend.local"
echo "   Password: admin123"
echo ""
echo "⚠️  Remember to:"
echo "   1. Change the default password after first login"
echo "   2. Update SECRET_KEY in .env for production"
echo "   3. Configure email/Slack if needed"
echo ""
echo "🎉 Happy closing!"

