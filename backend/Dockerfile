FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    gettext \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Копирование и установка Python зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Дополнительно устанавливаем daphne если его нет в requirements.txt
RUN pip install daphne

# Создание непривилегированного пользователя с определенным UID/GID
RUN groupadd -r appuser -g 1000 && useradd -r -g appuser -u 1000 appuser

# Копирование исходного кода
COPY . .

# Копирование скриптов для сбора статических файлов
COPY collect_static.sh /usr/local/bin/collect_static.sh
COPY collect_static_simple.sh /usr/local/bin/collect_static_simple.sh
RUN chmod +x /usr/local/bin/collect_static.sh /usr/local/bin/collect_static_simple.sh

# Создание директорий для статических файлов, медиа и логов с правильными правами
RUN mkdir -p /app/staticfiles /app/media /app/logs && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app/logs

# Переключение на непривилегированного пользователя
USER appuser

EXPOSE 8000

# Команда по умолчанию - запуск через daphne для поддержки WebSocket
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "videocall_app.asgi:application"]
