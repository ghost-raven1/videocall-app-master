# 🚀 Следующие шаги рефакторинга

**Дата:** 2025-01-27  
**Текущий статус:** Фаза 1-4 завершены, тестирование завершено ✅

---

## 📋 Оставшиеся задачи

### 1. Создать useRecordingController ✅

**Приоритет:** Высокий  
**Оценка:** 2-3 часа  
**Статус:** ✅ Завершено

**Что сделано:**
- ✅ Вынесена логика записи из `VideoCall.vue` и `RecordingControls.vue`
- ✅ Создан контроллер: `controllers/recording/useRecordingController.ts` (340+ строк)
- ✅ Интегрирован в `useVideoCallController`
- ✅ Интегрирован в `VideoCall.vue`
- ✅ Созданы тесты для контроллера (20+ тестов)

**Текущая логика в VideoCall.vue:**
- `isRecording` - состояние записи
- `toggleRecording()` - переключение записи
- `onRecordingStarted()` - обработчик старта записи
- `onRecordingStopped()` - обработчик остановки записи
- `onRecordingToggled()` - обработчик переключения записи

**Текущая логика в RecordingControls.vue:**
- `startRecording()` - старт записи
- `stopRecording()` - остановка записи
- `loadRecordings()` - загрузка списка записей
- `recordingDuration` - длительность записи
- Таймер длительности записи

**План реализации:**
```typescript
// controllers/recording/useRecordingController.ts
export function useRecordingController(roomCode: string, participantId: string) {
  const isRecording = ref(false)
  const recordingDuration = ref(0)
  const recordings = ref([])
  const isProcessing = ref(false)
  const error = ref<string | null>(null)
  
  const startRecording = async () => { /* ... */ }
  const stopRecording = async () => { /* ... */ }
  const loadRecordings = async () => { /* ... */ }
  const toggleRecording = async () => { /* ... */ }
  
  return { /* ... */ }
}
```

---

### 2. Создать useConnectionQualityController ⏳

**Приоритет:** Средний  
**Оценка:** 1-2 часа

**Что нужно сделать:**
- Вынести логику мониторинга качества соединения из `VideoCall.vue`
- Создать контроллер: `controllers/video-call/useConnectionQualityController.ts`
- Интегрировать в `useVideoCallController`

**Текущая логика в VideoCall.vue:**
- `connectionStats` - статистика соединения
- `statsMonitor` - монитор статистики
- `startStatsMonitoring()` - запуск мониторинга
- `isInFallbackMode` - режим fallback
- `currentFallbackMode` - текущий режим fallback
- `connectionQualityWarnings` - предупреждения о качестве
- `showConnectionHelp` - показ помощи по соединению

**План реализации:**
```typescript
// controllers/video-call/useConnectionQualityController.ts
export function useConnectionQualityController(peerConnection: RTCPeerConnection) {
  const connectionStats = ref(null)
  const connectionQuality = ref(100)
  const isInFallbackMode = ref(false)
  const fallbackMode = ref<'audio_only' | 'chat_only' | null>(null)
  const warnings = ref([])
  
  const startMonitoring = () => { /* ... */ }
  const stopMonitoring = () => { /* ... */ }
  const checkQuality = () => { /* ... */ }
  
  return { /* ... */ }
}
```

---

### 3. Финальная очистка VideoCall.vue ⏳

**Приоритет:** Высокий  
**Оценка:** 2-3 часа

**Что нужно сделать:**
- Удалить всю оставшуюся бизнес-логику из `VideoCall.vue`
- Оставить только UI и привязку к контроллерам
- Упростить компонент до ~300-400 строк (только template + минимальный script)

**Что нужно удалить/переместить:**
- Всю логику записи → `useRecordingController`
- Всю логику мониторинга качества → `useConnectionQualityController`
- Обработчики событий, которые можно делегировать контроллерам
- Дублирующие computed свойства
- Неиспользуемые методы

**Целевая структура VideoCall.vue:**
```vue
<template>
  <!-- Только UI, без логики -->
</template>

<script setup lang="ts">
// Минимум импортов
// Только инициализация контроллеров
// Только привязка к template
</script>
```

---

### 4. Создать тесты для новых контроллеров ⏳

**Приоритет:** Высокий  
**Оценка:** 2-3 часа

**Что нужно сделать:**
- Тесты для `useRecordingController` (15+ тестов)
- Тесты для `useConnectionQualityController` (10+ тестов)

---

## 📊 Приоритизация

### Вариант 1: Быстрый результат (рекомендуется)
1. ✅ Создать `useRecordingController` (2-3 часа)
2. ✅ Интегрировать в `VideoCall.vue` (30 мин)
3. ✅ Создать тесты (1-2 часа)
4. ✅ Финальная очистка `VideoCall.vue` (1-2 часа)

**Итого:** 5-8 часов работы

### Вариант 2: Полный рефакторинг
1. ✅ Создать `useRecordingController` (2-3 часа)
2. ✅ Создать `useConnectionQualityController` (1-2 часа)
3. ✅ Интегрировать оба контроллера (1 час)
4. ✅ Создать тесты для обоих (2-3 часа)
5. ✅ Финальная очистка `VideoCall.vue` (2-3 часа)

**Итого:** 8-12 часов работы

---

## 🎯 Рекомендация

**Начать с Варианта 1:**
- Быстрее достичь результата
- `useRecordingController` - самая большая оставшаяся логика
- `useConnectionQualityController` можно сделать позже, если нужно

**После завершения:**
- `VideoCall.vue` будет значительно упрощен
- Вся бизнес-логика будет в контроллерах
- Все контроллеры будут покрыты тестами

---

*Документ создан: 2025-01-27*

