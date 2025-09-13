#!/bin/bash

# Скрипт для тестирования статических файлов

echo "🧪 Testing static files..."

# Проверяем локальные статические файлы
if [ -d "backend/staticfiles" ]; then
    echo "✅ Local static files found:"
    ls -la backend/staticfiles/admin/css/ | head -5
else
    echo "❌ Local static files not found"
fi

# Проверяем через Docker (если доступен)
if command -v docker &> /dev/null; then
    echo ""
    echo "🐳 Testing Docker static files..."
    
    # Проверяем, запущен ли контейнер
    if docker-compose ps | grep -q "backend.*Up"; then
        echo "✅ Backend container is running"
        echo "📁 Static files in container:"
        docker-compose exec backend ls -la /staticfiles/admin/css/ | head -5
        
        echo ""
        echo "🌐 Testing HTTP access:"
        echo "Testing base.css..."
        curl -I http://localhost/static/admin/css/base.css 2>/dev/null | head -2
    else
        echo "❌ Backend container is not running"
        echo "💡 Run: docker-compose up -d"
    fi
else
    echo "❌ Docker not available"
fi

echo ""
echo "🔍 Manual test URLs:"
echo "  - http://localhost/static/admin/css/base.css"
echo "  - http://localhost/static/admin/css/forms.css"
echo "  - http://localhost/static/admin/css/login.css"
