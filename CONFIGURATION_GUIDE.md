# Конфигурация для Dev и Production

Этот документ описывает настройку и запуск приложения в режимах разработки и продакшена.

## 📋 Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Режим разработки (Dev)](#режим-разработки-dev)
3. [Режим продакшена (Production)](#режим-продакшена-production)
4. [Конфигурационные файлы](#конфигурационные-файлы)
5. [Переменные окружения](#переменные-окружения)
6. [Troubleshooting](#troubleshooting)

---

## Быстрый старт

### Development

```bash
# 1. Скопировать пример конфигурации
cp .env.dev.example .env.dev

# 2. Запустить в dev режиме
./scripts/start-dev.sh
```

### Production

```bash
# 1. Скопировать пример конфигурации
cp .env.prod.example .env

# 2. Сгенерировать секреты
./scripts/generate-secrets.sh

# 3. Обновить .env с вашими настройками
nano .env

# 4. Запустить в production режиме
./scripts/start-prod.sh
```

---

## Режим разработки (Dev)

### Особенности Dev режима

- ✅ Hot reload для frontend и backend
- ✅ Отладочные логи (DEBUG=True)
- ✅ Прямой доступ к портам сервисов
- ✅ Упрощенная конфигурация
- ✅ Разрешен CORS для localhost

### Структура файлов

```
docker-compose.dev.yml    # Docker Compose для dev
.env.dev                  # Переменные окружения для dev
nginx.dev.conf            # Nginx конфигурация для dev
```

### Запуск

```bash
# Автоматический запуск
./scripts/start-dev.sh

# Или вручную
docker-compose -f docker-compose.dev.yml up --build
```

### Доступ к сервисам

- **Frontend**: http://localhost:3000 (Vite dev server)
- **Backend API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin
- **SFU**: http://localhost:8080
- **Nginx**: http://localhost (проксирует все сервисы)

### Переменные окружения (.env.dev)

```bash
# Минимальная конфигурация для dev
DEBUG=True
SECRET_KEY=dev-secret-key-min-50-chars
POSTGRES_PASSWORD=dev_password
JWT_SECRET=dev-jwt-secret
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Остановка

```bash
docker-compose -f docker-compose.dev.yml down
```

---

## Режим продакшена (Production)

### Особенности Production режима

- ✅ Оптимизированные сборки
- ✅ Безопасные настройки (DEBUG=False)
- ✅ SSL/TLS поддержка
- ✅ Rate limiting
- ✅ Security headers
- ✅ Мониторинг и логирование

### Структура файлов

```
docker-compose.prod.yml   # Docker Compose для production
.env                      # Переменные окружения для production
nginx.conf                # Nginx конфигурация для production
```

### Подготовка к запуску

#### 1. Генерация секретов

```bash
# Автоматическая генерация
./scripts/generate-secrets.sh

# Или вручную
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))"
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))"
```

#### 2. Настройка .env

Скопируйте `.env.prod.example` в `.env` и обновите:

```bash
cp .env.prod.example .env
nano .env
```

**Критически важные настройки:**

- `SECRET_KEY` - сгенерируйте безопасный ключ (минимум 50 символов)
- `JWT_SECRET` - сгенерируйте безопасный ключ
- `POSTGRES_PASSWORD` - установите сильный пароль
- `ADMIN_PASSWORD` - установите сильный пароль
- `ALLOWED_HOSTS` - укажите ваш домен
- `CORS_ALLOWED_ORIGINS` - укажите ваш домен
- `SERVER_ALLOWED_ORIGINS` - укажите ваш домен
- `DOMAIN_NAME` - укажите ваш домен

#### 3. SSL сертификаты (опционально)

```bash
# Установка Certbot
sudo apt update && sudo apt install -y certbot

# Получение сертификатов
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

### Запуск

```bash
# Автоматический запуск с проверками
./scripts/start-prod.sh

# Или вручную
docker-compose -f docker-compose.prod.yml up --build -d
```

### Проверка работоспособности

```bash
# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Проверка health check
curl http://localhost/health/

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f
```

### Остановка

```bash
docker-compose -f docker-compose.prod.yml down
```

---

## Конфигурационные файлы

### Docker Compose

