# 🚀 Быстрый старт

## Development режим

```bash
# 1. Скопировать конфигурацию
cp .env.dev.example .env.dev

# 2. Запустить
./scripts/start-dev.sh

# Доступ:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:8000
# - Admin: http://localhost:8000/admin
```

## Production режим

```bash
# 1. Скопировать конфигурацию
cp .env.prod.example .env

# 2. Сгенерировать секреты
./scripts/generate-secrets.sh

# 3. Обновить .env (обязательно!)
nano .env
# - Установите SECRET_KEY
# - Установите JWT_SECRET
# - Установите пароли
# - Обновите домены

# 4. Запустить
./scripts/start-prod.sh
```

## Полезные команды

```bash
# Просмотр логов (dev)
docker-compose -f docker-compose.dev.yml logs -f

# Просмотр логов (prod)
docker-compose -f docker-compose.prod.yml logs -f

# Остановка (dev)
docker-compose -f docker-compose.dev.yml down

# Остановка (prod)
docker-compose -f docker-compose.prod.yml down
```

Подробнее: [CONFIGURATION_GUIDE.md](CONFIGURATION_GUIDE.md)

