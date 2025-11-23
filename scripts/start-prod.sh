#!/bin/bash
# scripts/start-prod.sh - Start application in production mode

set -e

echo "🚀 Starting VideoCall App in PRODUCTION mode..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env not found. Creating from .env.prod.example..."
    if [ -f .env.prod.example ]; then
        cp .env.prod.example .env
        echo "✅ Created .env from example"
        echo ""
        echo "⚠️  CRITICAL: Please update .env with:"
        echo "   1. Generate secure SECRET_KEY"
        echo "   2. Generate secure JWT_SECRET"
        echo "   3. Set strong POSTGRES_PASSWORD"
        echo "   4. Set strong ADMIN_PASSWORD"
        echo "   5. Update ALLOWED_HOSTS with your domain"
        echo "   6. Update CORS_ALLOWED_ORIGINS with your domain"
        echo "   7. Update SERVER_ALLOWED_ORIGINS with your domain"
        echo ""
        echo "   Run: scripts/generate-secrets.sh to generate secrets"
        echo ""
        read -p "Press Enter after updating .env to continue..."
    else
        echo "❌ .env.prod.example not found. Please create .env manually."
        exit 1
    fi
fi

# Validate critical settings
echo "🔍 Validating configuration..."

# Check SECRET_KEY
if grep -q "CHANGE-THIS" .env || grep -q "dev-secret-key" .env; then
    echo "❌ ERROR: SECRET_KEY not configured. Please generate a secure key."
    echo "   Run: python3 -c \"import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))\""
    exit 1
fi

# Check JWT_SECRET
if grep -q "CHANGE-THIS" .env || grep -q "dev-jwt-secret" .env; then
    echo "❌ ERROR: JWT_SECRET not configured. Please generate a secure key."
    echo "   Run: python3 -c \"import secrets; print('JWT_SECRET=' + secrets.token_hex(32))\""
    exit 1
fi

# Check DEBUG
if grep -q "DEBUG=True" .env; then
    echo "⚠️  WARNING: DEBUG is set to True in production. This is not recommended."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
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

# Run configuration check script if exists
if [ -f scripts/check-config.sh ]; then
    echo "🔍 Running configuration checks..."
    bash scripts/check-config.sh
fi

# Start services
echo "📦 Starting Docker containers..."
docker-compose -f docker-compose.prod.yml up --build -d

echo ""
echo "✅ Production environment started!"
echo ""
echo "📍 Services:"
echo "   - Application: https://your-domain.com (update in .env)"
echo "   - Health check: http://localhost/health/"
echo ""
echo "📊 View logs:"
echo "   docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose -f docker-compose.prod.yml down"
echo ""
echo "⚠️  Remember to:"
echo "   1. Set up SSL certificates (Let's Encrypt)"
echo "   2. Configure firewall rules"
echo "   3. Set up monitoring"
echo "   4. Configure backups"
echo ""

