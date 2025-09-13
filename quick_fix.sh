#!/bin/bash

# Быстрое исправление 404 ошибок для статических файлов

echo "🔧 Quick fix for static files 404 errors..."

# 1. Проверяем статус контейнеров
echo "📊 Checking container status..."
docker-compose ps

# 2. Собираем статические файлы в backend
echo "📦 Collecting static files in backend container..."
docker-compose exec backend python manage.py collectstatic --noinput --clear

# 3. Копируем файлы в nginx
echo "📁 Copying static files to nginx container..."
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/

# 4. Перезапускаем nginx
echo "🔄 Restarting nginx..."
docker-compose restart nginx

# 5. Проверяем результат
echo "✅ Fix complete!"
echo "🔍 Test URLs:"
echo "  - http://localhost/static/admin/css/base.css"
echo "  - https://video-call-ghost.ru/static/admin/css/base.css"
