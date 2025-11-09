# Nginx конфигурация для WebSocket и SFU

Ниже пример конфигурации Nginx для проксирования WebSocket-эндпоинтов Django (Channels) и HTTP API, а также базовой статики.

## Основные цели

- Проксировать пользовательские WS соединения на Django: `/ws/room/<room_id>/`
- Проксировать SFU-клиент (streaming-node ↔ Django) на Django: `/ws/sfu/`
- Проксировать HTTP API: `/api/`
- Обеспечить корректные заголовки Upgrade/Connection для WebSocket

## Пример server блока

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

upstream django_asgi {
  server 127.0.0.1:8000; # или docker-сервис backend:8000
}

server {
  listen 80;
  server_name video-call-ghost.ru;

  # Статика, если собирается и отдается Django
  location /static/ {
    alias /var/www/videocall/static/;
    expires 1d;
  }

  # HTTP API → Django
  location /api/ {
    proxy_pass http://django_asgi;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # WebSocket сигнальные соединения (пользователи)
  location /ws/room/ {
    proxy_pass http://django_asgi;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_read_timeout 60s;
  }

  # WebSocket SFU интеграция (streaming-node ↔ Django)
  location /ws/sfu/ {
    proxy_pass http://django_asgi;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_read_timeout 60s;
  }
}
```

## HTTPS (TLS)

Для продакшена рекомендуется настроить HTTPS и использовать `wss://` на фронтенде. С `certbot`/Let’s Encrypt блок `server` на 443 будет аналогичным, но с включенным `ssl`.

## Примечания

- Если SFU (streaming-node) публикует собственный API/WS, проксируйте его отдельным `upstream` и `location` блоком (например, `/sfu-api/`). В текущей реализации пользовательские WS идут в Django, а Django взаимодействует со streaming-node по внутренней сети.
- Убедитесь, что `CSRF_TRUSTED_ORIGINS` и `ALLOWED_HOSTS` настроены в `backend/videocall_app/settings.py` под ваш домен.

