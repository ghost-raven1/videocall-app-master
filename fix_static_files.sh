#!/bin/bash

# Скрипт для исправления проблемы со статическими файлами
# Копирует статические файлы в nginx контейнер

echo "🔧 Fixing static files issue..."

# 1. Собираем статические файлы локально
echo "📦 Collecting static files locally..."
cd backend

# Создаем временные настройки если их нет
if [ ! -f "temp_settings.py" ]; then
    echo "📝 Creating temporary settings..."
    cat > temp_settings.py << 'EOF'
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

SECRET_KEY = 'temp-secret-key-for-static-collection'
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1']

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'corsheaders',
    'channels',
    'django_ratelimit',
]

LOCAL_APPS = [
    'apps.core',
    'apps.rooms',
    'apps.authentication',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'videocall_app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'videocall_app.wsgi.application'
ASGI_APPLICATION = 'videocall_app.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_DIRS = []
if (BASE_DIR / 'static').exists():
    STATICFILES_DIRS.append(BASE_DIR / 'static')

STATICFILES_FINDERS = [
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
]

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True

ALLOWED_HOSTS_INCLUDE_WEBSOCKET = True

RATELIMIT_USE_CACHE = 'default'
RATELIMIT_ENABLE = True

ROOM_EXPIRY_HOURS = 24
MAX_PARTICIPANTS_PER_ROOM = 100
SHORT_CODE_LENGTH = 6
EOF
fi

# Собираем статические файлы
python3 manage.py collectstatic --noinput --clear --settings=temp_settings

cd ..

# 2. Проверяем, что статические файлы собраны
if [ ! -f "backend/staticfiles/admin/css/base.css" ]; then
    echo "❌ Failed to collect static files"
    exit 1
fi

echo "✅ Static files collected successfully"

# 3. Если Docker доступен, копируем файлы в контейнер
if command -v docker &> /dev/null; then
    echo "🐳 Copying static files to nginx container..."
    
    # Проверяем, запущен ли nginx контейнер
    if docker-compose ps nginx | grep -q "Up"; then
        # Копируем статические файлы в nginx контейнер
        docker cp backend/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/
        echo "✅ Static files copied to nginx container"
        
        # Проверяем результат
        echo "📊 Checking admin CSS files in container:"
        docker-compose exec nginx ls -la /staticfiles/admin/css/ | head -5
    else
        echo "⚠️  Nginx container is not running"
        echo "💡 Run: docker-compose up -d nginx"
    fi
else
    echo "⚠️  Docker not available, static files collected locally only"
fi

echo ""
echo "🔍 Test URLs:"
echo "  - http://localhost/static/admin/css/base.css"
echo "  - https://video-call-ghost.ru/static/admin/css/base.css"
echo ""
echo "✅ Fix complete!"
