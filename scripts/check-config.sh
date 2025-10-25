#!/bin/bash

# 🔍 Video Call App - Configuration Check Script
# Проверяет корректность конфигурации перед запуском

set -e

echo "🔍 Checking Video Call App Configuration..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check if .env file exists
echo "📋 Checking environment configuration..."
if [ ! -f .env ]; then
    echo -e "${RED}❌ ERROR: .env file not found${NC}"
    echo "   Run: cp env.example .env"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Check critical environment variables
    source .env
    
    # Check SECRET_KEY
    if [ -z "$SECRET_KEY" ] || [ "$SECRET_KEY" == "your-super-secret-django-key-generate-a-unique-one-for-production" ]; then
        echo -e "${RED}❌ ERROR: SECRET_KEY not set or using default value${NC}"
        echo "   Generate new key: python -c \"import secrets; print(secrets.token_urlsafe(50))\""
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ SECRET_KEY is configured${NC}"
    fi
    
    # Check JWT_SECRET
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" == "924de940a2d438a0f48ab01a3067e02ab101f015ad92e5f274a8e659a8e86b1a" ]; then
        echo -e "${YELLOW}⚠️  WARNING: JWT_SECRET using default value${NC}"
        echo "   Generate new key: python -c \"import secrets; print(secrets.token_hex(32))\""
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ JWT_SECRET is configured${NC}"
    fi
    
    # Check POSTGRES_PASSWORD
    if [ -z "$POSTGRES_PASSWORD" ]; then
        echo -e "${RED}❌ ERROR: POSTGRES_PASSWORD not set${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ POSTGRES_PASSWORD is set${NC}"
    fi
    
    # Check ADMIN_PASSWORD
    if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" == "your-secure-admin-password-here-change-immediately-in-production" ]; then
        echo -e "${YELLOW}⚠️  WARNING: ADMIN_PASSWORD not set or using default${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ ADMIN_PASSWORD is configured${NC}"
    fi
    
    # Check SFU configuration
    if [ -z "$SFU_HOST" ]; then
        echo -e "${YELLOW}⚠️  WARNING: SFU_HOST not set, using default 'streaming-node'${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ SFU_HOST is configured: $SFU_HOST${NC}"
    fi
fi

echo ""
echo "🐳 Checking Docker environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ ERROR: Docker is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Docker is installed: $(docker --version)${NC}"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ ERROR: Docker Compose is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Docker Compose is installed: $(docker-compose --version)${NC}"
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ ERROR: Docker daemon is not running${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Docker daemon is running${NC}"
fi

echo ""
echo "📁 Checking project structure..."

# Check if required directories exist
REQUIRED_DIRS=("backend" "videocall-frontend" "streaming-node" "scripts")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${RED}❌ ERROR: Directory '$dir' not found${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ Directory '$dir' exists${NC}"
    fi
done

# Check if required files exist
REQUIRED_FILES=("docker-compose.yml" "nginx.conf" "env.example")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ ERROR: File '$file' not found${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ File '$file' exists${NC}"
    fi
done

echo ""
echo "🔧 Checking docker-compose.yml..."

# Validate docker-compose.yml syntax
if docker-compose config &> /dev/null; then
    echo -e "${GREEN}✅ docker-compose.yml syntax is valid${NC}"
    
    # Check if streaming-node service exists
    if docker-compose config | grep -q "streaming-node:"; then
        echo -e "${GREEN}✅ streaming-node service is configured${NC}"
    else
        echo -e "${RED}❌ ERROR: streaming-node service not found in docker-compose.yml${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ ERROR: docker-compose.yml has syntax errors${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "🌐 Checking network ports..."

# Check if required ports are available
REQUIRED_PORTS=(80 443 8080 5432 6379)
for port in "${REQUIRED_PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  WARNING: Port $port is already in use${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
    fi
done

echo ""
echo "================================================"
echo "📊 Configuration Check Summary"
echo "================================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Configuration is ready.${NC}"
    echo ""
    echo "🚀 You can now start the application:"
    echo "   docker-compose up --build -d"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration has $WARNINGS warning(s) but can proceed.${NC}"
    echo ""
    echo "🚀 You can start the application, but consider fixing warnings:"
    echo "   docker-compose up --build -d"
    exit 0
else
    echo -e "${RED}❌ Configuration has $ERRORS error(s) and $WARNINGS warning(s).${NC}"
    echo ""
    echo "🛠️  Please fix the errors before starting the application."
    exit 1
fi
