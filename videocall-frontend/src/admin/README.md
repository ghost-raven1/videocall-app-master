# Админ-панель видеозвонков

Современная административная панель для управления системой видеозвонков с поддержкой многоуровневого доступа, аналитики и мониторинга.

## 🚀 Возможности

### Основные функции
- **Управление пользователями**: Создание, редактирование, блокировка пользователей
- **Управление комнатами**: Мониторинг активных комнат, принудительное закрытие
- **Аналитика и отчеты**: Детальная статистика использования системы
- **Системные настройки**: Конфигурация параметров приложения
- **Мониторинг в реальном времени**: Отслеживание состояния системы

### Расширенные возможности
- **Массовые операции**: Групповые действия с пользователями и комнатами
- **Экспорт данных**: CSV/Excel экспорт для отчетности
- **Расширенные фильтры**: Многоуровневая фильтрация и поиск
- **Адаптивный дизайн**: Поддержка мобильных устройств и планшетов
- **Темная тема**: Полная поддержка темного режима

## 📋 Требования

- Node.js 16+
- Vue.js 3.x
- Django 4.2+
- Redis (для продакшена)
- Современный браузер с поддержкой WebRTC

## 🛠 Установка и настройка

### 1. Установка зависимостей

```bash
# Установка frontend зависимостей
cd videocall-frontend
npm install

# Установка backend зависимостей
cd backend
pip install -r requirements.txt
```

### 2. Настройка базы данных

```bash
# Миграции базы данных
cd backend
python manage.py migrate

# Создание суперпользователя
python manage.py shell
```

```python
from apps.authentication.models import User
User.objects.create_superuser('admin@example.com', 'your-password')
```

### 3. Конфигурация

Создайте `.env` файл в корне проекта:

```env
# Backend
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3

# Frontend
VITE_API_BASE_URL=http://localhost:8000/api
```

### 4. Запуск

```bash
# Backend сервер
cd backend
python manage.py runserver 0.0.0.0:8000

# Frontend сервер (новая вкладка)
cd videocall-frontend
npm run dev
```

Админ-панель будет доступна по адресу: `http://localhost:5173/admin`

## 🔐 Аутентификация

Система поддерживает многоуровневую аутентификацию:

- **Администратор**: Полный доступ ко всем функциям
- **Модератор**: Доступ к управлению комнатами и базовой аналитике
- **Пользователь**: Ограниченный доступ только к своим данным

### JWT токены

API использует JWT токены для аутентификации:

```javascript
// Авторизация
const response = await fetch('/api/auth/login/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password'
  })
})

// Использование токена
const token = response.data.access
fetch('/api/admin/users/', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## 📖 Использование

### Управление пользователями

#### Создание пользователя

```javascript
await adminStore.createUser({
  email: 'user@example.com',
  role: 'user',
  password: 'secure-password',
  is_active: true
})
```

#### Фильтрация пользователей

```javascript
await adminStore.loadUsers({
  page: 1,
  per_page: 20,
  search: 'john',
  role: 'user',
  status: 'active'
})
```

#### Массовые операции

```javascript
// Активация пользователей
await adminStore.bulkUpdateUsers([1, 2, 3], 'activate')

// Деактивация пользователей
await adminStore.bulkUpdateUsers([4, 5], 'deactivate')

