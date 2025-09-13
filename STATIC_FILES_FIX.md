# Исправление проблемы с 404 ошибками для статических файлов админки

## Проблема
При запуске приложения в Docker контейнере возникают 404 ошибки для CSS файлов админки Django:
- `https://video-call-ghost.ru/static/admin/css/base.css 404`
- Все статические файлы админки возвращают 404

## Причина
Статические файлы Django (включая CSS для админки) не собирались командой `collectstatic` или не были доступны в контейнере.

## Решение

### 1. Созданы скрипты для сбора статических файлов

#### `backend/collect_static.sh`
- Полный скрипт с миграциями базы данных
- Использует основные настройки Django

#### `backend/collect_static_simple.sh`
- Упрощенный скрипт без базы данных
- Использует временные настройки (`temp_settings.py`)
- Рекомендуется для использования в Docker

### 2. Создан файл временных настроек

#### `backend/temp_settings.py`
- Настройки Django с SQLite вместо PostgreSQL
- Позволяет собирать статические файлы без подключения к базе данных
- Включает все необходимые приложения

### 3. Обновлен Dockerfile

Добавлены скрипты для сбора статических файлов:
```dockerfile
# Копирование скриптов для сбора статических файлов
COPY collect_static.sh /usr/local/bin/collect_static.sh
COPY collect_static_simple.sh /usr/local/bin/collect_static_simple.sh
RUN chmod +x /usr/local/bin/collect_static.sh /usr/local/bin/collect_static_simple.sh
```

### 4. Обновлен docker-compose.yml

#### Сервис `static-init`:
- Использует упрощенный скрипт для сбора статических файлов
- Выполняется при инициализации контейнера

#### Сервис `backend`:
- Дополнительно собирает статические файлы при запуске
- Гарантирует наличие статических файлов

## Как использовать

### Локальная разработка
```bash
cd backend
python3 manage.py collectstatic --noinput --settings=temp_settings
```

### Docker
```bash
# Пересборка контейнеров
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Проверка статических файлов
docker-compose exec backend ls -la /staticfiles/admin/css/
```

### Проверка решения
После применения исправлений:
1. Статические файлы будут доступны по адресу `/static/`
2. CSS файлы админки будут загружаться корректно
3. Админка будет отображаться с правильными стилями

## Структура статических файлов

После сбора статических файлов в `/staticfiles/` будут находиться:
```
staticfiles/
├── admin/
│   ├── css/
│   │   ├── base.css          # Основные стили админки
│   │   ├── forms.css         # Стили форм
│   │   ├── login.css         # Стили страницы входа
│   │   └── ...
│   ├── js/
│   └── img/
└── rest_framework/
    ├── css/
    ├── js/
    └── ...
```

## Nginx конфигурация

Nginx уже настроен для раздачи статических файлов:
```nginx
location /static/ {
    alias /staticfiles/;
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin *;
    try_files $uri $uri/ =404;
}
```

## Мониторинг

Для проверки работы статических файлов:
```bash
# Проверка в контейнере
docker-compose exec backend ls -la /staticfiles/admin/css/

# Проверка через curl
curl -I https://video-call-ghost.ru/static/admin/css/base.css
```

## Дополнительные настройки

Если проблема сохраняется, проверьте:
1. Права доступа к директории `/staticfiles/`
2. Настройки `STATIC_ROOT` в `settings.py`
3. Логи nginx на предмет ошибок
4. Правильность монтирования volume в docker-compose.yml
