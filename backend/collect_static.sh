#!/bin/bash

# Скрипт для сбора статических файлов Django
# Используется в Docker контейнере

echo "🚀 Starting static files collection..."

# Создаем директорию staticfiles если её нет
mkdir -p /staticfiles

# Устанавливаем переменные окружения для сбора статических файлов
export SECRET_KEY=${SECRET_KEY:-"temp-secret-key-for-static-collection"}
export DEBUG=${DEBUG:-"False"}
export ALLOWED_HOSTS=${ALLOWED_HOSTS:-"localhost,127.0.0.1"}

# Выполняем миграции (если нужно)
echo "📊 Running database migrations..."
python manage.py migrate --noinput

# Собираем статические файлы
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput --clear

# Устанавливаем правильные права доступа
echo "🔧 Setting permissions..."
chown -R 1000:1000 /staticfiles 2>/dev/null || true
chmod -R 755 /staticfiles 2>/dev/null || true

echo "✅ Static files collection complete!"
echo "📁 Static files location: /staticfiles"
ls -la /staticfiles/admin/css/ | head -10
