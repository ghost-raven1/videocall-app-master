#!/bin/bash
# 🚀 Video Call App - Quick Start Script
# Автоматическая установка и запуск приложения с проверками и SSL

set -e

#########################################
# 🎨  ASCII-арт приветствие
#########################################
clear
echo -e "\033[1;34m"
cat <<'EOF'
 __     ___     _      ___       _ _        _             
 \ \   / (_)___| |__  / _ \ _ __(_) |_ __ _| | _____ _ __ 
  \ \ / /| / __| '_ \| | | | '__| | __/ _` | |/ / _ \ '__|
   \ V / | \__ \ | | | |_| | |  | | || (_| |   <  __/ |   
    \_/  |_|___/_| |_|\___/|_|  |_|\__\__,_|_|\_\___|_|   
                                                          
           🎥  Video Call App - Quick Start 🚀
EOF
echo -e "\033[0m"
echo "=============================================="
echo ""

#########################################
# 🧠 Определение ОС
#########################################
IS_MACOS=false
if [[ "$(uname)" == "Darwin" ]]; then
    IS_MACOS=true
    echo -e "🍎 Обнаружена macOS — запуск в режиме локальной разработки"
else
    echo -e "🌐 Обнаружена Linux-система — запуск в продакшн режиме"
fi
echo ""

#########################################
# 🎨 Цвета
#########################################
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#########################################
# ⚙️ Проверка зависимостей
#########################################
echo -e "${BLUE}📋 Step 1/11: Проверка зависимостей...${NC}"
DEPS=(docker curl sed)
for cmd in "${DEPS[@]}"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}❌ Не найдено: $cmd. Установите перед запуском.${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Все зависимости установлены${NC}"
echo ""

#########################################
# 🧱 Подготовка docker-compose
#########################################
DOCKER_COMPOSE=$(command -v docker-compose || echo "docker compose")

#########################################
# 🔍 Проверка конфигурации
#########################################
echo -e "${BLUE}📦 Step 2/11: Проверка конфигурации...${NC}"
if [ -f "scripts/check-config.sh" ]; then
    bash scripts/check-config.sh || {
        echo -e "${RED}❌ Ошибка конфигурации${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}⚠️  Скрипт проверки не найден, пропускаем...${NC}"
fi
echo ""

#########################################
# 🧹 Остановка старых контейнеров
#########################################
echo -e "${BLUE}🧹 Step 3/11: Остановка контейнеров...${NC}"
$DOCKER_COMPOSE down 2>/dev/null || true
echo -e "${GREEN}✅ Контейнеры остановлены${NC}"
echo ""

#########################################
# 🔨 Сборка контейнеров
#########################################
echo -e "${BLUE}🔨 Step 4/11: Сборка контейнеров...${NC}"
$DOCKER_COMPOSE build --no-cache
echo -e "${GREEN}✅ Контейнеры собраны${NC}"
echo ""

#########################################
# 🚀 Запуск сервисов
#########################################
echo -e "${BLUE}🚀 Step 5/11: Запуск сервисов...${NC}"
$DOCKER_COMPOSE up -d
echo -e "${GREEN}✅ Сервисы запущены${NC}"
echo ""

#########################################
# ⏳ Миграции базы данных
#########################################
echo -e "${BLUE}⏳ Step 6/11: Применение миграций...${NC}"
sleep 10
if $DOCKER_COMPOSE exec -T backend python manage.py migrate --noinput >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Миграции применены${NC}"
else
    echo -e "${YELLOW}⚠️ Повторная попытка...${NC}"
    sleep 10
    $DOCKER_COMPOSE exec -T backend python manage.py migrate --noinput || {
        echo -e "${RED}❌ Ошибка миграции${NC}"
    }
fi
echo ""

#########################################
# 🔎 Проверка здоровья сервисов
#########################################
echo -e "${BLUE}🔎 Step 7/11: Проверка сервисов...${NC}"

check_service() {
    local url=$1
    local name=$2
    echo -n "   Проверка $name... "
    for i in {1..30}; do
        if curl -fs "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅${NC}"
            return 0
        fi
        sleep 2
    done
    echo -e "${RED}❌${NC}"
    return 1
}

SERVICES_OK=true
check_service "http://localhost:8080/health" "SFU Server" || SERVICES_OK=false
check_service "http://localhost:8000/api/health/" "Backend API" || SERVICES_OK=false
check_service "http://localhost/health/" "Nginx" || SERVICES_OK=false

if [ "$SERVICES_OK" = true ]; then
    echo -e "${GREEN}✅ Все сервисы работают${NC}"
else
    echo -e "${RED}❌ Некоторые сервисы не запущены${NC}"
    echo -e "${YELLOW}📜 Проверьте: docker-compose logs${NC}"
fi
echo ""

#########################################
# 👑 Создание администратора
#########################################
echo -e "${BLUE}👑 Step 8/11: Создание администратора...${NC}"
$DOCKER_COMPOSE exec -T backend python manage.py shell -c "
from apps.authentication.models import User;
email='admin@example.com';
password='password123';
from django.db import IntegrityError
if not User.objects.filter(email=email).exists():
    User.objects.create_superuser(email=email, password=password)
    print('✅ Admin user создан')
else:
    print('⚠️ Admin уже существует')
"
echo ""

#########################################
# 🌐 Настройка Nginx
#########################################
echo -e "${BLUE}🌐 Step 9/11: Настройка Nginx...${NC}"

if [ "$IS_MACOS" = true ]; then
    echo -e "${YELLOW}⚠️ Пропуск настройки Nginx для macOS (Docker контейнер)${NC}"
else
    if command -v nginx >/dev/null 2>&1; then
        echo -e "   Проверка конфигурации Nginx..."
        if command -v sudo >/dev/null 2>&1; then
            sudo nginx -t && sudo systemctl reload nginx || echo -e "${YELLOW}⚠️ Не удалось перезагрузить Nginx${NC}"
        else
            nginx -t && nginx -s reload || echo -e "${YELLOW}⚠️ Не удалось перезапустить Nginx${NC}"
        fi
        echo -e "${GREEN}✅ Nginx настроен${NC}"
    else
        echo -e "${YELLOW}⚠️ Nginx не найден, пропуск...${NC}"
    fi
fi
echo ""

#########################################
# 🔒 SSL сертификаты
#########################################
echo -e "${BLUE}🔒 Step 10/11: Настройка SSL...${NC}"
DOMAIN="video-call-ghost.ru"
echo -e "   Используется домен: ${GREEN}$DOMAIN${NC}"

if [ "$IS_MACOS" = true ]; then
    echo -e "${YELLOW}⚠️ Пропуск SSL для macOS (локальная разработка)${NC}"
else
    if ! command -v certbot >/dev/null 2>&1; then
        echo -e "   Установка certbot..."
        sudo apt update -y && sudo apt install certbot python3-certbot-nginx -y || {
            echo -e "${RED}❌ Ошибка установки certbot${NC}"
        }
    fi
    echo -e "   Генерация SSL сертификата..."
    sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || {
        echo -e "${YELLOW}⚠️ Ошибка генерации SSL. Попробуйте вручную:${NC}"
        echo "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    }
fi
echo ""

#########################################
# 🏁 Финальная проверка
#########################################
echo -e "${BLUE}🏁 Step 11/11: Проверка продакшн окружения...${NC}"
sleep 10
if curl -fs "https://$DOMAIN/health/" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Production окружение работает!${NC}"
else
    echo -e "${YELLOW}⚠️ Не удалось подтвердить работу production сайта${NC}"
fi

#########################################
# 🎉 Финальный ASCII-арт
#########################################
echo -e "\033[1;32m"
cat <<'EOF'

====================================================
   🎉 Video Call App успешно установлен и запущен! 🎉
====================================================
🌐 Доступ:
   Разработка:  http://localhost
   Продакшн:    https://video-call-ghost.ru
====================================================
🛑 Остановить:
   docker-compose down
====================================================

EOF
echo -e "\033[0m"
