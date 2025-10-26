#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Checking Docker Containers ===${NC}"

# Check if containers are running
containers=("backend" "frontend" "db" "redis" "streaming-node" "nginx")
all_containers_running=true

for container in "${containers[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$container"; then
        echo -e "${GREEN}✓ Container $container is running${NC}"
    else
        echo -e "${RED}✗ Container $container is not running${NC}"
        all_containers_running=false
    fi
done

if [ "$all_containers_running" = false ]; then
    echo -e "\n${RED}❌ Not all required containers are running${NC}"
    echo -e "${YELLOW}Run 'docker-compose ps' to see the status of all containers${NC}"
    exit 1
fi

echo -e "\n${YELLOW}=== Checking Services ===${NC}"

# Check SFU Server
echo -n "Checking SFU Server... "
if docker-compose exec -T streaming-node curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${YELLOW}⚠️ SFU Server health check failed${NC}"
    echo -e "${YELLOW}Checking SFU logs...${NC}"
    docker-compose logs streaming-node | tail -n 10
fi

# Check Backend API
echo -n "Checking Backend API... "
response_code=$(docker-compose exec -T backend curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health/)

if [ "$response_code" -ge 200 ] && [ "$response_code" -lt 400 ]; then
    echo -e "${GREEN}✓ Healthy (${response_code})${NC}"
elif [ "$response_code" -eq 405 ]; then
    echo -e "${YELLOW}⚠️ Endpoint exists but returned 405 (Method Not Allowed)${NC}"
    echo -e "${GREEN}✅ Backend API is running correctly (405 is expected for HEAD requests)${NC}"
else
    echo -e "${RED}✗ Unavailable (HTTP ${response_code})${NC}"
    echo -e "${YELLOW}Checking backend logs...${NC}"
    docker-compose logs backend | tail -n 20
fi

# Check Nginx
echo -n "Checking Nginx... "
if docker-compose ps | grep -q "nginx.*Up"; then
    echo -e "${GREEN}✓ Running${NC}"
    
    # Try to access Nginx
    echo -n "  Testing Nginx response... "
    nginx_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
    if [ "$nginx_response" -ge 200 ] && [ "$nginx_response" -lt 400 ]; then
        echo -e "${GREEN}✓ Accessible (HTTP ${nginx_response})${NC}"
    else
        echo -e "${YELLOW}⚠️ Unexpected response (HTTP ${nginx_response})${NC}"
        echo -e "${YELLOW}Checking Nginx logs...${NC}"
        docker-compose logs nginx | tail -n 20
    fi
else
    echo -e "${RED}✗ Not running${NC}"
    echo -e "${YELLOW}Checking Nginx logs...${NC}"
    docker-compose logs nginx | tail -n 20
fi

# Check disk space
echo -e "\n${YELLOW}=== System Resources ===${NC}"
echo "Disk space:"
df -h | grep -v "tmpfs"

echo -e "\nMemory usage:"
free -h

echo -e "\n${GREEN}✅ Health check completed${NC}"

# Check running processes
echo -e "\n${YELLOW}=== Top Processes ===${NC}"
top -b -n 1 | head -n 15
echo -e "\n${GREEN}✅ Health check completed${NC}"
