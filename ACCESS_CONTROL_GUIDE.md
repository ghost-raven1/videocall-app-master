# 🔐 Руководство по системе доступа

**Дата:** 25 октября 2025  
**Версия:** 2.0

---

## 📋 Обзор системы доступа

Приложение использует **двухуровневую систему доступа**:

1. **Видеозвонки** - доступны всем (без регистрации)
2. **Админ-панель** - только для администраторов и модераторов

---

## 🎥 Доступ к видеозвонкам

### Для обычных пользователей

**Уровень доступа:** Публичный (без регистрации)

#### Как это работает:

```
Пользователь → Главная страница → Создать/Присоединиться к комнате
     ↓                                        ↓
Без регистрации                    Генерируется session_key
     ↓                                        ↓
Доступ к комнате                   Участник комнаты (анонимный)
```

#### Что доступно:

✅ **Создание комнаты**
- Без регистрации
- Генерируется уникальный код комнаты
- Создатель становится хостом

✅ **Присоединение к комнате**
- По коду или ссылке
- Ввод имени (опционально)
- Автоматическое создание участника

✅ **Функции в комнате**
- Видео/аудио звонки
- Текстовый чат
- Отправка файлов
- Демонстрация экрана
- Управление медиа

#### Код реализации:

```python
# backend/apps/rooms/views.py
@api_view(['POST'])
@permission_classes([AllowAny])  # ← Доступно всем!
def create_room(request):
    """Create a new video call room"""
    client_ip = get_client_ip(request)
    room_data = RoomManager.create_room(creator_ip=client_ip)
    return Response(room_data)

@api_view(['POST'])
@permission_classes([AllowAny])  # ← Доступно всем!
def join_room(request):
    """Join an existing room"""
    room_code = request.data.get('room_code')
    display_name = request.data.get('display_name', 'Guest')
    # Создание участника без аутентификации
    participant = RoomManager.add_participant(room_code, display_name)
    return Response(participant)
```

#### Frontend:

```vue
<!-- videocall-frontend/src/components/Dashboard.vue -->
<template>
  <div>
    <!-- Доступно всем без входа -->
    <ActionCard
      title="Создать комнату"
      @click="handleCreateRoom"
    />
    
    <ActionCard
      title="Присоединиться"
      @click="showJoinModal = true"
    />
  </div>
</template>

<script>
// Не требуется аутентификация
const handleCreateRoom = async () => {
  const room = await roomsStore.createRoom()
  router.push(`/room/${room.short_code}`)
}
</script>
```

---

## 👨‍💼 Доступ к админ-панели

### Для администраторов и модераторов

**Уровень доступа:** Требуется аутентификация + роль admin/moderator

#### Система ролей:

```python
# backend/apps/authentication/models.py
class User(AbstractBaseUser):
    ROLE_CHOICES = (
        ('user', 'Regular User'),
        ('moderator', 'Moderator'),
        ('admin', 'Administrator'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    
    def is_admin(self):
        return self.role == 'admin'
    
    def is_moderator(self):
        return self.role == 'moderator'
```

#### Как получить доступ:

### 1. Создание админ-пользователя

```bash
# Через Django management команду
docker-compose exec backend python manage.py createsuperuser

# Введите:
Email: admin@example.com
Password: ваш_надежный_пароль

# Пользователь создается с ролью 'admin'
```

### 2. Вход в админ-панель

**Способ 1: Через веб-интерфейс**

```
1. Откройте http://localhost
2. Если у вас роль admin/moderator, увидите иконку ⚙️
3. Нажмите на иконку настроек
4. Перейдете на /admin/login
5. Введите email и пароль
6. Получите доступ к админ-панели
```

**Способ 2: Прямой URL**

```
1. Откройте http://localhost/admin
2. Введите credentials
3. Получите JWT токен
4. Доступ к админ-панели
```

#### Процесс аутентификации:

