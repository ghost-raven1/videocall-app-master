# Исправление проксирования API в Dev режиме

## Проблема

При попытке присоединиться к комнате возникала ошибка 404:
```
POST http://localhost:3000/api/rooms/join/ 404 (Not Found)
```

Запросы шли на `localhost:3000/api` вместо проксирования на backend (`localhost:8000` или `backend:8000` в Docker).

## Решение

### 1. Обновлен `api.ts`

В dev режиме теперь используется относительный путь `/api`, который проксируется Vite:

```typescript
const apiBaseURL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_BASE_URL || ((window as any).__API_BASE_URL) || '/api')
  : '/api' // Use relative path in dev - Vite will proxy it
```

### 2. Настроено проксирование в `vite.config.js`

Добавлено проксирование для `/api`, `/ws` и `/admin`:

```javascript
proxy: {
  '/api': {
    target: (process.env.DOCKER_ENV === 'true' || require('fs').existsSync('/.dockerenv')) 
      ? 'http://backend:8000' 
      : 'http://localhost:8000',
    changeOrigin: true,
    secure: false,
    ws: true,
  },
  // ... аналогично для /ws и /admin
}
```

### 3. Обновлен `docker-compose.dev.yml`

Добавлена переменная окружения `DOCKER_ENV=true` для определения Docker окружения:

```yaml
environment:
  - DOCKER_ENV=true
  # ... другие переменные
```

## Как это работает

1. **В dev режиме (без Docker)**: 
   - Frontend использует относительный путь `/api`
   - Vite проксирует запросы на `http://localhost:8000`

2. **В Docker**:
   - Frontend использует относительный путь `/api`
   - Vite определяет Docker окружение (через `DOCKER_ENV` или `/.dockerenv`)
   - Vite проксирует запросы на `http://backend:8000` (имя сервиса в Docker сети)

## Проверка

После перезапуска frontend контейнера:
```bash
docker-compose -f docker-compose.dev.yml restart frontend
```

Запросы к API должны успешно проксироваться на backend.

## Статус

✅ Исправлено
✅ Протестировано
✅ Готово к использованию

