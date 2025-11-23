# 📋 План рефакторинга: Вынос логики в контроллеры на фронте

**Дата создания:** 2025-01-27  
**Приоритет:** Высокий  
**Оценка:** 2-3 недели

---

## 🎯 Цель

Вынести бизнес-логику из Vue компонентов в отдельные контроллеры (composables/controllers) для улучшения:
- Разделения ответственности (Separation of Concerns)
- Тестируемости кода
- Переиспользования логики
- Поддерживаемости

---

## 📊 Текущее состояние

### Проблемы

1. **Большие компоненты с бизнес-логикой:**
   - `VideoCall.vue` - 1245 строк (логика управления звонком смешана с UI)
   - Компоненты содержат сложную логику обработки событий
   - Сложно тестировать UI отдельно от логики

2. **Дублирование логики:**
   - Похожая логика в разных компонентах
   - Сложно переиспользовать код между компонентами

3. **Сложность тестирования:**
   - Логика завязана на Vue компоненты
   - Сложно тестировать изолированно

---

## 🏗️ Архитектура контроллеров

### Структура директорий

```
videocall-frontend/src/
├── controllers/          # Новые контроллеры
│   ├── video-call/      # Контроллеры для видеозвонков
│   │   ├── useVideoCallController.ts
│   │   ├── useCallStateController.ts
│   │   ├── useMediaController.ts
│   │   └── useScreenShareController.ts
│   ├── room/            # Контроллеры для комнат
│   │   ├── useRoomController.ts
│   │   └── useRoomChatController.ts
│   └── recording/       # Контроллеры для записи
│       └── useRecordingController.ts
└── components/          # Компоненты (только UI)
    └── VideoCall.vue    # Упрощенный компонент
```

---

## 📝 План выполнения

### Фаза 1: Создание базовых контроллеров (1 неделя)

#### 1.1 Контроллер состояния звонка
**Файл:** `controllers/video-call/useCallStateController.ts`

**Ответственность:**
- Управление состоянием звонка (connecting, connected, disconnected)
- Обработка изменений состояния соединения
- Управление таймерами (длительность звонка)

**Методы:**
```typescript
export function useCallStateController() {
  const connectionState = ref<'connecting' | 'connected' | 'disconnected'>('connecting')
  const callDuration = ref(0)
  const connectionMessage = ref('')
  
  const startCall = () => { /* ... */ }
  const endCall = () => { /* ... */ }
  const updateConnectionState = (state) => { /* ... */ }
  const updateCallDuration = () => { /* ... */ }
  
  return {
    connectionState,
    callDuration,
    connectionMessage,
    startCall,
    endCall,
    updateConnectionState,
    updateCallDuration
  }
}
```

#### 1.2 Контроллер медиа
**Файл:** `controllers/video-call/useMediaController.ts`

**Ответственность:**
- Управление локальными медиа потоками (видео/аудио)
- Переключение видео/аудио
- Управление устройствами (камера, микрофон)

**Методы:**
```typescript
export function useMediaController() {
  const localStream = ref<MediaStream | null>(null)
  const isVideoEnabled = ref(true)
  const isAudioEnabled = ref(true)
  
  const initializeMedia = async () => { /* ... */ }
  const toggleVideo = () => { /* ... */ }
  const toggleAudio = () => { /* ... */ }
  const switchCamera = () => { /* ... */ }
  const switchMicrophone = () => { /* ... */ }
  
  return {
    localStream,
    isVideoEnabled,
    isAudioEnabled,
    initializeMedia,
    toggleVideo,
    toggleAudio,
    switchCamera,
    switchMicrophone
  }
}
```

#### 1.3 Контроллер screen sharing
**Файл:** `controllers/video-call/useScreenShareController.ts`

**Ответственность:**
- Управление screen sharing
- Обработка событий начала/остановки screen sharing
- Управление разрешениями

**Методы:**
```typescript
export function useScreenShareController() {
  const isScreenSharing = ref(false)
  const screenShareStream = ref<MediaStream | null>(null)
  
  const startScreenShare = async () => { /* ... */ }
  const stopScreenShare = () => { /* ... */ }
  const handleScreenShareError = (error) => { /* ... */ }
  
  return {
    isScreenSharing,
    screenShareStream,
    startScreenShare,
    stopScreenShare,
    handleScreenShareError
  }
}
```

---

### Фаза 2: Рефакторинг VideoCall компонента (1 неделя)

#### 2.1 Создание главного контроллера
**Файл:** `controllers/video-call/useVideoCallController.ts`

**Ответственность:**
- Координация всех контроллеров
- Инициализация звонка
- Обработка жизненного цикла звонка

**Структура:**
```typescript
export function useVideoCallController(roomId: string) {
  // Используем другие контроллеры
  const callState = useCallStateController()
  const media = useMediaController()
  const screenShare = useScreenShareController()
  const webrtcStore = useWebRTCStore()
  const roomsStore = useRoomsStore()
  
  const initializeCall = async () => {
    // Инициализация всех контроллеров
    await callState.startCall()
    await media.initializeMedia()
    await webrtcStore.initializeLocalMedia()
    // ...
  }
  
  const handleEndCall = async () => {
    // Очистка всех ресурсов
    await callState.endCall()
    await media.cleanup()
    await screenShare.stopScreenShare()
    // ...
  }
  
  return {
    // Экспортируем все контроллеры
    callState,
    media,
    screenShare,
    initializeCall,
    handleEndCall
  }
}
```

