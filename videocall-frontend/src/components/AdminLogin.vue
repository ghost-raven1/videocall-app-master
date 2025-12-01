<template>
  <div class="admin-login-container">
    <div class="login-form">
      <h1>Вход в админ-панель</h1>
      <div class="form-group">
        <label for="email">Email</label>
        <input 
          type="email" 
          id="email" 
          v-model="email" 
          placeholder="Введите email"
          required
        />
      </div>
      <div class="form-group">
        <label for="password">Пароль</label>
        <input 
          type="password" 
          id="password" 
          v-model="password" 
          placeholder="Введите пароль"
          required
        />
      </div>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <button @click="handleLogin" class="login-button">Войти</button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalStore } from '../stores/global'

export default {
  name: 'AdminLogin',
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const router = useRouter()
    const globalStore = useGlobalStore()

    const handleLogin = async () => {
      error.value = ''
      
      if (!email.value || !password.value) {
        error.value = 'Пожалуйста, заполните все поля'
        return
      }

      try {
        const { apiService } = await import('@/services/api')
        const response = await apiService.adminLogin({
          email: email.value.trim(),
          password: password.value,
        })

        const user = response.data && response.data.user
        if (!user) {
          throw new Error('Некорректный ответ сервера')
        }

        // Сохраняем пользователя в глобальном сторе (динамическое поле)
        globalStore.user = user
        if (typeof globalStore.setAuthenticated === 'function') {
          globalStore.setAuthenticated(true, user)
        }

        localStorage.setItem('admin_authenticated', 'true')
        router.push('/admin')
      } catch (e) {
        const apiError = (e && e.response && e.response.data && e.response.data.error) || e.message || 'Ошибка входа. Попробуйте позже.'
        error.value = apiError
      }
    }

    return {
      email,
      password,
      error,
      handleLogin
    }
  }
}
</script>

<style scoped>
.admin-login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.login-form {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.login-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #4a6cf7;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.login-button:hover {
  background-color: #3a5ce5;
}

.error-message {
  color: #e53935;
  margin-bottom: 1rem;
  text-align: center;
}
</style>