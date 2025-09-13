# Исправление 404 ошибок для статических файлов админки

## 🚨 Проблема
- HTTP/2 404 ошибки для CSS файлов админки Django
- Статические файлы не собираются или не доступны в nginx
- Админка отображается без стилей

## ✅ Быстрое решение

### На сервере выполните:

```bash
# 1. Соберите статические файлы в backend контейнере
docker-compose exec backend python manage.py collectstatic --noinput --clear

# 2. Скопируйте файлы в nginx контейнер
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/

# 3. Перезапустите nginx
docker-compose restart nginx
```

### Или используйте готовый скрипт:

```bash
./fix_running_containers.sh
```

## 🔍 Проверка

```bash
# Проверьте статические файлы
docker-compose exec nginx ls -la /staticfiles/admin/css/

# Проверьте HTTP
curl -I http://localhost/static/admin/css/base.css
# Ожидаемый результат: HTTP/2 200
```

## 📁 Созданные файлы

- `fix_running_containers.sh` - исправление запущенных контейнеров
- `deploy_docker.sh` - полное развертывание
- `setup_static_files.sh` - локальная настройка
- `SERVER_FIX.md` - подробная инструкция

## 🎯 Результат

После исправления:
- ✅ Статические файлы доступны в nginx
- ✅ CSS файлы админки загружаются
- ✅ 404 ошибки устранены
- ✅ Админка отображается с правильными стилями

## ⚠️ Важно

1. **Порядок:** Сначала backend, потом nginx
2. **Время:** Дайте контейнерам время на запуск
3. **Кэш:** Очистите кэш браузера
4. **Права:** Убедитесь, что nginx может читать файлы

## 📞 Поддержка

Если проблема сохраняется:
1. Проверьте логи: `docker-compose logs nginx`
2. Убедитесь, что файлы скопированы
3. Перезапустите nginx
4. Очистите кэш браузера
