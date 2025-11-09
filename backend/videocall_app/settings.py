# videocall_app/settings.py - Django main settings configuration
import os
from decouple import config
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Security settings - SECRET_KEY is required for production security
SECRET_KEY = config('SECRET_KEY')

# Validate SECRET_KEY is properly configured and secure
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required.")

# Check for weak/insecure SECRET_KEY patterns
insecure_patterns = [
    'your-secret-key-here',
    'change-in-production',
    'your-super-secret',
    'django-insecure',
    'test-key',
    'example',
    '123456',
    'password',
    'secret'
]

if any(pattern in SECRET_KEY.lower() for pattern in insecure_patterns):
    raise ValueError(
        "SECRET_KEY contains insecure patterns. "
        "Please generate a secure secret key using: python -c \"import secrets; print(secrets.token_urlsafe(50))\""
    )

# Validate SECRET_KEY length (minimum 50 characters for security)
if len(SECRET_KEY) < 50:
    raise ValueError(
        f"SECRET_KEY is too short ({len(SECRET_KEY)} chars). "
        "Minimum length is 50 characters for security."
    )
DEBUG = config('DEBUG', default=False, cast=bool)

# ALLOWED_HOSTS - только ваши настоящие домены
allowed_hosts_default = 'video-call-ghost.ru,www.video-call-ghost.ru,localhost,127.0.0.1'
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default=allowed_hosts_default).split(',')

# Убираем пустые строки и пробелы
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS if host.strip()]

# В DEBUG режиме разрешаем localhost для разработки
if DEBUG:
    ALLOWED_HOSTS.extend(['localhost', '127.0.0.1', '0.0.0.0'])

# Application definition
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

# Use custom User model from apps.authentication
AUTH_USER_MODEL = 'authentication.User'

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

# Database configuration
# Use PostgreSQL in production, SQLite for development
USE_POSTGRESQL = config('USE_POSTGRESQL', default=not DEBUG, cast=bool)

# Database URL configuration for production deployments (e.g., Heroku, Railway, etc.)
DATABASE_URL = config('DATABASE_URL', default=None)

if DATABASE_URL:
    # Use database URL if provided (modern cloud deployment standard)
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=60 if not DEBUG else 0,
            conn_health_checks=True,
        )
    }
elif USE_POSTGRESQL:
    # Production PostgreSQL configuration
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='videocall_db'),
            'USER': config('DB_USER', default='postgres'),
            'PASSWORD': config('DB_PASSWORD', default=config('POSTGRES_PASSWORD', default='')),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
            # Production optimizations
            'OPTIONS': {
                'connect_timeout': 10,
                'application_name': 'videocall_app',
            },
            # Connection pooling for production
            'CONN_MAX_AGE': 60 if not DEBUG else 0,
            'CONN_HEALTH_CHECKS': True,
        }
    }
else:
    # Development SQLite configuration
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Redis configuration
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')

# Channels configuration for WebSockets
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
        },
    },
}

# Cache configuration with fallback for development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'development_cache',
    }
}

# Use Redis in production only
if not DEBUG:
    CACHES['default'] = {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }

# Session configuration with fallback
SESSION_ENGINE = 'django.contrib.sessions.backends.db'  # Use database sessions when Redis is unavailable
SESSION_COOKIE_AGE = 86400  # 24 hours
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG  # Use secure cookies in production
SESSION_COOKIE_SAMESITE = 'Lax'

# CSRF Configuration (disabled for JWT)
CSRF_COOKIE_HTTPONLY = True  # Prevent XSS access to CSRF token
CSRF_COOKIE_SECURE = not DEBUG  # Use secure cookies in production
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

if not DEBUG:
    # Add your production domains
    CSRF_TRUSTED_ORIGINS.extend([
        'https://video-call-ghost.ru',
        'https://www.video-call-ghost.ru',
    ])

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.authentication.authentication.CookieJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [],  # Disable throttling in development
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'admin': '5000/hour'
    }
}

# Enable throttling in production only
if not DEBUG:
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ]

# JWT Configuration
from datetime import timedelta

