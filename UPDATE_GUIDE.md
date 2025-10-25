# 🔄 Руководство по обновлению приложения на сервере

**Дата:** 25 октября 2025  
**Версия:** 2.1 Enterprise

---

## 🎯 Быстрое обновление (без простоя)

### Метод 1: Rolling Update (рекомендуется)

```bash
# 1. Подключиться к серверу
ssh user@your-server.com

# 2. Перейти в директорию проекта
cd /path/to/videocall-app

# 3. Получить обновления
git pull origin main

# 4. Обновить backend (zero-downtime)
docker-compose up -d --no-deps --build backend

# 5. Применить миграции
docker-compose exec backend python manage.py migrate

# 6. Обновить frontend
docker-compose up -d --no-deps --build frontend

# 7. Перезапустить nginx (если нужно)
docker-compose restart nginx

# Готово! Обновление завершено
```

**Время:** ~5 минут  
**Простой:** 0 секунд

---

## 📋 Полное обновление (с кратким простоем)

### Метод 2: Complete Update

```bash
# 1. Подключиться к серверу
ssh user@your-server.com
cd /path/to/videocall-app

# 2. Создать бэкап
./scripts/backup.sh

# 3. Получить обновления
git pull origin main

# 4. Остановить сервисы
docker-compose down

# 5. Пересобрать образы
docker-compose build

# 6. Запустить обновленные сервисы
docker-compose up -d

# 7. Применить миграции
docker-compose exec backend python manage.py migrate

# 8. Проверить работу
curl http://localhost/api/health/

# Готово!
```

**Время:** ~10 минут  
**Простой:** ~2 минуты

---

## 🔧 Обновление с кластером

### Kubernetes Rolling Update

```bash
# 1. Обновить образы
docker build -t videocall-backend:v2.1 ./backend
docker build -t videocall-frontend:v2.1 ./videocall-frontend

# 2. Push в registry
docker push your-registry/videocall-backend:v2.1
docker push your-registry/videocall-frontend:v2.1

# 3. Обновить deployment
kubectl set image deployment/backend \
  backend=your-registry/videocall-backend:v2.1 \
  -n videocall

kubectl set image deployment/frontend \
  frontend=your-registry/videocall-frontend:v2.1 \
  -n videocall

# 4. Применить миграции
kubectl exec -it deployment/backend -n videocall -- \
  python manage.py migrate

# 5. Проверить статус
kubectl rollout status deployment/backend -n videocall
kubectl rollout status deployment/frontend -n videocall

# Готово! Zero-downtime update
```

**Время:** ~15 минут  
**Простой:** 0 секунд (rolling update)

---

## 📦 Что обновляется

### Backend обновления:
- ✅ Django код
- ✅ API endpoints
- ✅ WebSocket handlers
- ✅ База данных (миграции)
- ✅ Python зависимости

### Frontend обновления:
- ✅ Vue.js компоненты
- ✅ UI/UX изменения
- ✅ JavaScript код
- ✅ Стили (CSS)
- ✅ NPM зависимости

### Инфраструктура:
- ✅ Docker образы
- ✅ Nginx конфигурация
- ✅ Environment переменные
- ✅ SFU сервер

---

## 🔍 Проверка перед обновлением

### Чеклист:

```bash
# 1. Проверить текущую версию
docker-compose exec backend python manage.py version

# 2. Проверить свободное место
df -h

# 3. Проверить запущенные контейнеры
docker-compose ps

# 4. Проверить логи на ошибки
docker-compose logs --tail=100 backend

# 5. Создать бэкап БД
docker-compose exec postgres pg_dump -U postgres videocall_db > backup.sql

# 6. Проверить .env файл
cat .env | grep -v "PASSWORD\|SECRET"
```

---

## 💾 Создание бэкапа

### Автоматический бэкап:

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/videocall"
DATE=$(date +%Y%m%d_%H%M%S)

# 1. Создать директорию
mkdir -p $BACKUP_DIR

# 2. Бэкап базы данных
docker-compose exec -T postgres pg_dump -U postgres videocall_db \
  > $BACKUP_DIR/db_$DATE.sql

# 3. Бэкап файлов (recordings, uploads)
tar -czf $BACKUP_DIR/media_$DATE.tar.gz \
  backend/media/