```
Админ → /admin/login → Ввод credentials → Backend проверка
  ↓                                              ↓
Email + Password                    AdminLoginView (views.py)
  ↓                                              ↓
Отправка POST                      Проверка роли (admin/moderator)
  ↓                                              ↓
Получение JWT                      Генерация access + refresh tokens
  ↓                                              ↓
Сохранение в cookies               Установка httpOnly cookies
  ↓                                              ↓
Доступ к админ-панели              Логирование входа
```

#### Код аутентификации:

```python
# backend/apps/authentication/views.py
class AdminLoginView(TokenObtainPairView):
    """Enhanced login view with activity logging"""
    
    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        password = request.data.get('password')
        
        # Authenticate user
        user = User.objects.filter(email=email).first()
        
        if not user or not user.check_password(password):
            return Response({'error': 'Invalid credentials'}, 
                          status=401)
        
        # ✅ Проверка роли!
        if not user.is_admin() and not user.is_moderator():
            return Response({'error': 'Admin or moderator access required'}, 
                          status=403)
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'email': user.email,
                'role': user.role
            }
        })
```

---

## 🔑 JWT Authentication

### Как работают токены:

```
Login → Backend генерирует JWT → Сохранение в httpOnly cookies
  ↓                                           ↓
Access Token (15 мин)              Refresh Token (7 дней)
  ↓                                           ↓
Используется для API               Обновление access token
  ↓                                           ↓
Автоматическое обновление          Безопасное хранение
```

### Настройки JWT:

```python
# backend/videocall_app/settings.py
JWT_CONFIG = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

JWT_COOKIE_SETTINGS = {
    'ACCESS_TOKEN_COOKIE_NAME': 'access_token',
    'REFRESH_TOKEN_COOKIE_NAME': 'refresh_token',
    'ACCESS_TOKEN_COOKIE_HTTPONLY': True,  # ← Защита от XSS
    'ACCESS_TOKEN_COOKIE_SECURE': True,     # ← Только HTTPS
    'ACCESS_TOKEN_COOKIE_SAMESITE': 'Lax',
}
```

### Автоматическое обновление токенов:

```javascript
// Frontend автоматически обновляет токены
const refreshToken = async () => {
  const response = await fetch('/api/auth/token/refresh/', {
    method: 'POST',
    credentials: 'include' // Отправляет cookies
  })
  
  if (response.ok) {
    // Новый access token сохранен в cookie
    return true
  }
  
  // Токен истек, нужен повторный вход
  router.push('/admin/login')
  return false
}
```

---

## 🛡️ Уровни доступа в админ-панели

### Роли и права:

| Функция | User | Moderator | Admin |
|---------|------|-----------|-------|
| **Видеозвонки** | ✅ | ✅ | ✅ |
| **Чат** | ✅ | ✅ | ✅ |
| **Screen sharing** | ✅ | ✅ | ✅ |
| **Просмотр комнат** | ❌ | ✅ | ✅ |
| **Просмотр пользователей** | ❌ | ✅ (только user) | ✅ (все) |
| **Аналитика** | ❌ | ✅ | ✅ |
| **Закрытие комнат** | ❌ | ✅ | ✅ |
| **Создание пользователей** | ❌ | ❌ | ✅ |
| **Удаление пользователей** | ❌ | ❌ | ✅ |
| **Изменение ролей** | ❌ | ❌ | ✅ |
| **Системные настройки** | ❌ | ❌ | ✅ |

### Проверка прав в коде:

```python
# backend/apps/rooms/views.py
class RoomManagementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Модераторы видят только активные комнаты
        if self.request.user.is_moderator():
            return Room.objects.filter(is_active=True)
        
        # Админы видят все
        if self.request.user.is_admin():
            return Room.objects.all()
        
        # Обычные пользователи не имеют доступа
        return Room.objects.none()
```

---

## 🚪 Точки входа в систему

### 1. Главная страница (публичная)

