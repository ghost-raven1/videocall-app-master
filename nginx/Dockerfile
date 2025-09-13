FROM nginx:alpine

# Копируем конфигурацию nginx
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Создаем директорию для статических файлов
RUN mkdir -p /staticfiles

# Копируем статические файлы Django (если они есть)
# Это будет работать только если статические файлы уже собраны
COPY backend/staticfiles/ /staticfiles/ 2>/dev/null || true

# Устанавливаем правильные права доступа
RUN chown -R nginx:nginx /staticfiles && \
    chmod -R 755 /staticfiles

# Создаем скрипт для обновления статических файлов
RUN echo '#!/bin/sh' > /usr/local/bin/update-static && \
    echo 'if [ -d "/staticfiles" ]; then' >> /usr/local/bin/update-static && \
    echo '  echo "Static files already exist"' >> /usr/local/bin/update-static && \
    echo 'else' >> /usr/local/bin/update-static && \
    echo '  echo "Creating static files directory"' >> /usr/local/bin/update-static && \
    echo '  mkdir -p /staticfiles' >> /usr/local/bin/update-static && \
    echo 'fi' >> /usr/local/bin/update-static && \
    chmod +x /usr/local/bin/update-static

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
