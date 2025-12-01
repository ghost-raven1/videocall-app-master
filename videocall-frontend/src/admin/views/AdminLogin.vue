<template>
  <div
    class="min-h-screen warp-page flex items-center justify-center p-4"
  >
    <div class="card w-full max-w-md p-8 animate-fade-in">
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            ></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-warp-text mb-2">Админ-панель</h1>
        <p class="text-warp-muted">Введите учетные данные для входа</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label
            for="email"
            class="block text-sm font-medium text-warp-muted mb-2"
          >
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="Введите email"
            class="input-field"
            :disabled="isLoading"
            required
          />
        </div>

        <div>
          <label
            for="password"
            class="block text-sm font-medium text-warp-muted mb-2"
          >
            Пароль
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Введите пароль"
            class="input-field"
            :disabled="isLoading"
            required
          />
        </div>

        <div v-if="errorMessage" class="text-red-500 text-sm">
          {{ errorMessage }}
        </div>

        <div>
          <button
            type="submit"
            :disabled="!email.trim() || !password.trim() || isLoading"
            class="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isLoading" class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Вход...
            </span>
            <span v-else>Войти</span>
          </button>
        </div>
      </form>

      <div class="mt-6 text-center">
        <p class="text-xs text-warp-muted">
          Панель администратора видеозвонков
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalStore } from '../../stores/global'

const router = useRouter()
const globalStore = useGlobalStore()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (!email.value.trim() || !password.value.trim()) return

  try {
    isLoading.value = true
    errorMessage.value = ''

    const { apiService } = await import('@/services/api')

    const response = await apiService.adminLogin({
      email: email.value.trim(),
      password: password.value,
    })

    const user = response.data && response.data.user
    if (!user) {
      throw new Error('Некорректный ответ сервера')
    }

    // Сохраняем пользователя в глобальном сторе
    globalStore.user = user
    if (typeof globalStore.setAuthenticated === 'function') {
      globalStore.setAuthenticated(true, user)
    }

    // Маркер для роутера, что админ авторизован
    localStorage.setItem('admin_authenticated', 'true')

    // Перенаправление в админку
    router.push('/admin')
  } catch (error) {
    console.error('Admin login failed:', error)
    const apiError = (error && error.response && error.response.data && error.response.data.error) || error.message || 'Ошибка входа. Попробуйте позже.'
    errorMessage.value = apiError
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.input-field {
  @apply w-full px-3 py-2 bg-warp-surfaceAlt border border-warp-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-warp-accent focus:border-warp-accent text-warp-text;
}

.btn-primary {
  @apply px-4 py-2 bg-warp-accent2 text-white rounded-md hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-warp-accent focus:ring-offset-2 transition-colors;
}

.card {
  @apply bg-warp-surface rounded-lg shadow-warp-md border border-warp-border/60;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>