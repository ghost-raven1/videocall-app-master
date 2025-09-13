# Быстрый старт - Исправление 404 ошибок

## 🚨 Проблема
- HTTP/2 404 ошибки для статических файлов админки
- Ошибка сборки nginx контейнера
- CSS файлы админки не загружаются

## ✅ Быстрое решение

### 1. Соберите статические файлы
```bash
./setup_static_files.sh
```

### 2. Запустите контейнеры
```bash
docker-compose up -d
```

### 3. Скопируйте статические файлы в nginx
```bash
docker cp backend/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/
docker-compose restart nginx
```

### 4. Проверьте результат
```bash
curl -I http://localhost/static/admin/css/base.css
# Ожидаемый результат: HTTP/2 200
```

## 🚀 Полное развертывание

Для полного развертывания с автоматическим исправлением:
```bash
./deploy.sh
```

## 🔍 Проверка

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
curl -I https://video-call-ghost.ru/static/admin/css/base.css
```

## 📁 Созданные файлы

- `setup_static_files.sh` - настройка статических файлов
- `deploy.sh` - полное развертывание
- `fix_static_files.sh` - локальное исправление
- `deploy_static_files.sh` - для продакшена
- `test_static_files.sh` - проверка

## ⚠️ Важно

1. **Порядок:** Сначала статические файлы, потом контейнеры
2. **Время:** Дайте контейнерам время на запуск
3. **Кэш:** Очистите кэш браузера
4. **Права:** Убедитесь, что nginx может читать файлы

## 🎯 Результат

После исправления:
- ✅ Контейнеры собираются без ошибок
- ✅ Статические файлы доступны
- ✅ CSS файлы админки загружаются
- ✅ 404 ошибки устранены
- ✅ HTTP/2 200 ответы

## 📞 Если не работает

1. Проверьте логи: `docker-compose logs nginx`
2. Убедитесь, что файлы скопированы: `docker-compose exec nginx ls -la /staticfiles/`
3. Перезапустите nginx: `docker-compose restart nginx`
4. Очистите кэш браузера
