#!/bin/bash

# Скрипт для исправления уже запущенных контейнеров

echo "🔧 Fixing running containers..."

# 1. Проверяем, что контейнеры запущены
echo "📊 Checking container status..."
docker-compose ps

# 2. Собираем статические файлы в backend контейнере
echo "📦 Collecting static files in backend container..."
docker-compose exec backend python manage.py collectstatic --noinput --clear

# 3. Проверяем, что статические файлы собраны
echo "🔍 Checking static files in backend container..."
docker-compose exec backend ls -la /staticfiles/admin/css/ | head -5

# 4. Копируем статические файлы в nginx
echo "📁 Copying static files to nginx container..."
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/
echo "✅ Static files copied to nginx container"

# 5. Проверяем результат в nginx
echo "📊 Checking static files in nginx container..."
docker-compose exec nginx ls -la /staticfiles/admin/css/ | head -5

# 6. Перезапускаем nginx
echo "🔄 Restarting nginx..."
docker-compose restart nginx
echo "✅ Nginx restarted"

# 7. Проверяем результат
echo "🔍 Testing static files..."
echo "📊 Container status:"
docker-compose ps

echo ""
echo "🔍 Test URLs:"
echo "  - http://localhost/static/admin/css/base.css"
echo "  - https://video-call-ghost.ru/static/admin/css/base.css"

echo ""
echo "✅ Fix complete!"