#### 2.2 Упрощение VideoCall.vue
**Изменения:**
- Удалить всю бизнес-логику
- Оставить только UI и привязку к контроллерам
- Использовать `useVideoCallController` для всей логики

**До:**
```vue
<script setup>
// 500+ строк логики
const isConnecting = ref(false)
const connectionState = ref('connecting')
// ... много логики
</script>
```

**После:**
```vue
<script setup>
import { useVideoCallController } from '@/controllers/video-call/useVideoCallController'

const route = useRoute()
const videoCall = useVideoCallController(route.params.roomId)

// Используем контроллер
const { callState, media, screenShare, initializeCall, handleEndCall } = videoCall

onMounted(() => {
  initializeCall()
})
</script>
```

---

### Фаза 3: Контроллеры для комнат и чата (3-5 дней)

#### 3.1 Контроллер комнаты
**Файл:** `controllers/room/useRoomController.ts`

**Ответственность:**
- Управление информацией о комнате
- Обработка событий комнаты (создание, присоединение, выход)
- Управление участниками

#### 3.2 Контроллер чата
**Файл:** `controllers/room/useRoomChatController.ts`

**Ответственность:**
- Управление сообщениями чата
- Обработка отправки/получения сообщений
- Управление файлами в чате

---

### Фаза 4: Контроллер записи (2-3 дня)

#### 4.1 Контроллер записи
**Файл:** `controllers/recording/useRecordingController.ts`

**Ответственность:**
- Управление записью звонка
- Обработка событий записи
- Управление файлами записи

---

## ✅ Критерии успеха

1. **Разделение ответственности:**
   - Компоненты содержат только UI логику
   - Вся бизнес-логика в контроллерах

2. **Тестируемость:**
   - Контроллеры можно тестировать изолированно
   - Компоненты тестируются с моками контроллеров

3. **Переиспользование:**
   - Контроллеры можно использовать в разных компонентах
   - Логика не дублируется

4. **Поддерживаемость:**
   - Код легче понимать и изменять
   - Четкая структура и ответственность

---

## 📊 Метрики

### До рефакторинга:
- `VideoCall.vue`: 1245 строк (логика + UI)
- Тестируемость: Низкая (логика завязана на компоненты)
- Переиспользование: Низкое (логика в компонентах)

### После рефакторинга:
- `VideoCall.vue`: ~300 строк (только UI)
- Контроллеры: ~800 строк (вся логика)
- Тестируемость: Высокая (контроллеры тестируются изолированно)
- Переиспользование: Высокое (контроллеры переиспользуются)

---

## 🚀 Следующие шаги

1. ✅ **Создать структуру директорий** для контроллеров - ВЫПОЛНЕНО
2. ✅ **Создать useCallStateController** - ВЫПОЛНЕНО
3. ✅ **Создать useMediaController** - ВЫПОЛНЕНО
4. ✅ **Создать useScreenShareController** - ВЫПОЛНЕНО
5. ✅ **Создать useVideoCallController** - ВЫПОЛНЕНО
6. ✅ **Рефакторинг VideoCall.vue** - ЗАВЕРШЕНО (основная интеграция)
7. 🟡 **Добавить тесты** для каждого контроллера - В ПРОЦЕССЕ
   - ✅ useCallStateController тесты созданы
   - ⏳ useMediaController тесты
   - ⏳ useScreenShareController тесты
   - ⏳ useVideoCallController тесты
   - ⏳ useRoomChatController тесты
8. ✅ **Обновить документацию** - ВЫПОЛНЕНО

---

## ✅ Выполнено (Фаза 1)

### Созданные контроллеры:

1. **useCallStateController** ✅
   - Управление состоянием звонка
   - Таймер длительности звонка
   - Сообщения о состоянии соединения

2. **useMediaController** ✅
   - Управление медиа потоками
   - Переключение видео/аудио
   - Интеграция с WebRTC store

3. **useScreenShareController** ✅
   - Управление screen sharing
   - Обработка разрешений
   - Обработка ошибок

4. **useVideoCallController** ✅
   - Главный контроллер
   - Координация всех под-контроллеров
   - Управление жизненным циклом звонка

---

## 📝 Примечания

- Использовать Vue 3 Composition API (composables)
- Следовать паттерну "Single Responsibility Principle"
- Каждый контроллер должен иметь четкую ответственность
- Тесты должны покрывать все контроллеры на 80%+

---

---

## 📊 Текущий прогресс

### Созданные контроллеры:
- ✅ useCallStateController (235 строк)
- ✅ useMediaController (261 строка)
- ✅ useScreenShareController (261 строка)
- ✅ useVideoCallController (225 строк)
- ✅ useRoomChatController (280+ строк)

**Итого:** ~1200 строк контроллеров

### Интеграция:
- ✅ VideoCall.vue использует все созданные контроллеры
- ✅ Удален дублирующий код
- ✅ Улучшена структура компонента

### Тесты:
- ✅ useCallStateController.test.ts создан
- ⏳ Остальные тесты в процессе

---

*План обновлен: 2025-01-27*

