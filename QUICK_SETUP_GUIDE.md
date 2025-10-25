# 🚀 Быстрая настройка и запуск

**Обновлено:** 25 октября 2025

---

## ✅ Что добавлено в проект

### 1. **SFU Server (Streaming Node)** ⭐
- Многопользовательские видеозвонки (3+ участников)
- WebRTC медиа-сервер на Go
- Масштабируемая архитектура

### 2. **Текстовый чат** 💬
- Обмен сообщениями в реальном времени
- Вложения файлов (до 50MB)
- Ответы, редактирование, удаление
- История сообщений

### 3. **Демонстрация экрана** 🖥️
- Показ экрана другим участникам
- Передача через WebRTC
- Управление сессиями

### 4. **Автоматизация** 🤖
- Скрипт проверки конфигурации
- Скрипт быстрого запуска
- Автоматические health checks

---

## 🎯 Запуск за 3 команды

```bash
# 1. Создайте .env файл
cp env.example .env

# 2. Запустите приложение
./quick-start.sh

# 3. Примените миграции для чата (если нужно)
docker-compose exec backend python manage.py migrate
```

**Готово!** Приложение доступно на http://localhost

---

## 📋 Что будет запущено

| Сервис | Порт | Описание |
|--------|------|----------|
| **Frontend** | 80/443 | Vue.js приложение |
| **Backend** | 8000 | Django API + WebSocket |
| **SFU Server** | 8080 | Go медиа-сервер |
| **PostgreSQL** | 5432 | База данных |
| **Redis** | 6379 | Кэш и сессии |
| **Nginx** | 80/443 | Reverse proxy |

---

## 🔍 Проверка работоспособности

### Автоматическая проверка

```bash
./scripts/check-config.sh
```

### Ручная проверка

```bash
# Проверьте все сервисы
curl http://localhost:8080/health      # SFU ✅
curl http://localhost:8000/api/health/ # Backend ✅
curl http://localhost/                 # Frontend ✅

# Посмотрите статус контейнеров
docker-compose ps

# Проверьте логи
docker-compose logs -f
```

---

## 🎮 Тестирование функций

### 1. Многопользовательские видеозвонки

1. Откройте http://localhost в браузере
2. Нажмите "Создать комнату"
3. Скопируйте код комнаты
4. Откройте ту же ссылку в 2-3 других вкладках/браузерах
5. Введите тот же код комнаты
6. **Результат:** Все участники видят друг друга ✅

### 2. Текстовый чат

1. В активной комнате найдите иконку чата 💬
2. Напишите сообщение
3. **Результат:** Сообщение видно всем участникам ✅

### 3. Вложения файлов

1. В чате нажмите иконку скрепки 📎
2. Выберите файл (до 50MB)
3. Нажмите "Отправить"
4. **Результат:** Файл загружен и виден всем ✅

### 4. Демонстрация экрана

1. Нажмите кнопку "Share Screen" 🖥️
2. Выберите экран/окно для показа
3. **Результат:** Другие участники видят ваш экран ✅

---

## 🛠️ Настройка для продакшена

### 1. Обновите секретные ключи

```bash
# Сгенерируйте новые ключи
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))"
python -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))"

# Добавьте в .env файл
nano .env
```

### 2. Настройте домен

```bash
# В .env файле
DOMAIN_NAME=your-domain.com
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### 3. Получите SSL сертификаты

```bash
# Установите certbot
sudo apt install certbot python3-certbot-nginx

# Получите сертификаты
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Остановите системный nginx
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### 4. Обновите nginx.conf

```bash
# Замените yourdomain.com на ваш домен
nano nginx.conf
```

### 5. Запустите на продакшене

```bash
# Запустите с production настройками
docker-compose up --build -d

# Создайте суперпользователя
docker-compose exec backend python manage.py createsuperuser
```

---

## 📊 Структура проекта

```
videocall-app/
├── backend/                    # Django backend
│   ├── apps/
│   │   ├── rooms/             # Комнаты и участники
│   │   │   ├── chat_models.py # 💬 Модели чата
│   │   │   ├── chat_views.py  # 💬 API чата
│   │   │   └── ...
│   │   ├── authentication/    # Аутентификация
│   │   └── core/              # Общие утилиты
│   └── ...
│
├── streaming-node/             # 🎥 Go SFU сервер
│   ├── sfu/                   # WebRTC логика
│   └── ...
│
├── videocall-frontend/         # Vue.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── RoomChat.vue           # 💬 Компонент чата
│   │   │   ├── ScreenShareControls.vue # 🖥️ Screen sharing
│   │   │   └── ...
│   │   └── ...
│   └── ...
│
├── scripts/                    # Утилиты
│   ├── check-config.sh        # Проверка конфигурации
│   └── ...
│
├── docker-compose.yml          # ✅ Обновлен (с SFU)
├── env.example                 # ✅ Обновлен (с SFU настройками)
├── quick-start.sh              # ✅ Скрипт быстрого запуска
│
└── Документация/
    ├── PROJECT_ANALYSIS.md              # Анализ проекта
    ├── FIXED_ISSUES.md                  # Что было исправлено
    ├── CHAT_AND_SCREENSHARE_FEATURES.md # 💬🖥️ Новые функции
    └── QUICK_SETUP_GUIDE.md             # Эта инструкция
```