JWT_CONFIG = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# JWT Cookie Settings for httpOnly storage
JWT_COOKIE_SETTINGS = {
    'ACCESS_TOKEN_COOKIE_NAME': 'access_token',
    'REFRESH_TOKEN_COOKIE_NAME': 'refresh_token',
    'ACCESS_TOKEN_COOKIE_HTTPONLY': True,  # Prevent XSS attacks
    'REFRESH_TOKEN_COOKIE_HTTPONLY': True,  # Prevent XSS attacks
    'ACCESS_TOKEN_COOKIE_SECURE': not DEBUG,  # HTTPS only in production
    'REFRESH_TOKEN_COOKIE_SECURE': not DEBUG,  # HTTPS only in production
    'ACCESS_TOKEN_COOKIE_SAMESITE': 'Lax',  # CSRF protection
    'REFRESH_TOKEN_COOKIE_SAMESITE': 'Lax',  # CSRF protection
    'ACCESS_TOKEN_COOKIE_PATH': '/',
    'REFRESH_TOKEN_COOKIE_PATH': '/',
}

# Simple JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': JWT_CONFIG['ACCESS_TOKEN_LIFETIME'],
    'REFRESH_TOKEN_LIFETIME': JWT_CONFIG['REFRESH_TOKEN_LIFETIME'],
    'ROTATE_REFRESH_TOKENS': JWT_CONFIG['ROTATE_REFRESH_TOKENS'],
    'BLACKLIST_AFTER_ROTATION': JWT_CONFIG['BLACKLIST_AFTER_ROTATION'],
    'UPDATE_LAST_LOGIN': True,

    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,

    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',

    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# CORS settings - Enhanced security configuration
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'
).split(',')

# Clean up origins and remove empty entries
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS if origin.strip()]

# Add SFU server to allowed origins
CORS_ALLOWED_ORIGINS.extend([
    'http://streaming-node:8080',
    'http://streaming-node',
])

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Only in development - SECURITY RISK: Disable in production

# Enhanced CORS settings for production security
if not DEBUG:
    # In production, be explicit about allowed origins
    CORS_ALLOWED_ORIGINS_ENV = config('CORS_ALLOWED_ORIGINS', default='').split(',')
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_ENV if origin.strip()]
    CORS_ALLOW_ALL_ORIGINS = False

# CORS security enhancements
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-api-key',
]

# Additional CORS security settings
CORS_EXPOSE_HEADERS = [
    'content-length',
    'x-pagination-count',
    'x-pagination-page',
    'x-pagination-limit',
]

CORS_PREFLIGHT_MAX_AGE = 86400  # 24 hours

# WebSocket configuration
ASGI_APPLICATION = 'videocall_app.asgi.application'

# Channel layer configuration for WebSockets
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [("redis", 6379)],
        },
    },
}

# WebSocket origins for Channels
ALLOWED_HOSTS_INCLUDE_WEBSOCKET = True

# Add SFU server to ALLOWED_HOSTS
ALLOWED_HOSTS.extend([
    'streaming-node',
    'streaming-node:8080',
])

# Additional CORS headers for development
if DEBUG:
    CORS_ALLOW_HEADERS = [
        'accept',
        'accept-encoding',
        'authorization',
        'content-type',
        'dnt',
        'origin',
        'user-agent',
        'x-csrftoken',
        'x-requested-with',
    ]

# Django Ratelimit settings - Enhanced security configuration
RATELIMIT_USE_CACHE = 'default'
RATELIMIT_ENABLE = not DEBUG  # Enable ratelimit in production
RATELIMIT_FAIL_OPEN = False  # Block requests when cache fails (more secure)

# Enhanced rate limiting configuration
RATELIMIT_IP_META_KEY = lambda request: request.META.get('HTTP_X_FORWARDED_FOR') or request.META.get('REMOTE_ADDR')
RATELIMIT_STORE = 'django_ratelimit.store.CacheStore'

# Custom rate limit settings for different endpoints
RATELIMIT_VIEW = 'django_ratelimit.views.wrap_view_with_rate_limit'

# В файле backend/videocall_app/settings.py замените секцию LOGGING на:

# Logging configuration
import os

