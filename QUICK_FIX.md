# Быстрое исправление 404 ошибок для статических файлов админки

## Проблема
404 ошибки для CSS файлов админки Django при запуске в Docker контейнере.

## Решение

### 1. Пересоберите контейнеры
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 2. Проверьте статические файлы
```bash
# Проверка в контейнере
docker-compose exec backend ls -la /staticfiles/admin/css/

# Тест через браузер
# Откройте: https://video-call-ghost.ru/static/admin/css/base.css
```

### 3. Если проблема сохраняется
```bash
# Принудительный сбор статических файлов
docker-compose exec backend /usr/local/bin/collect_static_simple.sh
```

## Что было исправлено

1. ✅ Созданы скрипты для сбора статических файлов
2. ✅ Обновлен Dockerfile для включения скриптов
3. ✅ Обновлен docker-compose.yml для автоматического сбора
4. ✅ Создан файл временных настроек для сбора без БД
5. ✅ Добавлена проверка статических файлов при запуске backend

## Файлы изменены

- `backend/Dockerfile` - добавлены скрипты
- `backend/collect_static.sh` - полный скрипт с БД
- `backend/collect_static_simple.sh` - упрощенный скрипт
- `docker-compose.yml` - обновлены команды запуска
- `STATIC_FILES_FIX.md` - подробная документация

## Результат

После применения исправлений:
- ✅ Статические файлы Django собираются автоматически
- ✅ CSS файлы админки доступны по `/static/admin/css/`
- ✅ Админка отображается с правильными стилями
- ✅ 404 ошибки устранены
