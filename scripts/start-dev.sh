#!/bin/bash
# scripts/start-dev.sh - Start application in development mode

set -e

echo "🚀 Starting VideoCall App in DEVELOPMENT mode..."
echo ""

# Check if .env.dev exists
if [ ! -f .env.dev ]; then
    echo "⚠️  .env.dev not found. Creating from .env.dev.example..."
    if [ -f .env.dev.example ]; then
        cp .env.dev.example .env.dev
        echo "✅ Created .env.dev from example"
        echo "⚠️  Please review and update .env.dev with your settings"
    else
        echo "❌ .env.dev.example not found. Please create .env.dev manually."
        exit 1
    fi
fi

# Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Start services
echo "📦 Starting Docker containers..."
docker-compose -f docker-compose.dev.yml up --build -d

echo ""
echo "✅ Development environment started!"
echo ""
echo "📍 Services available at:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000"
echo "   - Django Admin: http://localhost:8000/admin"
echo "   - SFU: http://localhost:8080"
echo "   - Nginx: http://localhost"
echo ""
echo "📊 View logs:"
echo "   docker-compose -f docker-compose.dev.yml logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose -f docker-compose.dev.yml down"
echo ""

