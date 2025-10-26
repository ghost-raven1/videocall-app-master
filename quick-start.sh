#!/usr/bin/env bash
# ============================================================
# 🎥 Video Call App - Quick Start Script
# Автоматическая установка и запуск в режиме dev/prod
# Поддержка macOS и Linux (Ubuntu/Debian)
# ============================================================

# ======== Проверка окружения ========
if [ -z "$BASH_VERSION" ]; then
  echo "❌ Этот скрипт должен запускаться через bash."
  echo "👉 Попробуй: bash $0"
  exit 1
fi

set -e  # останавливать при ошибках

# ======== Цвета ========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ======== ASCII-Арт ========
clear
echo -e "${BLUE}"
cat <<'EOF'
 __     ___     _      ___       _ _        _             
 \ \   / (_)___| |__  / _ \ _ __(_) |_ __ _| | _____ _ __ 
  \ \ / /| / __| '_ \| | | | '__| | __/ _` | |/ / _ \ '__|
   \ V / | \__ \ | | | |_| | |  | | || (_| |   <  __/ |   
    \_/  |_|___/_| |_|\___/|_|  |_|\__\__,_|_|\_\___|_|   
                                                          
           🎥  Video Call App - Quick Start 🚀
EOF
echo -e "${NC}"
echo "=============================================="
echo ""

# ======== Определяем ОС ========
IS_MACOS=false
if [[ "$(uname)" == "Darwin" ]]; then
  IS_MACOS=true
  echo -e "🍎 Обнаружена macOS — запуск в режиме локальной разработки"
else
  echo -e "🌐 Обнаружена Linux-система — запуск в продакшн режиме"
fi

echo ""

# ======== Step 1: Проверка зависимостей ========
echo -e "${BLUE}📋 Step 1/11: Проверка зависимостей...${NC}"

REQUIRED_TOOLS=("docker" "docker-compose" "curl")
if [ "$IS_MACOS" = false ]; then
  REQUIRED_TOOLS+=("sudo")
fi

for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "$tool" &>/dev/null; then
    echo -e "${RED}❌ Не найдено: $tool${NC}"
    echo "Установите его перед продолжением."
    exit 1
  fi
done

echo -e "${GREEN}✅ Все зависимости установлены${NC}"
echo ""

# ======== Step 2: Остановка старых контейнеров ========
echo -e "${BLUE}📦 Step 2/11: Остановка предыдущих контейнеров...${NC}"
docker-compose down >/dev/null 2>&1 || true
echo -e "${GREEN}✅ Контейнеры остановлены${NC}"
echo ""

# ======== Step 3: Сборка контейнеров ========
echo -e "${BLUE}🔨 Step 3/11: Сборка контейнеров...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✅ Контейнеры собраны${NC}"
echo ""

# ======== Step 4: Настройка Nginx ========
echo -e "${BLUE}⚙️ Step 4/11: Настройка Nginx...${NC}"
if [ "$IS_MACOS" = true ]; then
  sed -i.bak 's|^      - ./nginx.conf:/etc/nginx/nginx.conf:ro|      # - ./nginx.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
  sed -i.bak 's|^      # - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|      - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
  echo -e "   🔧 Используется локальная конфигурация nginx-local.conf"
else
  sed -i.bak 's|^      # - ./nginx.conf:/etc/nginx/nginx.conf:ro|      - ./nginx.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
  sed -i.bak 's|^      - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|      # - ./nginx-local.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml
  echo -e "   🔧 Используется продакшн конфигурация nginx.conf"
fi
echo ""

# ======== Step 5: Запуск сервисов ========
echo -e "${BLUE}🚀 Step 5/11: Запуск контейнеров...${NC}"
docker-compose up -d
echo -e "${GREEN}✅ Контейнеры запущены${NC}"
echo ""

# ======== Step 6: Применение миграций ========
echo -e "${BLUE}⏳ Step 6/11: Применение миграций...${NC}"
sleep 10
if docker-compose exec -T backend python manage.py migrate --noinput >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Миграции применены${NC}"
else
  echo -e "${YELLOW}⚠️ Ошибка при миграциях, повтор через 10 сек...${NC}"
  sleep 10
  docker-compose exec -T backend python manage.py migrate --noinput || echo -e "${RED}❌ Миграции не применены${NC}"
fi
echo ""

# ======== Step 7: Проверка сервисов ========
echo -e "${BLUE}🔍 Step 7/11: Проверка доступности сервисов...${NC}"
SERVICES_OK=true
for svc in \
  "Backend API|http://localhost:8000/api/health/" \
  "SFU Server|http://localhost:8080/health" \
  "Nginx|http://localhost/health/"
do
  name=${svc%%|*}
  url=${svc##*|}
  echo -n "   Проверка $name... "
  if curl -fs "$url" >/dev/null; then
    echo -e "${GREEN}✅${NC}"
  else
    echo -e "${RED}❌${NC}"
    SERVICES_OK=false
  fi
done
echo ""

# ======== Step 8: Создание суперпользователя ========
echo -e "${BLUE}👤 Step 8/11: Создание администратора...${NC}"
docker-compose exec -T backend python manage.py shell -c "
from apps.authentication.models import User;
email='admin@example.com'; password='password123';
User.objects.create_superuser(email=email, password=password) if not User.objects.filter(email=email).exists() else print('Admin уже существует')
"
echo -e "${GREEN}✅ Администратор готов (admin@example.com / password123)${NC}"
echo ""

# ======== Step 9: Настройка SSL ========
DOMAIN="video-call-ghost.ru"
echo -e "${BLUE}🔒 Step 9/11: Настройка SSL для ${GREEN}${DOMAIN}${NC}"
if [ "$IS_MACOS" = true ]; then
  echo -e "${YELLOW}⚠️ macOS режим — SSL пропускается (локальная разработка)${NC}"
else
  if ! command -v certbot &>/dev/null; then
    echo -e "${BLUE}📦 Установка certbot...${NC}"
    sudo apt update && sudo apt install certbot python3-certbot-nginx -y
  fi
  sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || \
  echo -e "${YELLOW}⚠️ Не удалось получить сертификат автоматически. Проверь домен и DNS.${NC}"
fi
echo ""

# ======== Step 10: Проверка production окружения ========
echo -e "${BLUE}✅ Step 10/11: Проверка production окружения...${NC}"
sleep 10
if curl -fs "https://$DOMAIN/health/" >/dev/null; then
  echo -e "${GREEN}✅ Production работает корректно${NC}"
else
  echo -e "${YELLOW}⚠️ Production пока не отвечает. Проверь docker-compose и nginx.${NC}"
fi
echo ""

# ======== Step 11: Завершение ========
echo -e "${BLUE}🎉 Step 11/11: Установка завершена!${NC}"
echo "=============================================="
echo -e "${GREEN}✅ Video Call App готов к использованию!${NC}"
echo "🌐 Frontend:  http://localhost"
echo "🌐 Backend:   http://localhost/api"
echo "🌐 Admin:     http://localhost/admin"
echo "🌐 Production: https://${DOMAIN}"
echo ""
echo -e "${BLUE}🛑 Остановить: docker-compose down${NC}"
echo -e "${BLUE}📜 Логи: docker-compose logs -f${NC}"
echo ""
echo -e "${GREEN}🚀 Приятного общения! 🎥${NC}"
