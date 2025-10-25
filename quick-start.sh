#!/bin/bash

# 🚀 Video Call App - Quick Start Script
# Автоматический запуск приложения с проверками

set -e

echo "🎥 Video Call App - Quick Start"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Check configuration
echo -e "${BLUE}📋 Step 1/5: Checking configuration...${NC}"
if [ -f "scripts/check-config.sh" ]; then
    bash scripts/check-config.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Configuration check failed. Please fix errors and try again.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Configuration check script not found, skipping...${NC}"
fi

echo ""
echo -e "${BLUE}📦 Step 2/5: Stopping existing containers...${NC}"
docker-compose down 2>/dev/null || true
echo -e "${GREEN}✅ Containers stopped${NC}"

echo ""
echo -e "${BLUE}🔨 Step 3/5: Building containers...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✅ Containers built${NC}"

echo ""
echo -e "${BLUE}🚀 Step 4/5: Starting services...${NC}"
docker-compose up -d

echo ""
echo -e "${BLUE}⏳ Step 5/5: Waiting for services to be ready...${NC}"
echo "   This may take 30-60 seconds..."

# Wait for services
sleep 10

# Check service health
MAX_ATTEMPTS=30
ATTEMPT=0

check_service() {
    local service=$1
    local url=$2
    local name=$3
    
    echo -n "   Checking $name... "
    
    for i in $(seq 1 $MAX_ATTEMPTS); do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅${NC}"
            return 0
        fi
        sleep 2
    done
    
    echo -e "${RED}❌ Failed${NC}"
    return 1
}

# Check all services
SERVICES_OK=true

check_service "streaming-node" "http://localhost:8080/health" "SFU Server" || SERVICES_OK=false
check_service "backend" "http://localhost:8000/api/health/" "Backend API" || SERVICES_OK=false
check_service "nginx" "http://localhost/health/" "Nginx" || SERVICES_OK=false

echo ""
if [ "$SERVICES_OK" = true ]; then
    echo "================================================"
    echo -e "${GREEN}✅ Video Call App is running!${NC}"
    echo "================================================"
    echo ""
    echo "🌐 Access the application:"
    echo "   Frontend:  http://localhost"
    echo "   Backend:   http://localhost/api"
    echo "   Admin:     http://localhost/admin"
    echo ""
    echo "🎥 SFU Server:"
    echo "   Health:    http://localhost:8080/health"
    echo "   API:       http://localhost:8080/api"
    echo ""
    echo "📊 View logs:"
    echo "   All:       docker-compose logs -f"
    echo "   Backend:   docker-compose logs -f backend"
    echo "   SFU:       docker-compose logs -f streaming-node"
    echo "   Frontend:  docker-compose logs -f frontend"
    echo ""
    echo "🛑 Stop application:"
    echo "   docker-compose down"
    echo ""
    echo -e "${GREEN}🎉 Ready to use!${NC}"
else
    echo "================================================"
    echo -e "${RED}❌ Some services failed to start${NC}"
    echo "================================================"
    echo ""
    echo "🔍 Check logs for details:"
    echo "   docker-compose logs"
    echo ""
    echo "🔧 Common issues:"
    echo "   1. Ports already in use (check with: netstat -tuln | grep -E '80|443|8080')"
    echo "   2. Docker resources insufficient (increase Docker memory limit)"
    echo "   3. Configuration errors (check .env file)"
    echo ""
    echo "📚 See TROUBLESHOOTING_GUIDE.md for more help"
    exit 1
fi
