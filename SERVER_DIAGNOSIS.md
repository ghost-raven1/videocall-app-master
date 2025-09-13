# Диагностика и исправление 404 ошибок на сервере

## 🔍 Диагностика

### 1. Проверьте статус контейнеров
```bash
docker-compose ps
```

### 2. Проверьте, есть ли статические файлы в backend контейнере
```bash
docker-compose exec backend ls -la /staticfiles/admin/css/
```

### 3. Проверьте, есть ли статические файлы в nginx контейнере
```bash
docker-compose exec nginx ls -la /staticfiles/admin/css/
```

### 4. Проверьте логи nginx
```bash
docker-compose logs nginx | grep static
```

## 🚨 Возможные причины 404 ошибок

### Причина 1: Статические файлы не собраны в backend
**Решение:**
```bash
docker-compose exec backend python manage.py collectstatic --noinput --clear
```

### Причина 2: Статические файлы не скопированы в nginx
**Решение:**
```bash
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/
```

### Причина 3: Nginx не может найти файлы
**Решение:**
```bash
# Проверьте конфигурацию nginx
docker-compose exec nginx cat /etc/nginx/nginx.conf | grep -A 10 "location /static/"
```

### Причина 4: Права доступа
**Решение:**
```bash
# Установите правильные права
docker-compose exec nginx chown -R nginx:nginx /staticfiles/
docker-compose exec nginx chmod -R 755 /staticfiles/
```

## ✅ Полное исправление

### Шаг 1: Соберите статические файлы
```bash
docker-compose exec backend python manage.py collectstatic --noinput --clear
```

### Шаг 2: Скопируйте файлы в nginx
```bash
docker cp $(docker-compose ps -q backend):/staticfiles/. $(docker-compose ps -q nginx):/staticfiles/
```

### Шаг 3: Установите права доступа
```bash
docker-compose exec nginx chown -R nginx:nginx /staticfiles/
docker-compose exec nginx chmod -R 755 /staticfiles/
```

### Шаг 4: Перезапустите nginx
```bash
docker-compose restart nginx
```

### Шаг 5: Проверьте результат
```bash
# Проверьте файлы в nginx
docker-compose exec nginx ls -la /staticfiles/admin/css/

# Проверьте HTTP
curl -I http://localhost/static/admin/css/base.css
```

## 🔧 Альтернативное решение

Если проблема сохраняется, попробуйте:

### 1. Пересоздайте контейнеры
```bash
docker-compose down
docker-compose up -d
```

### 2. Используйте готовый скрипт
```bash
./quick_fix.sh
```

### 3. Проверьте volume монтирование
```bash
# Проверьте, что volume смонтирован
docker-compose exec nginx ls -la /staticfiles/
```

## 📊 Ожидаемый результат

После исправления в nginx контейнере должны быть файлы:
```
/staticfiles/admin/css/
├── base.css
├── dark_mode.css
├── forms.css
├── nav_sidebar.css
├── responsive.css
└── ...

/staticfiles/admin/js/
├── actions.js
├── change_form.js
├── collapse.js
├── core.js
├── jquery.init.js
├── nav_sidebar.js
├── prepopulate_init.js
├── prepopulate.js
├── theme.js
├── urlify.js
└── vendor/jquery/jquery.min.js
```

## 🎯 Проверка

### HTTP тесты
```bash
curl -I http://localhost/static/admin/css/base.css
# Ожидаемый результат: HTTP/2 200

curl -I http://localhost/static/admin/js/core.js
# Ожидаемый результат: HTTP/2 200
```

### Браузер
- Откройте: `https://video-call-ghost.ru/static/admin/css/base.css`
- Должен загрузиться CSS файл

## 📞 Если не работает

1. **Проверьте логи:**
   ```bash
   docker-compose logs nginx
   docker-compose logs backend
   ```

2. **Убедитесь, что файлы скопированы:**
   ```bash
   docker-compose exec nginx ls -la /staticfiles/admin/css/
   ```

3. **Проверьте права доступа:**
   ```bash
   docker-compose exec nginx ls -la /staticfiles/
   ```

4. **Перезапустите nginx:**
   ```bash
   docker-compose restart nginx
   ```

5. **Очистите кэш браузера**
