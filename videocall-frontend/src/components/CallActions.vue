<template>
  <div class="warp-page-inner space-y-10">
    <!-- Hero -->
    <section class="text-center space-y-4 animate-fade-in">
      <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-warp-text">
        <span class="align-middle mr-3 text-3xl">📹</span>
        Видеозвонки в реальном времени
      </h1>
      <p class="max-w-xl mx-auto text-sm md:text-base text-warp-muted">
        Создайте защищённую комнату или присоединитесь по коду. Высокое качество видео и звука, чат и демонстрация экрана.
      </p>
    </section>

    <!-- Main actions -->
    <section class="grid gap-6 md:grid-cols-2 animate-slide-up">
      <!-- Создать новый звонок -->
      <div class="card p-6 md:p-8 flex flex-col gap-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-warp-text mb-1">
              Создать новый звонок
            </h2>
            <p class="text-sm text-warp-muted">
              Создайте комнату и поделитесь коротким кодом приглашения.
            </p>
          </div>
          <span class="text-2xl">✨</span>
        </div>

        <div class="space-y-4">
          <div>
            <label
              for="userName"
              class="block text-xs font-semibold uppercase tracking-wide text-warp-muted mb-1.5"
            >
              Ваше имя (необязательно)
            </label>
            <input
              id="userName"
              v-model="userName"
              type="text"
              placeholder="Введите ваше имя"
              class="input-field"
              maxlength="50"
            />
          </div>

          <div>
            <label
              for="roomPassword"
              class="block text-xs font-semibold uppercase tracking-wide text-warp-muted mb-1.5"
            >
              Пароль комнаты (необязательно)
            </label>
            <input
              id="roomPassword"
              v-model="roomPassword"
              type="password"
              placeholder="Установите пароль для защиты комнаты"
              class="input-field"
              maxlength="50"
            />
          </div>
        </div>

        <button
          @click="createNewCall"
          :disabled="isCreating"
          class="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span v-if="!isCreating">🚀 Создать звонок</span>
          <span v-else class="flex items-center gap-2">
            <span class="spinner h-4 w-4"></span>
            Создание...
          </span>
        </button>
      </div>

      <!-- Присоединиться к звонку -->
      <div class="card p-6 md:p-8 flex flex-col gap-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-warp-text mb-1">
              Присоединиться к звонку
            </h2>
            <p class="text-sm text-warp-muted">
              Введите код комнаты, полученный от организатора.
            </p>
          </div>
          <span class="text-2xl">🔗</span>
        </div>

        <div class="space-y-4">
          <div>
            <label
              for="joinUserName"
              class="block text-xs font-semibold uppercase tracking-wide text-warp-muted mb-1.5"
            >
              Ваше имя (необязательно)
            </label>
            <input
              id="joinUserName"
              v-model="joinUserName"
              type="text"
              placeholder="Введите ваше имя"
              class="input-field"
              maxlength="50"
            />
          </div>

          <div>
            <label
              for="roomCode"
              class="block text-xs font-semibold uppercase tracking-wide text-warp-muted mb-1.5"
            >
              Код комнаты
            </label>
            <input
              id="roomCode"
              v-model="roomCode"
              type="text"
              placeholder="Например: ABC123"
              class="input-field text-center tracking-[0.3em] uppercase font-mono"
              :disabled="isJoining"
              @keyup.enter="joinCall"
              maxlength="10"
            />
          </div>

          <div>
            <label
              for="joinRoomPassword"
              class="block text-xs font-semibold uppercase tracking-wide text-warp-muted mb-1.5"
            >
              Пароль комнаты (если требуется)
            </label>
            <input
              id="joinRoomPassword"
              v-model="joinRoomPassword"
              type="password"
              placeholder="Введите пароль комнаты"
              class="input-field"
              :disabled="isJoining"
              @keyup.enter="joinCall"
              maxlength="50"
            />
          </div>
        </div>

        <button
          @click="joinCall"
          class="btn-secondary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="!roomCode || isJoining"
        >
          <span v-if="!isJoining">→ Присоединиться</span>
          <span v-else class="flex items-center gap-2">
            <span class="spinner h-4 w-4"></span>
            Присоединение...
          </span>
        </button>

        <p
          v-if="error"
          class="mt-2 text-xs text-red-400 bg-red-900/30 border border-red-500/40 rounded-lg px-3 py-2 text-center"
        >
          {{ error }}
        </p>
      </div>
    </section>

    <!-- Features -->
    <section
      class="flex flex-wrap items-center justify-center gap-6 text-xs md:text-sm text-warp-muted"
    >
      <div class="flex items-center gap-2">
        <span>🔒</span>
        <span>Шифрование и защита комнат</span>
      </div>
      <div class="flex items-center gap-2">
        <span>⚡</span>
        <span>Низкая задержка соединения</span>
      </div>
      <div class="flex items-center gap-2">
        <span>🎥</span>
        <span>HD качество видео</span>
      </div>
      <div class="flex items-center gap-2">
        <span>💬</span>
        <span>Чат и файлы в вызове</span>
      </div>
    </section>

    <!-- Admin Link (small and subtle) -->
    <div class="flex justify-center pt-2">
      <router-link
        to="/admin/login"
        class="inline-flex items-center gap-2 text-xs text-warp-muted hover:text-warp-text transition-colors"
      >
        <span class="text-sm">🔑</span>
        <span>Вход для администратора</span>
      </router-link>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '../stores/rooms'

