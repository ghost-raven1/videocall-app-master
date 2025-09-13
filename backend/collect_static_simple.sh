#!/bin/bash

# Упрощенный скрипт для сбора статических файлов Django
# Работает без базы данных, используя временные настройки

echo "🚀 Starting simple static files collection..."

# Создаем директорию staticfiles если её нет
mkdir -p /staticfiles

# Устанавливаем переменные окружения
export SECRET_KEY=${SECRET_KEY:-"temp-secret-key-for-static-collection"}
export DEBUG=${DEBUG:-"False"}
export ALLOWED_HOSTS=${ALLOWED_HOSTS:-"localhost,127.0.0.1"}

# Собираем статические файлы используя временные настройки
echo "📦 Collecting static files with temporary settings..."
python manage.py collectstatic --noinput --clear --settings=temp_settings

# Устанавливаем правильные права доступа
echo "🔧 Setting permissions..."
chown -R 1000:1000 /staticfiles 2>/dev/null || true
chmod -R 755 /staticfiles 2>/dev/null || true

echo "✅ Simple static files collection complete!"
echo "📁 Static files location: /staticfiles"
echo "📋 Admin CSS files:"
ls -la /staticfiles/admin/css/ | head -5
