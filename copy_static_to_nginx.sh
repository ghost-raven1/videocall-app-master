#!/bin/bash

# Скрипт для копирования статических файлов в nginx контейнер
# Используется как fallback решение

echo "📦 Copying static files to nginx container..."

# Проверяем, запущен ли nginx контейнер
if ! docker-compose ps nginx | grep -q "Up"; then
    echo "❌ Nginx container is not running"
    echo "💡 Run: docker-compose up -d nginx"
    exit 1
fi

# Проверяем, есть ли статические файлы в backend
if [ ! -d "backend/staticfiles" ]; then
    echo "❌ Static files not found in backend/staticfiles"
    echo "💡 Run: cd backend && python manage.py collectstatic --noinput --settings=temp_settings"
    exit 1
fi

# Копируем статические файлы в nginx контейнер
echo "📁 Copying static files..."
docker cp backend/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/

# Проверяем результат
echo "✅ Static files copied to nginx container"
echo "📊 Checking admin CSS files:"
docker-compose exec nginx ls -la /staticfiles/admin/css/ | head -5

echo ""
echo "🌐 Test URLs:"
echo "  - http://localhost/static/admin/css/base.css"
echo "  - https://video-call-ghost.ru/static/admin/css/base.css"
