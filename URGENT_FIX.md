# СРОЧНОЕ ИСПРАВЛЕНИЕ 404 ошибок

## 🚨 Проблема
Все статические файлы админки возвращают 404 ошибки:
- base.css, dark_mode.css, forms.css, nav_sidebar.css, responsive.css
- theme.js, nav_sidebar.js, jquery.min.js, collapse.js, core.js, actions.js
- И другие файлы

## ✅ НЕМЕДЛЕННОЕ РЕШЕНИЕ

### Шаг 1: Диагностика
```bash
./diagnose.sh
```

### Шаг 2: Исправление
```bash
# 1. Соберите статические файлы в backend
docker-compose exec backend python manage.py collectstatic --noinput --clear

# 2. Скопируйте файлы в nginx
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/

# 3. Установите права доступа
docker-compose exec nginx chown -R nginx:nginx /staticfiles/
docker-compose exec nginx chmod -R 755 /staticfiles/

# 4. Перезапустите nginx
docker-compose restart nginx
```

### Шаг 3: Проверка
```bash
# Проверьте файлы в nginx
docker-compose exec nginx ls -la /staticfiles/admin/css/

# Проверьте HTTP
curl -I http://localhost/static/admin/css/base.css
# Ожидаемый результат: HTTP/2 200
```

## 🚀 АЛЬТЕРНАТИВНОЕ РЕШЕНИЕ

Если вышеуказанное не работает:

```bash
# Полное переразвертывание
docker-compose down
docker-compose up -d
sleep 20
./quick_fix.sh
```

## 🔍 ПРОВЕРКА РЕЗУЛЬТАТА

После исправления должны быть доступны:
- ✅ https://video-call-ghost.ru/static/admin/css/base.css
- ✅ https://video-call-ghost.ru/static/admin/css/forms.css
- ✅ https://video-call-ghost.ru/static/admin/js/core.js
- ✅ https://video-call-ghost.ru/static/admin/js/actions.js

## 📞 ЕСЛИ НЕ РАБОТАЕТ

1. **Проверьте логи:**
   ```bash
   docker-compose logs nginx
   ```

2. **Убедитесь, что файлы скопированы:**
   ```bash
   docker-compose exec nginx ls -la /staticfiles/admin/css/
   ```

3. **Перезапустите nginx:**
   ```bash
   docker-compose restart nginx
   ```

4. **Очистите кэш браузера**

## 🎯 РЕЗУЛЬТАТ

После исправления:
- ✅ Все статические файлы доступны
- ✅ 404 ошибки устранены
- ✅ Админка отображается с правильными стилями
- ✅ HTTP/2 200 ответы для всех файлов