#### docker-compose.dev.yml

- Открытые порты для доступа извне
- Volume mounts для hot reload
- Упрощенная конфигурация
- Development образы

#### docker-compose.prod.yml

- Внутренние порты (expose вместо ports)
- Оптимизированные сборки
- Production образы
- Health checks

### Nginx

#### nginx.dev.conf

- Простая конфигурация
- Проксирование на dev серверы
- Без SSL
- Упрощенные настройки

#### nginx.conf

- Полная конфигурация для production
- SSL/TLS поддержка
- Security headers
- Rate limiting
- Кэширование
- Оптимизация производительности

---

## Переменные окружения

### .env.dev (Development)

```bash
# Django
DEBUG=True
SECRET_KEY=dev-secret-key-min-50-chars

# Database
POSTGRES_DB=videocall_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dev_password

# CORS (разрешить localhost)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# SFU
JWT_SECRET=dev-jwt-secret
```

### .env (Production)

```bash
# Django
DEBUG=False
SECRET_KEY=<сгенерированный-безопасный-ключ-50+ chars>

# Database
POSTGRES_DB=videocall_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<сильный-пароль>

# CORS (только ваш домен)
CORS_ALLOWED_ORIGINS=https://your-domain.com
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

# SFU
JWT_SECRET=<сгенерированный-безопасный-ключ>

# Domain
DOMAIN_NAME=your-domain.com
```

---

## Troubleshooting

### Проблема: Порт уже занят

```bash
# Проверить занятые порты
sudo lsof -i :80
sudo lsof -i :3000
sudo lsof -i :8000

# Остановить конфликтующие сервисы
sudo systemctl stop nginx  # если используете системный nginx
```

### Проблема: Ошибки подключения к БД

```bash
# Проверить статус контейнеров
docker-compose -f docker-compose.dev.yml ps

# Проверить логи
docker-compose -f docker-compose.dev.yml logs db

# Пересоздать БД
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Проблема: CORS ошибки

Убедитесь, что в `.env.dev` указаны правильные origins:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Проблема: Не работает hot reload

```bash
# Проверить volume mounts
docker-compose -f docker-compose.dev.yml config

# Пересоздать контейнеры
docker-compose -f docker-compose.dev.yml up --force-recreate
```

### Проблема: SSL сертификаты не работают

```bash
# Проверить пути к сертификатам
ls -la /etc/letsencrypt/live/your-domain.com/

# Проверить права доступа
sudo chmod 644 /etc/letsencrypt/live/your-domain.com/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/your-domain.com/privkey.pem
```

---

## Полезные команды

### Development

```bash
# Запуск
./scripts/start-dev.sh

# Остановка
docker-compose -f docker-compose.dev.yml down

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f

# Пересборка
docker-compose -f docker-compose.dev.yml up --build

# Выполнить команду в контейнере
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

### Production

```bash
# Запуск
./scripts/start-prod.sh

# Остановка
docker-compose -f docker-compose.prod.yml down

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Пересборка
docker-compose -f docker-compose.prod.yml up --build -d

# Проверка health
curl http://localhost/health/
```

---

## Безопасность

### Development

- ✅ Используйте простые пароли (только для локальной разработки)
- ✅ Не коммитьте `.env.dev` в git
- ✅ Используйте `.env.dev.example` как шаблон

### Production

- ✅ **ОБЯЗАТЕЛЬНО** сгенерируйте уникальные секреты
- ✅ Используйте сильные пароли
- ✅ Настройте SSL/TLS
- ✅ Ограничьте ALLOWED_HOSTS
- ✅ Настройте CORS правильно
- ✅ Включите rate limiting
- ✅ Настройте мониторинг
- ✅ Регулярно обновляйте зависимости

---

## Дополнительные ресурсы

- [README.md](README.md) - Общая документация
- [QUICK_SETUP_GUIDE.md](QUICK_SETUP_GUIDE.md) - Быстрая настройка
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - Детальное руководство по развертыванию
- [docs/PRODUCTION_DEPLOY_COMPOSE.md](docs/PRODUCTION_DEPLOY_COMPOSE.md) - Production развертывание

---

*Последнее обновление: 2025-01-27*