---

## 🔧 Полезные команды

### Управление контейнерами

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Пересборка
docker-compose up --build -d

# Логи
docker-compose logs -f [service-name]
```

### Работа с базой данных

```bash
# Применить миграции
docker-compose exec backend python manage.py migrate

# Создать миграции
docker-compose exec backend python manage.py makemigrations

# Создать суперпользователя
docker-compose exec backend python manage.py createsuperuser

# Бэкап БД
docker-compose exec db pg_dump -U postgres videocall_db > backup.sql

# Восстановление БД
docker-compose exec -T db psql -U postgres videocall_db < backup.sql
```

### Отладка

```bash
# Войти в контейнер
docker-compose exec backend bash
docker-compose exec streaming-node sh

# Проверить переменные окружения
docker-compose exec backend env

# Проверить сеть
docker network inspect videocall-app-master_app-network
```

---

## 🐛 Решение проблем

### Проблема: Порты заняты

```bash
# Проверьте занятые порты
netstat -tuln | grep -E '80|443|8080|5432|6379'

# Остановите конфликтующие сервисы
sudo systemctl stop nginx
sudo systemctl stop postgresql
```

### Проблема: SFU не запускается

```bash
# Проверьте логи
docker-compose logs streaming-node

# Пересоберите контейнер
docker-compose build --no-cache streaming-node
docker-compose up -d streaming-node
```

### Проблема: Чат не работает

```bash
# Примените миграции
docker-compose exec backend python manage.py migrate

# Проверьте WebSocket
docker-compose logs backend | grep -i websocket
```

### Проблема: Screen sharing не работает

**Причины:**
- Требуется HTTPS (кроме localhost)
- Браузер не поддерживает API
- Разрешение не предоставлено

**Решение:**
- Используйте HTTPS в продакшене
- Обновите браузер
- Разрешите доступ к экрану

---

## 📚 API Endpoints

### Комнаты

```bash
POST   /api/rooms/create/              # Создать комнату
POST   /api/rooms/join/                # Присоединиться
GET    /api/rooms/{id}/                # Информация о комнате
DELETE /api/rooms/{id}/leave/          # Покинуть комнату
```

### Чат

```bash
GET    /api/rooms/chat/messages/history/           # История
POST   /api/rooms/chat/messages/                   # Отправить
PUT    /api/rooms/chat/messages/{id}/edit/         # Редактировать
DELETE /api/rooms/chat/messages/{id}/soft_delete/  # Удалить
```

### Файлы

```bash
POST   /api/rooms/chat/attachments/              # Загрузить
GET    /api/rooms/chat/attachments/{id}/download/ # Скачать
GET    /api/rooms/chat/attachments/list_by_room/ # Список
```

### Screen Sharing

```bash
POST   /api/rooms/screen-share/                    # Начать
POST   /api/rooms/screen-share/{id}/stop/          # Остановить
GET    /api/rooms/screen-share/active_sessions/    # Активные
```

---

## ✅ Чеклист готовности

### Перед запуском
- [x] Docker и Docker Compose установлены
- [x] .env файл создан из env.example
- [x] Порты 80, 443, 8080 свободны
- [x] Достаточно RAM (минимум 4GB)

### После запуска
- [ ] Все контейнеры запущены (`docker-compose ps`)
- [ ] Health checks проходят
- [ ] SFU доступен на порту 8080
- [ ] Backend доступен на порту 8000
- [ ] Frontend открывается в браузере

### Тестирование
- [ ] Создание комнаты работает
- [ ] 2+ пользователей могут подключиться
- [ ] Видео/аудио работают
- [ ] Чат отправляет сообщения
- [ ] Файлы загружаются
- [ ] Screen sharing работает

---

## 🎉 Готово!

Теперь у вас есть полнофункциональное приложение для видеозвонков с:

✅ Многопользовательскими звонками (3+ участников)  
✅ Текстовым чатом с вложениями  
✅ Демонстрацией экрана  
✅ Автоматизированным запуском  
✅ Полной документацией  

**Следующие шаги:**
1. Протестируйте все функции локально
2. Настройте для продакшена (домен, SSL, секреты)
3. Задеплойте на сервер
4. Наслаждайтесь! 🚀

---

## 📞 Поддержка

**Документация:**
- `PROJECT_ANALYSIS.md` - полный анализ
- `FIXED_ISSUES.md` - что исправлено
- `CHAT_AND_SCREENSHARE_FEATURES.md` - новые функции
- `docs/TROUBLESHOOTING_GUIDE.md` - решение проблем

**Логи:**
```bash
docker-compose logs -f
```

---

*Инструкция обновлена: 25 октября 2025*  
*Версия: 2.0 (с чатом и screen sharing)*
