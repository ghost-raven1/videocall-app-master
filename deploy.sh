#!/bin/bash

# Полный скрипт развертывания с исправлением статических файлов

echo "🚀 Starting full deployment..."

# 1. Останавливаем контейнеры
echo "🛑 Stopping containers..."
docker-compose down

# 2. Собираем статические файлы
echo "📦 Collecting static files..."
./setup_static_files.sh

# 3. Запускаем контейнеры
echo "🐳 Starting containers..."
docker-compose up -d

# 4. Ждем запуска
echo "⏳ Waiting for containers to start..."
sleep 15

# 5. Копируем статические файлы в nginx
echo "📁 Copying static files to nginx..."
if docker-compose ps nginx | grep -q "Up"; then
    docker cp backend/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/
    echo "✅ Static files copied to nginx container"
    
    # Перезапускаем nginx
    echo "🔄 Restarting nginx..."
    docker-compose restart nginx
    echo "✅ Nginx restarted"
else
    echo "❌ Nginx container is not running"
fi

# 6. Проверяем результат
echo "🔍 Checking deployment..."
echo "📊 Container status:"
docker-compose ps

echo ""
echo "📊 Static files in nginx:"
docker-compose exec nginx ls -la /staticfiles/admin/css/ | head -5

echo ""
echo "🔍 Test URLs:"
echo "  - http://localhost/static/admin/css/base.css"
echo "  - https://video-call-ghost.ru/static/admin/css/base.css"

echo ""
echo "✅ Deployment complete!"
