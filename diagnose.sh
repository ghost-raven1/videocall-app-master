#!/bin/bash

# Скрипт для диагностики проблемы со статическими файлами

echo "🔍 Diagnosing static files issue..."

# 1. Проверяем статус контейнеров
echo "📊 Container status:"
docker-compose ps

echo ""

# 2. Проверяем статические файлы в backend
echo "📦 Static files in backend container:"
if docker-compose exec backend ls -la /staticfiles/admin/css/ 2>/dev/null | head -5; then
    echo "✅ Backend has static files"
else
    echo "❌ Backend missing static files"
fi

echo ""

# 3. Проверяем статические файлы в nginx
echo "🌐 Static files in nginx container:"
if docker-compose exec nginx ls -la /staticfiles/admin/css/ 2>/dev/null | head -5; then
    echo "✅ Nginx has static files"
else
    echo "❌ Nginx missing static files"
fi

echo ""

# 4. Проверяем права доступа
echo "🔐 Permissions in nginx:"
docker-compose exec nginx ls -la /staticfiles/ 2>/dev/null | head -3

echo ""

# 5. Проверяем nginx конфигурацию
echo "⚙️ Nginx static files configuration:"
docker-compose exec nginx cat /etc/nginx/nginx.conf 2>/dev/null | grep -A 5 "location /static/"

echo ""

# 6. Проверяем HTTP доступ
echo "🌐 HTTP test:"
if curl -I http://localhost/static/admin/css/base.css 2>/dev/null | head -2; then
    echo "✅ HTTP access works"
else
    echo "❌ HTTP access failed"
fi

echo ""
echo "🔍 Diagnosis complete!"