# 4. Бэкап конфигурации
cp .env $BACKUP_DIR/env_$DATE
cp docker-compose.yml $BACKUP_DIR/docker-compose_$DATE.yml

# 5. Удалить старые бэкапы (>7 дней)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
```

**Запуск:**
```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

---

## 🔄 Откат к предыдущей версии

### Если что-то пошло не так:

```bash
# 1. Откатить git
git log --oneline -5  # Посмотреть последние коммиты
git checkout <previous-commit-hash>

# 2. Пересобрать контейнеры
docker-compose down
docker-compose build
docker-compose up -d

# 3. Откатить миграции (если нужно)
docker-compose exec backend python manage.py migrate <app_name> <migration_number>

# 4. Восстановить БД из бэкапа (крайний случай)
docker-compose exec -T postgres psql -U postgres videocall_db < backup.sql

# 5. Проверить работу
curl http://localhost/api/health/
```

---

## 📝 Пошаговое обновление с проверками

### Детальный процесс:

```bash
# ========================================
# ШАГ 1: Подготовка
# ========================================

# Подключиться к серверу
ssh user@your-server.com
cd /path/to/videocall-app

# Проверить текущее состояние
docker-compose ps
docker-compose logs --tail=50 backend

# Создать бэкап
./scripts/backup.sh

# ========================================
# ШАГ 2: Получение обновлений
# ========================================

# Проверить доступные обновления
git fetch origin
git log HEAD..origin/main --oneline

# Получить обновления
git pull origin main

# Проверить изменения
git diff HEAD@{1} HEAD

# ========================================
# ШАГ 3: Обновление зависимостей
# ========================================

# Проверить изменения в requirements.txt
git diff HEAD@{1} HEAD backend/requirements.txt

# Проверить изменения в package.json
git diff HEAD@{1} HEAD videocall-frontend/package.json

# ========================================
# ШАГ 4: Обновление Backend
# ========================================

# Пересобрать backend
docker-compose build backend

# Запустить обновленный backend
docker-compose up -d --no-deps backend

# Подождать запуска
sleep 10

# Проверить логи
docker-compose logs --tail=50 backend

# Применить миграции
docker-compose exec backend python manage.py migrate

# Собрать статику (если нужно)
docker-compose exec backend python manage.py collectstatic --noinput

# ========================================
# ШАГ 5: Обновление Frontend
# ========================================

# Пересобрать frontend
docker-compose build frontend

# Запустить обновленный frontend
docker-compose up -d --no-deps frontend

# Подождать запуска
sleep 10

# Проверить логи
docker-compose logs --tail=50 frontend

# ========================================
# ШАГ 6: Обновление SFU (если изменился)
# ========================================

# Проверить изменения
git diff HEAD@{1} HEAD streaming-node/

# Если есть изменения:
docker-compose build sfu
docker-compose up -d --no-deps sfu

# ========================================
# ШАГ 7: Перезапуск Nginx (если нужно)
# ========================================

# Проверить изменения в конфигурации
git diff HEAD@{1} HEAD nginx.conf

# Если есть изменения:
docker-compose restart nginx

# ========================================
# ШАГ 8: Проверка работоспособности
# ========================================

# Проверить все сервисы
docker-compose ps

# Проверить health endpoints
curl http://localhost/api/health/
curl http://localhost/health

# Проверить логи на ошибки
docker-compose logs --tail=100 | grep -i error

# Проверить подключение к БД
docker-compose exec backend python manage.py dbshell

# Проверить WebSocket
# (открыть браузер и создать комнату)

# ========================================
# ШАГ 9: Мониторинг после обновления
# ========================================

# Следить за логами в реальном времени
docker-compose logs -f backend frontend

# Проверить использование ресурсов
docker stats

# Проверить ошибки в логах
docker-compose logs --since 10m | grep -i "error\|exception\|traceback"

# ========================================
# ГОТОВО!
# ========================================

echo "Update completed successfully!"
```

---

## 🚨 Troubleshooting

### Проблема 1: Миграции не применяются