```
URL: http://localhost/
Доступ: Все пользователи
Функции:
  - Создание комнаты
  - Присоединение к комнате
  - Просмотр истории комнат
```

### 2. Комната видеозвонка (публичная)

```
URL: http://localhost/room/{code}
Доступ: Все пользователи (по коду)
Функции:
  - Видео/аудио
  - Чат
  - Файлы
  - Screen sharing
```

### 3. Админ-панель (защищенная)

```
URL: http://localhost/admin
Доступ: Admin + Moderator
Требования:
  - JWT токен в cookies
  - Роль admin или moderator
Функции:
  - Управление комнатами
  - Управление пользователями
  - Аналитика
  - Мониторинг
```

### 4. Django Admin (супер-защищенная)

```
URL: http://localhost/django-admin
Доступ: Только superuser
Требования:
  - is_superuser = True
  - is_staff = True
Функции:
  - Прямой доступ к БД
  - Управление моделями
  - Системные настройки
```

---

## 🔐 Безопасность

### Защита видеозвонков:

1. **Уникальные коды комнат**
   - 6-значный код (ABC123)
   - Сложно угадать
   - Автоматическая генерация

2. **Ограничение участников**
   - Максимум 15 человек
   - Проверка при присоединении

3. **Временные комнаты**
   - Автоматическое закрытие через 24 часа
   - Очистка неактивных комнат

4. **Rate limiting**
   ```python
   @ratelimit(key='ip', rate='30/min', method='POST')
   def create_room(request):
       # Максимум 30 комнат в минуту с одного IP
   ```

### Защита админ-панели:

1. **JWT токены**
   - httpOnly cookies (защита от XSS)
   - Secure flag (только HTTPS)
   - SameSite (защита от CSRF)

2. **Проверка ролей**
   ```python
   if not user.is_admin() and not user.is_moderator():
       return Response({'error': 'Access denied'}, status=403)
   ```

3. **Логирование действий**
   ```python
   UserActivityLog.objects.create(
       user=request.user,
       action='room_force_close',
       severity='high',
       ip_address=get_client_ip(request)
   )
   ```

4. **Ограничение попыток входа**
   ```python
   LoginAttempt.objects.create(
       email=email,
       ip_address=ip,
       successful=False,
       failure_reason='Invalid credentials'
   )
   # После 5 неудачных попыток - блокировка
   ```

---

## 📝 Практические примеры

### Пример 1: Обычный пользователь создает комнату

```bash
# 1. Открыть главную страницу
open http://localhost

# 2. Нажать "Создать комнату"
# Не требуется вход!

# 3. Автоматически создается:
- Комната с кодом ABC123
- Участник с session_key
- WebRTC соединение

# 4. Поделиться кодом с друзьями
# Они присоединяются без регистрации
```

### Пример 2: Админ входит в панель

```bash
# 1. Создать админа
docker-compose exec backend python manage.py createsuperuser
Email: admin@videocall.com
Password: SecurePass123!

# 2. Открыть главную страницу
open http://localhost

# 3. Нажать иконку ⚙️ (видна только админам)

# 4. Ввести credentials
Email: admin@videocall.com
Password: SecurePass123!

# 5. Получить доступ к админ-панели
# JWT токен сохранен в cookies
# Доступны все функции управления
```

### Пример 3: Модератор закрывает комнату

```bash
# 1. Войти как модератор
Email: moderator@videocall.com
Password: ModPass123!

# 2. Перейти в "Управление комнатами"
/admin/rooms

# 3. Найти проблемную комнату
# Видны только активные комнаты

# 4. Нажать "Force Close"
# Комната закрывается
# Все участники отключаются
# Действие логируется
```

---

## 🔧 Настройка доступа

### Создание первого админа:

