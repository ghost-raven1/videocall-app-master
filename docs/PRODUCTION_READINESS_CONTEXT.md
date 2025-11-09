# Контекст проверки готовности к продакшену

Этот файл фиксирует промежуточные результаты аудита согласованности фронтенда, бэкенда и ноды (SFU), устранение хардкодов и улучшения типизации. Обновляется по мере выполнения задач.

## Обзор
- Цель: исключить хардкод, унифицировать конфигурацию через окружение, проверить соответствие путей/эндпоинтов, обеспечить готовность к продакшену.
- Компоненты: `Django backend`, `Streaming Node (Go SFU)`, `Frontend (Vite/Vue)`.

## Найденные несоответствия
- Streaming Node подключался к неправильному эндпоинту: `ws://<django>/ws/rooms/` вместо `ws://<django>/ws/sfu/`.
- В `streaming-node/config.yaml` указан WebSocket URL целиком (`ws://backend:8000/ws/sfu/`) вместо `host:port`, что конфликтовало с логикой клиента.
- Дефолты ноды содержали хардкод `localhost`/нестандартные значения (`videocall-app-master-backend-1:8000`).
- На бэке в `SFUClient` присутствовали дев-фоллбеки на `localhost`; для продакшена добавлена проверка в `settings.py`.

## Внесенные изменения
- Исправлен путь подключения ноды к Django: `/ws/sfu/` в `streaming-node/django_client.go`.
- Выровнен дефолтный `DJANGO_URL` ноды: `backend:8000` в `streaming-node/main.go` и `streaming-node/config/config.go`.
- Обновлен `streaming-node/config.yaml`: `django.url: "backend:8000"` (WebSocket путь конструируется клиентом).
- Добавлен продакшн-гард в `backend/videocall_app/settings.py`: запрет `SFU_HOST` = `localhost`/`127.0.0.1` при `DEBUG=False`.
- Добавлена JSDoc-типизация для `videocall-frontend/src/services/api.js` (стабильность и предсказуемость вызовов).
 - Обновлены тесты и конфиги нагрузочного тестирования: путь клиентского WS — `/ws/room/<room_id>/` вместо устаревшего `/ws/rooms/` (`tests/websocket-load-test.js`, `tests/load-test-config.yml`).
 - Согласованы примеры в документации (`DEPLOYMENT_GUIDE.md`, `TROUBLESHOOTING_GUIDE.md`) — корректный путь WebSocket: `/ws/room/<room_id>/`.

## Проверки согласованности
- Бэкенд: эндпоинты `'/api/auth/'`, `'/api/rooms/'`, WebSocket `'/ws/sfu/'` доступны и проксируются через `nginx`.
- Фронтенд: `baseURL` читается из `VITE_API_BASE_URL` (фоллбек `'/api'` для дев/локально), refresh-токен: `'/auth/token/refresh/'`.
- Нода: читает `DJANGO_URL` из `env/config`, собирает `ws://<host>/ws/sfu/`, подключается к бэку; безопасность JWT проверяется (`SECURITY_JWT_SECRET`).

## Рекомендации для продакшена
- Убедиться, что в окружении заданы: `SFU_HOST`, `SFU_PORT`, `SECURITY_JWT_SECRET`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `VITE_API_BASE_URL`.
- Проверить, что `nginx` проксирует `/api/` на `backend`, `/ws/` c `Upgrade` заголовками, `/streaming` на SFU.
- Включить HTTPS; для фронта использовать `VITE_API_BASE_URL=https://<domain>/api`.

## План валидации
- Запуск миграций, создание суперпользователя, проверка админки.
- Тест `login → refresh → logout` через фронт (куки httpOnly).
- Тест `create room → reach SFU threshold → SFU room stats`.
- Проверка WS соединения ноды: авто-реконнект и обмен событиями.

## Статус
- Исправления внесены. Готовность к продакшену повышена, хардкоды устранены в критичных местах.
- Следующий шаг: прогнать интеграционные тесты и smoke-проверку окружения.