// Удаление пользователей
await adminStore.bulkUpdateUsers([6, 7], 'delete')
```

### Управление комнатами

#### Мониторинг комнат

```javascript
await adminStore.loadRooms({
  page: 1,
  per_page: 20,
  status: 'active',
  type: 'public'
})
```

#### Принудительное закрытие комнаты

```javascript
await adminStore.forceCloseRoom(roomId, 'Причина закрытия')
```

### Экспорт данных

#### Экспорт пользователей

```javascript
const exportData = await adminStore.exportUsers('csv', [1, 2, 3])
// Возвращает CSV данные для скачивания
```

#### Экспорт комнат

```javascript
const exportData = await adminStore.exportRooms('csv', [4, 5])
// Возвращает CSV данные для скачивания
```

## 🔧 API документация

### Аутентификация

#### POST `/api/auth/login/`
Вход в систему администратора

**Параметры:**
- `email` (string) - Email пользователя
- `password` (string) - Пароль

**Ответ:**
```json
{
  "access": "jwt-token",
  "refresh": "refresh-token",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### POST `/api/auth/logout/`
Выход из системы

#### GET `/api/auth/check/`
Проверка аутентификации

### Управление пользователями

#### GET `/api/admin/users/`
Получение списка пользователей

**Параметры запроса:**
- `page` (int) - Номер страницы
- `per_page` (int) - Количество элементов на странице
- `search` (string) - Поиск по email/имени
- `role` (string) - Фильтр по роли
- `status` (string) - Фильтр по статусу

#### POST `/api/admin/users/`
Создание пользователя

#### PUT `/api/admin/users/{id}/`
Обновление пользователя

#### DELETE `/api/admin/users/{id}/`
Деактивация пользователя

#### POST `/api/admin/users/bulk/`
Массовые операции с пользователями

**Параметры:**
- `user_ids` (array) - ID пользователей
- `action` (string) - Действие: activate, deactivate, delete

### Управление комнатами

#### GET `/api/admin/rooms/`
Получение списка комнат

**Параметры запроса:**
- `page` (int) - Номер страницы
- `per_page` (int) - Количество элементов на странице
- `search` (string) - Поиск по ID/коду
- `status` (string) - Фильтр по статусу
- `type` (string) - Фильтр по типу

#### POST `/api/admin/rooms/{id}/force-close/`
Принудительное закрытие комнаты

**Параметры:**
- `reason` (string) - Причина закрытия

### Аналитика

#### GET `/api/admin/analytics/dashboard/`
Статистика для дашборда

**Ответ:**
```json
{
  "activeRooms": 12,
  "onlineUsers": 48,
  "totalCalls": 156,
  "serverLoad": 23
}
```

#### GET `/api/admin/analytics/`
Детальная аналитика

**Параметры запроса:**
- `time_range` (string) - Период: 7d, 30d, 90d

## 🎨 Кастомизация

### Темы

Компоненты используют CSS переменные для легкой кастомизации:

```css
:root {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
}

[data-theme="dark"] {
  --bg-color: #1f2937;
  --text-color: #f9fafb;
}
```

### Добавление новых компонентов

```javascript
// Создание нового компонента управления
const NewManagementComponent = {
  template: `
    <div class="new-management">
      <!-- Ваш код компонента -->
    </div>
  `,
  setup() {
    // Логика компонента
    return {}
  }
}
```

## 🔍 Отладка

### Логи

```bash
# Backend логи
cd backend
python manage.py runserver --verbosity=2

# Frontend логи
npm run dev -- --debug
```

### Диагностика проблем

```javascript
// Проверка API соединения
const response = await fetch('/api/health/')
const health = await response.json()
console.log('System health:', health)
```

## 🚨 Устранение неисправностей

### Проблемы с аутентификацией

1. **Ошибка CSRF токена**
   - Убедитесь что фронтенд отправляет правильные CSRF токены
   - Проверьте настройки CORS в Django

2. **JWT токен истек**
   - Реализуйте автоматическое обновление токенов
   - Используйте refresh токен для получения нового access токена

### Проблемы с производительностью

1. **Медленная загрузка списков**
   - Включите пагинацию
   - Используйте виртуальную прокрутку для больших списков
   - Настройте кэширование часто используемых данных

2. **Высокая нагрузка на сервер**
   - Включите Redis кэширование
   - Настройте rate limiting
   - Используйте CDN для статических файлов

### Проблемы с WebSocket

1. **Соединение не устанавливается**
   - Проверьте настройки Channels и Daphne
   - Убедитесь что Redis доступен

2. **Частые отключения**
   - Настройте heartbeat интервалы
   - Проверьте лимиты таймаута

## 📞 Поддержка

Для получения помощи:

1. Проверьте документацию выше
2. Изучите примеры кода в репозитории
3. Создайте issue в системе отслеживания задач

## 🔄 Обновления

### Миграции базы данных

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### Обновление зависимостей

```bash
# Backend
pip install -r requirements.txt --upgrade

# Frontend
npm update
```

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл LICENSE для подробностей.

---

*Документация обновлена: октябрь 2025*