```bash
# Проверить состояние миграций
docker-compose exec backend python manage.py showmigrations

# Применить конкретную миграцию
docker-compose exec backend python manage.py migrate rooms 0003

# Откатить миграцию
docker-compose exec backend python manage.py migrate rooms 0002

# Создать новую миграцию (если нужно)
docker-compose exec backend python manage.py makemigrations
```

### Проблема 2: Контейнер не запускается

```bash
# Посмотреть логи
docker-compose logs backend

# Проверить конфигурацию
docker-compose config

# Пересоздать контейнер
docker-compose up -d --force-recreate backend

# Проверить образ
docker images | grep videocall
```

### Проблема 3: 502 Bad Gateway

```bash
# Проверить backend
curl http://localhost:8000/api/health/

# Проверить nginx
docker-compose logs nginx

# Перезапустить nginx
docker-compose restart nginx

# Проверить порты
netstat -tulpn | grep -E '80|8000'
```

### Проблема 4: WebSocket не работает

```bash
# Проверить Redis
docker-compose exec redis redis-cli ping

# Проверить Channels
docker-compose exec backend python manage.py shell
>>> from channels.layers import get_channel_layer
>>> channel_layer = get_channel_layer()
>>> await channel_layer.send("test", {"type": "test.message"})

# Проверить логи
docker-compose logs backend | grep -i websocket
```

---

## 📊 Мониторинг после обновления

### Что проверять первые 24 часа:

```bash
# 1. Логи ошибок
watch -n 60 'docker-compose logs --since 1h | grep -i error | tail -20'

# 2. Использование памяти
watch -n 60 'docker stats --no-stream'

# 3. Количество активных соединений
watch -n 60 'docker-compose exec backend netstat -an | grep ESTABLISHED | wc -l'

# 4. Размер БД
watch -n 300 'docker-compose exec postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size(\"videocall_db\"));"'

# 5. Количество комнат
watch -n 60 'curl -s http://localhost/api/rooms/admin/analytics/dashboard/ | jq .active_rooms'
```

---

## ✅ Чеклист после обновления

### Проверить функционал:

- [ ] Создание комнаты работает
- [ ] Присоединение к комнате работает
- [ ] Видео/аудио работает
- [ ] Чат работает
- [ ] Отправка файлов работает
- [ ] Screen sharing работает
- [ ] Запись звонков работает (если включена)
- [ ] Настройки аудио работают
- [ ] Админ-панель доступна
- [ ] WebSocket соединение стабильно
- [ ] Нет ошибок в логах
- [ ] Все сервисы запущены

---

## 🔐 Безопасность при обновлении

### Важные моменты:

```bash
# 1. Проверить .env на утечки
git diff HEAD@{1} HEAD .env

# 2. Обновить секреты (если нужно)
# Сгенерировать новый SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(50))"

# 3. Проверить права доступа
ls -la .env
chmod 600 .env

# 4. Проверить SSL сертификаты
docker-compose exec nginx nginx -t

# 5. Обновить зависимости с уязвимостями
docker-compose exec backend pip list --outdated
docker-compose exec backend pip install --upgrade <package>
```

---

## 📅 Автоматическое обновление

### Cron job для регулярных обновлений:

```bash
# Создать скрипт
cat > /usr/local/bin/update-videocall.sh << 'EOF'
#!/bin/bash
set -e

cd /path/to/videocall-app

# Бэкап
./scripts/backup.sh

# Обновление
git pull origin main
docker-compose build
docker-compose up -d
docker-compose exec backend python manage.py migrate

# Уведомление
echo "Videocall updated at $(date)" | mail -s "Update completed" admin@example.com
EOF

chmod +x /usr/local/bin/update-videocall.sh

# Добавить в crontab (каждое воскресенье в 3:00)
crontab -e
0 3 * * 0 /usr/local/bin/update-videocall.sh >> /var/log/videocall-update.log 2>&1
```

---

## 🎯 Итоговая команда (быстрое обновление)

```bash
# Одна команда для обновления всего
cd /path/to/videocall-app && \
./scripts/backup.sh && \
git pull origin main && \
docker-compose build && \
docker-compose up -d && \
docker-compose exec backend python manage.py migrate && \
docker-compose logs --tail=50 && \
curl http://localhost/api/health/

echo "✅ Update completed!"
```

---

*Руководство обновлено: 25 октября 2025*  
*Версия: 2.1*