export default {
  name: 'CallActions',
  setup() {
    const router = useRouter()
    const roomsStore = useRoomsStore()
    const roomCode = ref('')
    const userName = ref('')
    const roomPassword = ref('')
    const joinUserName = ref('')
    const joinRoomPassword = ref('')
    const error = ref('')
    const isCreating = ref(false)
    const isJoining = ref(false)

    // Создать новый звонок
    const createNewCall = async () => {
      try {
        isCreating.value = true
        error.value = ''
        
        // Создаем комнату через API с паролем если указан
        const result = await roomsStore.createRoom(userName.value || undefined, roomPassword.value || undefined)
        
        if (result.success && result.room) {
          // Сохраняем имя пользователя в localStorage для использования в звонке
          if (userName.value) {
            localStorage.setItem('userName', userName.value)
          }
          // Переходим на страницу присоединения с кодом комнаты
          router.push(`/join/${result.room.short_code}`)
        } else {
          error.value = result.error || 'Не удалось создать комнату. Пожалуйста, попробуйте снова.'
        }
      } catch (err) {
        error.value = 'Не удалось создать комнату. Пожалуйста, попробуйте снова.'
        console.error('Error creating room:', err)
      } finally {
        isCreating.value = false
      }
    }

    // Присоединиться к существующему звонку
    const joinCall = async () => {
      if (!roomCode.value) {
        error.value = 'Пожалуйста, введите код комнаты'
        return
      }
      
      try {
        isJoining.value = true
        error.value = ''
        
        // Сохраняем имя пользователя в localStorage
        if (joinUserName.value) {
          localStorage.setItem('userName', joinUserName.value)
        }
        
        // Проверяем существование комнаты и присоединяемся через API с паролем если указан
        const result = await roomsStore.joinRoom(
          roomCode.value.trim().toUpperCase(),
          joinRoomPassword.value || undefined
        )
        
        if (result.success && result.room) {
          // Переходим в комнату
          router.push(`/call/${result.room.room_id}`)
        } else {
          error.value = result.error || 'Комната не найдена или неверный пароль. Проверьте код комнаты и пароль.'
        }
      } catch (err) {
        error.value = 'Не удалось присоединиться к комнате. Пожалуйста, попробуйте снова.'
        console.error('Error joining room:', err)
      } finally {
        isJoining.value = false
      }
    }

    // Загрузить сохраненное имя пользователя при монтировании
    const loadSavedUserName = () => {
      const savedName = localStorage.getItem('userName')
      if (savedName) {
        userName.value = savedName
        joinUserName.value = savedName
      }
    }

    // Загрузить сохраненное имя при монтировании
    onMounted(() => {
      loadSavedUserName()
    })

    return {
      roomCode,
      userName,
      roomPassword,
      joinUserName,
      joinRoomPassword,
      error,
      isCreating,
      isJoining,
      createNewCall,
      joinCall
    }
  }
}
</script>

<style scoped>
/* Layout и анимации задаются через глобальные Warp‑утилиты и Tailwind */
</style>
