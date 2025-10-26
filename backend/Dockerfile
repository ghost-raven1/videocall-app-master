# Multi-stage build для оптимизации
FROM python:3.11-slim as builder

# Установка переменных для таймаутов
ENV PIP_TIMEOUT=300
ENV PIP_RETRIES=3

WORKDIR /app

# Установка системных зависимостей с таймаутами
RUN apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc \
        gettext \
        curl \
        && rm -rf /var/lib/apt/lists/*

# Копирование только requirements.txt для кеширования зависимостей
COPY requirements.txt .

# Установка Python зависимостей с таймаутами и ретраями
RUN pip install --no-cache-dir --timeout $PIP_TIMEOUT --retries $PIP_RETRIES -r requirements.txt

# Дополнительно устанавливаем daphne
RUN pip install --no-cache-dir --timeout $PIP_TIMEOUT --retries $PIP_RETRIES daphne

# Финальный этап
FROM python:3.11-slim

WORKDIR /app

# Копирование установленных зависимостей из builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Установка системных зависимостей только для runtime
RUN apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
        libpq5 \
        gettext \
        curl \
        && rm -rf /var/lib/apt/lists/*

# Создание непривилегированного пользователя
RUN groupadd -r appuser -g 1000 && useradd -r -g appuser -u 1000 appuser

# Копирование только необходимых файлов для уменьшения context
COPY --chown=appuser:appuser manage.py run_server.py run_tests.py ./
COPY --chown=appuser:appuser videocall_app/ ./videocall_app/
COPY --chown=appuser:appuser apps/ ./apps/
COPY --chown=appuser:appuser pytest.ini ./

# Создание директорий
RUN mkdir -p /app/staticfiles /app/media /app/logs && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app/logs

# Переключение на пользователя
USER appuser

EXPOSE 8000

# Команда по умолчанию
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "videocall_app.asgi:application"]
