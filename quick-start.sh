#!/bin/bash

# 🚀 Video Call App - Quick Start Script
# Автоматический запуск приложения с проверками

set -e

echo "🎥 Video Call App - Quick Start"
echo "================================"
echo ""

# Определение операционной системы
IS_MACOS=false
if [[ "$(uname)" == "Darwin" ]]; then
    IS_MACOS=true
    echo -e "🍎 Обнаружена macOS - запуск в режиме локальной разработки"
else
    echo -e "🌐 Обнаружена не-macOS система - запуск в продакшн режиме с доменом и сертификатами"
fi

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
echo -e "${BLUE}🚀 Step 4/10: Настройка конфигурации и запуск сервисов...${NC}"

# Настройка конфигурации Nginx в зависимости от ОС
if [ "$IS_MACOS" = true ]; then
    # Для macOS используем локальную конфигурацию
    sed -i.bak 's|^      - ./nginx.conf:/etc/nginx/nginx.conf:ro|      # - ./nginx.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
    sed -i.bak 's|^      # - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|      - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
    echo -e "   🔧 Настроена локальная конфигурация Nginx для macOS"
else
    # Для других ОС используем продакшн конфигурацию с доменом
    sed -i.bak 's|^      # - ./nginx.conf:/etc/nginx/nginx.conf:ro|      - ./nginx.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
    sed -i.bak 's|^      - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|      # - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
    echo -e "   🔧 Настроена продакшн конфигурация Nginx с поддержкой домена"
fi

# Запуск сервисов
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
# Create admin user with credentials admin@example.com/password123
echo "Creating admin user with email: admin@example.com, password: password123"
docker-compose exec -T backend python manage.py shell -c "from apps.authentication.models import User; email='admin@example.com'; password='password123'; User.objects.create_superuser(email=email, password=password) if not User.objects.filter(email=email).exists() else print('Admin user already exists')"
echo -e "${GREEN}✅ Admin user created${NC}"

echo ""
echo -e "${BLUE}🔧 Step 8/10: Setting up nginx for production...${NC}"

# Пропускаем настройку Nginx на macOS
if [ "$IS_MACOS" = true ]; then
    echo -e "${YELLOW}⚠️ Пропуск настройки Nginx для macOS - используется Docker-контейнер${NC}"
else
    # Copy production nginx config
    if [ -f "nginx-lb.conf" ]; then
        echo -e "   Проверка прав для настройки Nginx..."
        
        # Проверяем, есть ли права sudo
        if command -v sudo >/dev/null 2>&1; then
            # Создаем директории с обработкой ошибок
            echo -e "   Создание директорий Nginx..."
            sudo mkdir -p /etc/nginx/sites-available/ || { echo -e "${YELLOW}⚠️ Не удалось создать директорию /etc/nginx/sites-available/${NC}"; }
            sudo mkdir -p /etc/nginx/sites-enabled/ || { echo -e "${YELLOW}⚠️ Не удалось создать директорию /etc/nginx/sites-enabled/${NC}"; }
            
            # Копируем конфигурацию с обработкой ошибок
            echo -e "   Копирование конфигурации Nginx..."
            sudo cp nginx.conf /etc/nginx/sites-available/videocall || { echo -e "${YELLOW}⚠️ Не удалось скопировать конфигурацию${NC}"; }
            
            # Создаем символическую ссылку с обработкой ошибок
            sudo ln -sf /etc/nginx/sites-available/videocall /etc/nginx/sites-enabled/ || { echo -e "${YELLOW}⚠️ Не удалось создать символическую ссылку${NC}"; }
            
            # Проверяем конфигурацию и перезагружаем Nginx
            echo -e "   Проверка и перезагрузка Nginx..."
            sudo nginx -t && sudo systemctl reload nginx || echo -e "${YELLOW}⚠️ Не удалось перезагрузить Nginx, возможно он не установлен или не запущен${NC}"
            
            echo -e "${GREEN}✅ Конфигурация Nginx применена${NC}"
        else
            echo -e "${YELLOW}⚠️ Команда sudo не найдена, пропуск настройки Nginx...${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Файл nginx-lb.conf не найден, пропуск настройки Nginx...${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🔒 Step 9/11: Настройка SSL сертификатов...${NC}"

# Автоматически устанавливаем домен
DOMAIN="video-call-ghost.ru"
echo -e "   Используем домен: ${GREEN}$DOMAIN${NC}"

# Пропускаем настройку SSL на macOS
if [ "$IS_MACOS" = true ]; then
    echo -e "${YELLOW}⚠️ Пропуск настройки SSL для macOS - используется локальная разработка${NC}"
else
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        echo "   Установка certbot..."
        sudo apt update || { echo -e "${YELLOW}⚠️ Не удалось обновить пакеты${NC}"; }
        sudo apt install certbot python3-certbot-nginx -y || { echo -e "${YELLOW}⚠️ Не удалось установить certbot${NC}"; }
    fi
    
    # Проверяем наличие sudo прав
    if command -v sudo >/dev/null 2>&1; then
        # Генерируем SSL сертификат
        echo -e "   Генерация SSL сертификата для $DOMAIN..."
        sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || { 
            echo -e "${YELLOW}⚠️ Не удалось сгенерировать SSL сертификат автоматически${NC}"
            echo -e "   Вы можете сгенерировать его вручную командой: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        }
    else
        echo -e "${YELLOW}⚠️ Команда sudo не найдена, пропуск генерации SSL...${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🚀 Step 10/11: Настройка рабочего окружения...${NC}"

# Пропускаем запуск кластера на macOS
if [ "$IS_MACOS" = true ]; then
    echo -e "${YELLOW}⚠️ Пропуск запуска production кластера для macOS - используется локальная разработка${NC}"
else
    # Спрашиваем пользователя, хочет ли он запустить production кластер
    echo -e "Хотите запустить production кластер? (y/n) [n]: "
    read -r LAUNCH_CLUSTER
    
    if [[ "$LAUNCH_CLUSTER" == "y" || "$LAUNCH_CLUSTER" == "Y" ]]; then
        # Stop dev compose and start cluster
        echo -e "   Останавливаем dev окружение и запускаем production кластер..."
        docker-compose down
        if [ -f "docker-compose.cluster.yml" ]; then
            docker-compose -f docker-compose.cluster.yml up -d
            echo -e "${GREEN}✅ Production кластер запущен${NC}"
        else
            echo -e "${YELLOW}⚠️ Файл docker-compose.cluster.yml не найден, пропуск запуска кластера...${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Пропуск запуска production кластера по выбору пользователя${NC}"
    fi
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
