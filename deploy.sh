#!/bin/bash

# Полный скрипт развертывания с исправлением статических файлов

echo "🚀 Starting full deployment..."

# 1. Останавливаем контейнеры
echo "🛑 Stopping containers..."
docker-compose down

# 2. Пропускаем локальный сбор статических файлов
echo "📦 Skipping local static files collection (will use Docker containers)..."

# 3. Запускаем контейнеры
echo "🐳 Starting containers..."
docker-compose up -d

# 4. Ждем запуска
echo "⏳ Waiting for containers to start..."
sleep 20

# 5. Собираем статические файлы в backend контейнере
echo "📦 Collecting static files in backend container..."
docker-compose exec backend python manage.py collectstatic --noinput --clear

# 6. Проверяем, что статические файлы собраны
echo "🔍 Checking static files in backend container..."
docker-compose exec backend ls -la /staticfiles/admin/css/ | head -5

# 7. Копируем статические файлы в nginx
echo "📁 Copying static files to nginx container..."
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/
echo "✅ Static files copied to nginx container"

# 8. Проверяем результат в nginx
echo "📊 Checking static files in nginx container..."
docker-compose exec nginx ls -la /staticfiles/admin/css/ | head -5

# 9. Перезапускаем nginx
echo "🔄 Restarting nginx..."
docker-compose restart nginx
echo "✅ Nginx restarted"

# 10. Проверяем результат
echo "🔍 Checking deployment..."
echo "📊 Container status:"
docker-compose ps

echo ""
echo "🔍 Test URLs:"
echo "  - http://localhost/static/admin/css/base.css"
echo "  - https://video-call-ghost.ru/static/admin/css/base.css"

echo ""
echo "✅ Deployment complete!"