# Создаем директорию для логов если её нет
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {name}: {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': LOGS_DIR / 'django.log',
            'formatter': 'verbose',
        } if os.access(LOGS_DIR, os.W_OK) else {
            # Fallback to console if can't write to file
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.authentication': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.rooms': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Additional locations of static files
STATICFILES_DIRS = []
if (BASE_DIR / 'static').exists():
    STATICFILES_DIRS.append(BASE_DIR / 'static')

# Static files finders
STATICFILES_FINDERS = [
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
]

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Application-specific settings
ROOM_EXPIRY_HOURS = 24
MAX_PARTICIPANTS_PER_ROOM = 50  # Enterprise: Increased from 15 to 50
SHORT_CODE_LENGTH = 6

# SFU (Selective Forwarding Unit) Configuration
SFU_HOST = config('SFU_HOST', default='localhost')
SFU_PORT = config('SFU_PORT', default='8080', cast=int)
SFU_API_BASE_URL = f'http://{SFU_HOST}:{SFU_PORT}/api'
SFU_WS_BASE_URL = f'ws://{SFU_HOST}:{SFU_PORT}/ws'

# Enforce correct SFU host configuration in production (no localhost)
if not DEBUG and SFU_HOST in ('localhost', '127.0.0.1'):
    raise ValueError(
        "SFU_HOST misconfigured for production: 'localhost' is not allowed. "
        "Set SFU_HOST to your SFU service name or domain."
    )

# SFU Room settings
SFU_ROOM_TIMEOUT_MINUTES = 30
SFU_HEALTH_CHECK_INTERVAL = 30  # seconds

# WebSocket settings for SFU communication
SFU_WS_PING_INTERVAL = 20  # seconds
SFU_WS_TIMEOUT = 10  # seconds

# Enhanced room settings for multi-user support
ROOM_SETTINGS = {
    'max_participants': MAX_PARTICIPANTS_PER_ROOM,
    'enable_sfu': True,
    'sfu_required_threshold': 3,  # Use SFU when more than this number of participants
    'fallback_to_p2p': True,  # Allow fallback to P2P for 2-3 participants
    'enable_recording': config('ENABLE_RECORDING', default=False, cast=bool),  # Enterprise: Recording feature
}

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Enhanced security settings for production
if not DEBUG:
    # Trust proxy headers from nginx/reverse proxy
    USE_X_FORWARDED_HOST = True
    USE_X_FORWARDED_PORT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    # Security headers and middleware settings
    SECURE_SSL_REDIRECT = False  # Handled by reverse proxy (nginx)
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_PRELOAD = True

    # Session and CSRF cookie security
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Strict'

    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = True
    CSRF_COOKIE_SAMESITE = 'Strict'

    # Additional security headers
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'

    # Content Security Policy (basic)
    CSP_DEFAULT_SRC = ("'self'",)
    CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "'unsafe-eval'")  # Review and tighten for production
    CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
    CSP_IMG_SRC = ("'self'", "data:", "https:")
    CSP_FONT_SRC = ("'self'",)
    CSP_CONNECT_SRC = ("'self'",)
    CSP_MEDIA_SRC = ("'self'",)
    CSP_OBJECT_SRC = ("'none'",)
    CSP_BASE_URI = ("'self'",)
    CSP_FORM_ACTION = ("'self'",)
    CSP_FRAME_ANCESTORS = ("'none'",)

    # Permissions Policy (formerly Feature Policy)
    PERMISSIONS_POLICY = {
        'camera': 'self',
        'microphone': 'self',
        'geolocation': 'none',
        'payment': 'none',
        'usb': 'none',
    }

    # File upload restrictions
    FILE_UPLOAD_MAX_MEMORY_SIZE = 2621440  # 2.5 MB
    DATA_UPLOAD_MAX_MEMORY_SIZE = 2621440  # 2.5 MB

    # Admin security
    ADMIN_COOKIE_SECURE = True
    ADMIN_COOKIE_HTTPONLY = True

# Enterprise SSO/LDAP Configuration
ENABLE_LDAP = config('ENABLE_LDAP', default=False, cast=bool)
ENABLE_SAML = config('ENABLE_SAML', default=False, cast=bool)
ENABLE_OAUTH = config('ENABLE_OAUTH', default=False, cast=bool)

# LDAP Settings (if enabled)
if ENABLE_LDAP:
    AUTH_LDAP_SERVER_URI = config('LDAP_SERVER_URI', default='ldap://localhost')
    AUTH_LDAP_BIND_DN = config('LDAP_BIND_DN', default='')
    AUTH_LDAP_BIND_PASSWORD = config('LDAP_BIND_PASSWORD', default='')

# Recording Settings
RECORDING_STORAGE_PATH = config('RECORDING_STORAGE_PATH', default='recordings/')
RECORDING_MAX_DURATION = config('RECORDING_MAX_DURATION', default=7200, cast=int)  # 2 hours
RECORDING_FORMAT = config('RECORDING_FORMAT', default='webm')
