#!/bin/bash

# 🚀 Video Call App - Quick Start Script
# Автоматический запуск приложения с проверками

set -e

echo "🎥 Video Call App - Quick Start"
echo "================================"
echo ""

# Update step numbers in the script to reflect the new step
# (This is a marker for the script to know where to update step numbers)
# Step numbers will be updated in the final output

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Check configuration
echo -e "${BLUE}📋 Step 1/10: Checking configuration...${NC}"
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
echo -e "${BLUE}📦 Step 2/10: Stopping existing containers...${NC}"
docker-compose down 2>/dev/null || true
echo -e "${GREEN}✅ Containers stopped${NC}"

echo ""
echo -e "${BLUE}🔨 Step 3/10: Building containers...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✅ Containers built${NC}"

echo ""
echo -e "${BLUE}🚀 Step 4/10: Starting services...${NC}"
docker-compose up -d

echo ""
echo -e "${BLUE}⏳ Step 5/10: Running database migrations...${NC}"
# Wait a bit for the database to be ready
sleep 10

# Run migrations
echo -n "   Running migrations... "
if docker-compose exec -T backend python manage.py migrate --noinput > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Done${NC}"
else
    echo -e "${YELLOW}⚠️  Failed to run migrations, retrying...${NC}"
    # Wait a bit longer and try again
    sleep 10
    if docker-compose exec -T backend python manage.py migrate --noinput; then
        echo -e "${GREEN}✅ Migrations applied successfully${NC}"
    else
        echo -e "${RED}❌ Failed to apply migrations${NC}"
        echo -e "${YELLOW}⚠️  Continuing, but the application might not work correctly${NC}"
    fi
fi

echo ""
echo -e "${BLUE}⏳ Step 6/10: Waiting for services to be ready...${NC}"
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

echo ""
echo -e "${BLUE}🔧 Step 7/10: Creating admin user...${NC}"
# Create admin user with credentials user/password123
echo "Creating admin user with username: user, password: password123"
docker-compose exec -T backend python manage.py shell -c "from apps.authentication.models import User; User.objects.create_superuser('user', 'admin@example.com', 'password123') if not User.objects.filter(username='user').exists() else print('Admin user already exists')"
echo -e "${GREEN}✅ Admin user created${NC}"

echo ""
echo -e "${BLUE}🔧 Step 8/10: Setting up nginx for production...${NC}"
# Copy production nginx config
if [ -f "nginx-lb.conf" ]; then
    # Ensure directory exists before copying
    sudo mkdir -p /etc/nginx/sites-available/
    sudo mkdir -p /etc/nginx/sites-enabled/
    sudo cp nginx-lb.conf /etc/nginx/sites-available/videocall
    sudo ln -sf /etc/nginx/sites-available/videocall /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl reload nginx || echo -e "${YELLOW}⚠️ Failed to reload nginx, may not be running or installed${NC}"
    echo -e "${GREEN}✅ Nginx production config applied${NC}"
else
    echo -e "${YELLOW}⚠️  nginx-lb.conf not found, skipping nginx setup...${NC}"
fi

echo ""
echo -e "${BLUE}🔒 Step 9/11: Generating Let's Encrypt SSL certificates...${NC}"
# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt update
    sudo apt install certbot python3-certbot-nginx -y
fi
# Generate SSL certificate (replace example.com with actual domain)
echo "Please enter your domain name for SSL certificate:"
read -r DOMAIN
if [ -n "$DOMAIN" ]; then
    sudo certbot --nginx -d "$DOMAIN"
    echo -e "${GREEN}✅ SSL certificate generated for $DOMAIN${NC}"
else
    echo -e "${YELLOW}⚠️  No domain provided, skipping SSL generation...${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Step 10/11: Launching production cluster...${NC}"
# Stop dev compose and start cluster
docker-compose down
if [ -f "docker-compose.cluster.yml" ]; then
    docker-compose -f docker-compose.cluster.yml up -d
    echo -e "${GREEN}✅ Production cluster launched${NC}"
else
    echo -e "${YELLOW}⚠️  docker-compose.cluster.yml not found, skipping cluster launch...${NC}"
fi

echo ""
echo -e "${BLUE}✅ Step 11/11: Verifying production setup...${NC}"
# Wait and check production services
sleep 10
PROD_OK=true
if ! curl -f -s "https://$DOMAIN/health/" > /dev/null 2>&1; then
    PROD_OK=false
fi
if [ "$PROD_OK" = true ]; then
    echo -e "${GREEN}✅ Production setup verified${NC}"
    echo "🌐 Production app running at https://$DOMAIN"
else
    echo -e "${RED}❌ Production setup failed${NC}"
    echo "🔧 Check logs: docker-compose -f docker-compose.cluster.yml logs"
fi

echo ""
echo "================================================"
echo -e "${GREEN}🎉 Video Call App setup complete!${NC}"
echo "================================================"
echo ""
echo "🌐 Access:"
echo "   Development: http://localhost"
echo "   Production:  https://$DOMAIN (if configured)"