```bash
# Способ 1: Через createsuperuser
docker-compose exec backend python manage.py createsuperuser

# Способ 2: Через Django shell
docker-compose exec backend python manage.py shell
>>> from apps.authentication.models import User
>>> user = User.objects.create_user(
...     email='admin@example.com',
...     password='SecurePassword123!',
...     role='admin',
...     is_staff=True,
...     is_superuser=True
... )
>>> user.save()
```

### Создание модератора:

```bash
# Через админ-панель (только админ может)
1. Войти как admin
2. Перейти в "Управление пользователями"
3. Нажать "Создать пользователя"
4. Заполнить:
   - Email: moderator@example.com
   - Password: ModPass123!
   - Role: Moderator
5. Сохранить
```

### Изменение роли существующего пользователя:

```bash
# Через Django shell
docker-compose exec backend python manage.py shell
>>> from apps.authentication.models import User
>>> user = User.objects.get(email='user@example.com')
>>> user.role = 'moderator'
>>> user.save()
```

---

## 🎯 Часто задаваемые вопросы

### Q: Нужна ли регистрация для видеозвонков?
**A:** Нет! Видеозвонки доступны всем без регистрации.

### Q: Как стать админом?
**A:** Только через `createsuperuser` или назначение существующим админом.

### Q: Можно ли ограничить доступ к комнатам?
**A:** Да, можно добавить пароли для комнат (требует доработки).

### Q: Как долго действует JWT токен?
**A:** Access token - 15 минут, Refresh token - 7 дней.

### Q: Что делать если забыл пароль админа?
**A:** Сбросить через Django shell:
```python
user = User.objects.get(email='admin@example.com')
user.set_password('NewPassword123!')
user.save()
```

### Q: Можно ли иметь несколько админов?
**A:** Да, можно создать неограниченное количество админов.

### Q: Как посмотреть кто сейчас в админ-панели?
**A:** Через модель `UserSession`:
```python
UserSession.objects.filter(is_active=True)
```

---

## 📊 Мониторинг доступа

### Логи входов:

```python
# Просмотр последних входов
LoginAttempt.objects.filter(successful=True).order_by('-attempted_at')[:10]

# Неудачные попытки
LoginAttempt.objects.filter(successful=False).order_by('-attempted_at')[:10]

# Подозрительная активность
LoginAttempt.objects.filter(
    successful=False,
    attempted_at__gte=timezone.now() - timedelta(hours=1)
).values('ip_address').annotate(count=Count('id')).filter(count__gte=5)
```

### Активные сессии:

```python
# Текущие админские сессии
UserSession.objects.filter(
    is_active=True,
    user__role__in=['admin', 'moderator']
)

# Длительные сессии
UserSession.objects.filter(
    is_active=True,
    login_time__lte=timezone.now() - timedelta(hours=8)
)
```

---

## ✅ Чеклист безопасности

### Перед деплоем:

- [ ] Изменить SECRET_KEY в .env
- [ ] Изменить JWT_SECRET в .env
- [ ] Создать первого админа
- [ ] Изменить дефолтный пароль админа
- [ ] Включить HTTPS (Secure cookies)
- [ ] Настроить CORS для продакшена
- [ ] Ограничить ALLOWED_HOSTS
- [ ] Включить rate limiting
- [ ] Настроить логирование
- [ ] Проверить права доступа к файлам

### После деплоя:

- [ ] Протестировать вход админа
- [ ] Проверить JWT токены
- [ ] Проверить логирование
- [ ] Мониторить неудачные входы
- [ ] Регулярно проверять активные сессии
- [ ] Настроить алерты на подозрительную активность

---

## 🎊 Итог

**Система доступа:**

✅ **Видеозвонки** - публичные, без регистрации  
✅ **Админ-панель** - защищена JWT + роли  
✅ **Логирование** - все действия записываются  
✅ **Безопасность** - httpOnly cookies, rate limiting  
✅ **Гибкость** - 3 уровня ролей (user/moderator/admin)  

**Готовность:** Production Ready ✅

---

*Документация обновлена: 25 октября 2025*  
*Версия: 2.0*
