#!/bin/bash

# Тестирование nginx конфигурации для статических файлов

echo "🔍 Testing nginx configuration for static files..."

# 1. Проверяем nginx конфигурацию
echo "📋 Nginx static files configuration:"
grep -A 10 "location /static/" nginx.conf

echo ""

# 2. Проверяем, что статические файлы есть локально
echo "📁 Local static files:"
if [ -d "backend/staticfiles/admin/css" ]; then
    echo "✅ Local static files exist"
    echo "📊 CSS files:"
    ls -la backend/staticfiles/admin/css/ | head -5
    echo ""
    echo "📊 JS files:"
    ls -la backend/staticfiles/admin/js/ | head -5
else
    echo "❌ Local static files missing"
fi

echo ""

# 3. Проверяем nginx конфигурацию на предмет проблем
echo "🔍 Checking nginx configuration for issues:"

# Проверяем alias
if grep -q "alias /staticfiles/" nginx.conf; then
    echo "✅ Static files alias configured correctly"
else
    echo "❌ Static files alias not configured"
fi

# Проверяем try_files
if grep -q "try_files" nginx.conf; then
    echo "✅ try_files directive present"
else
    echo "❌ try_files directive missing"
fi

# Проверяем expires
if grep -q "expires" nginx.conf; then
    echo "✅ expires directive present"
else
    echo "❌ expires directive missing"
fi

echo ""

# 4. Проверяем, есть ли проблемы с путями
echo "🔍 Checking for path issues:"

# Проверяем, что nginx.conf использует правильный путь
if grep -q "alias /staticfiles/" nginx.conf; then
    echo "✅ nginx.conf uses /staticfiles/ alias"
else
    echo "❌ nginx.conf doesn't use /staticfiles/ alias"
fi

# Проверяем, что в docker-compose.yml volume смонтирован правильно
if grep -q "static_volume:/staticfiles" docker-compose.yml; then
    echo "✅ docker-compose.yml mounts static_volume to /staticfiles"
else
    echo "❌ docker-compose.yml doesn't mount static_volume to /staticfiles"
fi

echo ""
echo "🔍 Configuration test complete!"
