# ✅ Чеклист для запуска Dev окружения

## Предварительные требования

### 1. Docker должен быть запущен

**macOS:**
```bash
# Откройте Docker Desktop приложение
open -a Docker

# Или проверьте статус
docker ps
```

**Linux:**
```bash
# Запустите Docker daemon
sudo systemctl start docker

# Проверьте статус
sudo systemctl status docker
```

### 2. Проверка Docker

```bash
# Проверка что Docker работает
docker --version
docker-compose --version
docker ps
```

Если команды работают - Docker запущен ✅

---

## Запуск Dev окружения

### Шаг 1: Создать .env.dev

```bash
cp .env.dev.example .env.dev
```

### Шаг 2: Запустить контейнеры

```bash
# Вариант 1: Использовать скрипт
./scripts/start-dev.sh

# Вариант 2: Вручную
docker-compose -f docker-compose.dev.yml up --build -d
```

### Шаг 3: Проверить статус

```bash
docker-compose -f docker-compose.dev.yml ps
```

Все сервисы должны быть в статусе `Up` или `healthy` ✅

### Шаг 4: Проверить логи

```bash
# Все сервисы
docker-compose -f docker-compose.dev.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f streaming-node
```

---

## Доступ к сервисам

После успешного запуска:

- **Frontend (Vite)**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin
- **SFU**: http://localhost:8080
- **Nginx**: http://localhost
- **Health Check**: http://localhost/health/

---

## Возможные проблемы

### Проблема: Docker daemon не запущен

**Решение:**
```bash
# macOS - откройте Docker Desktop
open -a Docker

# Linux - запустите службу
sudo systemctl start docker
```

### Проблема: Порт уже занят

**Решение:**
```bash
# Проверить занятые порты
lsof -i :3000
lsof -i :8000
lsof -i :8080
lsof -i :80

# Остановить конфликтующие процессы
# Или изменить порты в docker-compose.dev.yml
```

### Проблема: Ошибки при сборке

**Решение:**
```bash
# Очистить кэш и пересобрать
docker-compose -f docker-compose.dev.yml down
docker system prune -f
docker-compose -f docker-compose.dev.yml up --build
```

### Проблема: Ошибки подключения к БД

**Решение:**
```bash
# Пересоздать volumes
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

---

## Остановка

```bash
# Остановить контейнеры
docker-compose -f docker-compose.dev.yml down

# Остановить и удалить volumes
docker-compose -f docker-compose.dev.yml down -v
```

---

## Полезные команды

```bash
# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f [service]

# Выполнить команду в контейнере
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Перезапустить сервис
docker-compose -f docker-compose.dev.yml restart [service]

# Просмотр статуса
docker-compose -f docker-compose.dev.yml ps

# Использование ресурсов
docker stats
```

---

## Следующие шаги

После успешного запуска:

1. ✅ Откройте http://localhost:3000 в браузере
2. ✅ Проверьте http://localhost:8000/api/health/
3. ✅ Проверьте логи на наличие ошибок
4. ✅ Создайте тестовую комнату
5. ✅ Проверьте WebSocket соединение

---

*Последнее обновление: 2025-01-27*

