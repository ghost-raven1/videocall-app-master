# Руководство по запуску Dev окружения

**Дата создания:** 2025-01-27  
**Версия:** 2.1

---

## 🚀 Быстрый старт

### 1. Предварительные требования

**Обязательно:**
- ✅ Docker >= 20.10
- ✅ Docker Compose >= 2.0
- ✅ Минимум 4GB RAM
- ✅ Минимум 10GB свободного места на диске

**Проверка:**
```bash
docker --version
docker-compose --version
```

### 2. Подготовка окружения

```bash
# 1. Клонировать репозиторий (если еще не клонирован)
# git clone <repository-url>
# cd videocall-app-master

# 2. Создать .env.dev файл (если еще не создан)
cp .env.dev.example .env.dev

# 3. Проверить/обновить настройки в .env.dev
nano .env.dev
```

### 3. Запуск

```bash
# Запустить dev окружение
./scripts/start-dev.sh
```

**Или вручную:**
```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

### 4. Проверка запуска

**Проверить статус сервисов:**
```bash
docker-compose -f docker-compose.dev.yml ps
```

**Все сервисы должны быть в статусе `Up` и `healthy`.**

**Проверить доступность:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/health/
- SFU: http://localhost:8080/health
- Nginx: http://localhost

---

## 📋 Сервисы

### Backend (Django)
- **Порт:** 8000
- **URL:** http://localhost:8000
- **API:** http://localhost:8000/api/
- **Health:** http://localhost:8000/api/health/
- **Admin:** http://localhost:8000/admin (отключен, используется админка приложения)

### Frontend (Vue.js)
- **Порт:** 3000
- **URL:** http://localhost:3000
- **Dev Server:** Vite HMR enabled

### SFU (Go Streaming Node)
- **Порт:** 8080
- **URL:** http://localhost:8080
- **Health:** http://localhost:8080/health
- **WebRTC Ports:** 8081-8090

### PostgreSQL
- **Порт:** 5432
- **Database:** videocall_dev
- **User:** postgres
- **Password:** из .env.dev

### Redis
- **Порт:** 6379
- **URL:** redis://localhost:6379/0

### Nginx
- **Порт:** 80
- **URL:** http://localhost

---

## 🔧 Полезные команды

### Просмотр логов

```bash
# Все сервисы
docker-compose -f docker-compose.dev.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f streaming-node
```

### Остановка

```bash
# Остановить все сервисы
docker-compose -f docker-compose.dev.yml down

# Остановить и удалить volumes
docker-compose -f docker-compose.dev.yml down -v
```

### Перезапуск

```bash
# Перезапустить конкретный сервис
docker-compose -f docker-compose.dev.yml restart backend

# Перезапустить все сервисы
docker-compose -f docker-compose.dev.yml restart
```

### Пересборка

```bash
# Пересобрать все сервисы
docker-compose -f docker-compose.dev.yml up --build -d

# Пересобрать конкретный сервис
docker-compose -f docker-compose.dev.yml up --build -d backend
```

### Выполнение команд в контейнерах

```bash
# Backend (Django)
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Frontend
docker-compose -f docker-compose.dev.yml exec frontend npm install
docker-compose -f docker-compose.dev.yml exec frontend npm run build
```

---

## 🐛 Устранение проблем

### Проблема: Порты заняты

**Ошибка:** `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Решение:**
```bash
# Найти процесс, использующий порт
lsof -i :8000
lsof -i :3000
lsof -i :8080

# Остановить процесс или изменить порты в docker-compose.dev.yml
```

### Проблема: Сервисы не запускаются

**Ошибка:** Сервисы в статусе `Restarting` или `Exited`

**Решение:**
```bash
# Проверить логи
docker-compose -f docker-compose.dev.yml logs [service-name]

# Пересобрать контейнеры
docker-compose -f docker-compose.dev.yml up --build -d

# Очистить все и пересоздать
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build -d
```

### Проблема: База данных не подключается

**Ошибка:** `could not connect to server`

**Решение:**
```bash
# Проверить статус БД
docker-compose -f docker-compose.dev.yml ps db

# Проверить логи БД
docker-compose -f docker-compose.dev.yml logs db

# Пересоздать БД
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d db

# Подождать пока БД запустится
sleep 10

# Запустить остальные сервисы
docker-compose -f docker-compose.dev.yml up -d
```

### Проблема: Frontend не компилируется

**Ошибка:** Ошибки компиляции в frontend

**Решение:**
```bash
# Переустановить зависимости
docker-compose -f docker-compose.dev.yml exec frontend rm -rf node_modules
docker-compose -f docker-compose.dev.yml exec frontend npm install

# Или пересобрать контейнер
docker-compose -f docker-compose.dev.yml up --build -d frontend
```

### Проблема: Миграции не применяются

**Ошибка:** `django.db.utils.OperationalError`

**Решение:**
```bash
# Применить миграции вручную
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Создать миграции (если нужно)
docker-compose -f docker-compose.dev.yml exec backend python manage.py makemigrations
```

---

## ✅ Чеклист проверки

### После запуска проверить:

- [ ] Все сервисы в статусе `Up` и `healthy`
- [ ] Frontend доступен: http://localhost:3000
- [ ] Backend API отвечает: http://localhost:8000/api/health/
- [ ] SFU доступен: http://localhost:8080/health
- [ ] База данных работает (можно подключиться)
- [ ] Redis работает (можно подключиться)
- [ ] WebSocket соединения работают

### Функциональная проверка:

- [ ] Можно создать комнату
- [ ] Можно присоединиться к комнате
- [ ] Видео работает (если есть камера)
- [ ] Аудио работает (если есть микрофон)
- [ ] Чат работает
- [ ] WebSocket события работают

---

## 📊 Мониторинг

### Проверка ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
docker system df
```

### Проверка здоровья

```bash
# Health check всех сервисов
curl http://localhost:8000/api/health/
curl http://localhost:8080/health
```

### Логи в реальном времени

```bash
# Все логи
docker-compose -f docker-compose.dev.yml logs -f

# Только ошибки
docker-compose -f docker-compose.dev.yml logs -f | grep -i error
```

---

## 🔄 Обновление

### Обновить код

```bash
# Остановить сервисы
docker-compose -f docker-compose.dev.yml down

# Обновить код (git pull или другой способ)

# Пересобрать и запустить
docker-compose -f docker-compose.dev.yml up --build -d
```

### Обновить зависимости

```bash
# Backend
docker-compose -f docker-compose.dev.yml exec backend pip install -r requirements.txt

# Frontend
docker-compose -f docker-compose.dev.yml exec frontend npm install
```

---

## 📚 Дополнительная информация

- **Конфигурация:** `.env.dev`
- **Docker Compose:** `docker-compose.dev.yml`
- **Nginx конфигурация:** `nginx.dev.conf`
- **Логи:** `docker-compose logs`

---

*Руководство создано: 2025-01-27*

