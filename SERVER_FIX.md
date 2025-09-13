# Исправление на сервере - 404 ошибки статических файлов

## 🚨 Проблема
- Контейнеры запущены, но статические файлы не доступны
- Django не установлен локально для сбора статических файлов
- Нужно исправить проблему на сервере с Docker

## ✅ Решение

### Вариант 1: Использовать готовый скрипт (рекомендуется)

```bash
# На сервере выполните:
./fix_running_containers.sh
```

### Вариант 2: Ручные команды

```bash
# 1. Соберите статические файлы в backend контейнере
docker-compose exec backend python manage.py collectstatic --noinput --clear

# 2. Проверьте, что файлы собраны
docker-compose exec backend ls -la /staticfiles/admin/css/

# 3. Скопируйте файлы в nginx контейнер
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/

# 4. Проверьте файлы в nginx
docker-compose exec nginx ls -la /staticfiles/admin/css/

# 5. Перезапустите nginx
docker-compose restart nginx
```

### Вариант 3: Полное переразвертывание

```bash
# 1. Остановите контейнеры
docker-compose down

# 2. Запустите с исправлением
./deploy_docker.sh
```

## 🔍 Проверка результата

### Статус контейнеров
```bash
docker-compose ps
```

### Статические файлы в nginx
```bash
docker-compose exec nginx ls -la /staticfiles/admin/css/
```

### HTTP тест
```bash
curl -I http://localhost/static/admin/css/base.css
# Ожидаемый результат: HTTP/2 200
```

### Проверка через браузер
- Откройте: `https://video-call-ghost.ru/static/admin/css/base.css`
- Должен загрузиться CSS файл

## 📁 Созданные скрипты

- `fix_running_containers.sh` - исправление запущенных контейнеров
- `deploy_docker.sh` - полное развертывание с Docker
- `setup_static_files.sh` - настройка статических файлов (локально)

## ⚠️ Важные замечания

1. **Порядок выполнения:** Сначала backend, потом nginx
2. **Время ожидания:** Дайте контейнерам время на запуск
3. **Права доступа:** Убедитесь, что nginx может читать файлы
4. **Кэш:** Очистите кэш браузера после исправления

## 🎯 Результат

После исправления:
- ✅ Статические файлы собраны в backend контейнере
- ✅ Файлы скопированы в nginx контейнер
- ✅ CSS файлы админки доступны
- ✅ 404 ошибки устранены
- ✅ HTTP/2 200 ответы

## 📞 Если не работает

1. **Проверьте логи:**
   ```bash
   docker-compose logs nginx
   docker-compose logs backend
   ```

2. **Убедитесь, что файлы скопированы:**
   ```bash
   docker-compose exec nginx ls -la /staticfiles/
   ```

3. **Перезапустите nginx:**
   ```bash
   docker-compose restart nginx
   ```

4. **Очистите кэш браузера**

5. **Проверьте права доступа:**
   ```bash
   docker-compose exec nginx ls -la /staticfiles/admin/css/
   ```

## 🚀 Автоматизация

Для автоматического исправления при каждом запуске добавьте в `docker-compose.yml`:

```yaml
backend:
  command: >
    sh -c "
      python manage.py collectstatic --noinput --clear &&
      daphne -b 0.0.0.0 -p 8000 videocall_app.asgi:application
    "
```

Или используйте init-контейнер для копирования файлов в nginx.
