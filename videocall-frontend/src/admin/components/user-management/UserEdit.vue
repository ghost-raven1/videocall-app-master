<template>
  <div class="user-edit">
    <div class="edit-header">
      <h2>{{ isEditing ? 'Редактирование пользователя' : 'Создание пользователя' }}</h2>
      <button class="btn btn-secondary" @click="$emit('cancel')">
        Отмена
      </button>
    </div>

    <form @submit.prevent="handleSubmit" class="edit-form">
      <!-- Basic Information -->
      <div class="form-section">
        <h3>Основная информация</h3>

        <div class="form-grid">
          <div class="form-group">
            <label for="username">Имя пользователя *</label>
            <input
              id="username"
              type="text"
              v-model="form.username"
              :class="['form-input', { 'error': errors.username }]"
              placeholder="Введите имя пользователя"
              required
            />
            <span v-if="errors.username" class="field-error">{{ errors.username }}</span>
          </div>

          <div class="form-group">
            <label for="email">Email *</label>
            <input
              id="email"
              type="email"
              v-model="form.email"
              :class="['form-input', { 'error': errors.email }]"
              placeholder="Введите email"
              required
            />
            <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
          </div>

          <div class="form-group">
            <label for="first_name">Имя</label>
            <input
              id="first_name"
              type="text"
              v-model="form.first_name"
              class="form-input"
              placeholder="Введите имя"
            />
          </div>

          <div class="form-group">
            <label for="last_name">Фамилия</label>
            <input
              id="last_name"
              type="text"
              v-model="form.last_name"
              class="form-input"
              placeholder="Введите фамилию"
            />
          </div>
        </div>
      </div>

      <!-- Role and Status -->
      <div class="form-section">
        <h3>Роль и статус</h3>

        <div class="form-grid">
          <div class="form-group">
            <label for="role">Роль *</label>
            <select
              id="role"
              v-model="form.role"
              :class="['form-input', { 'error': errors.role }]"
              required
            >
              <option value="">Выберите роль</option>
              <option value="user">Пользователь</option>
              <option value="moderator">Модератор</option>
              <option value="admin">Администратор</option>
            </select>
            <span v-if="errors.role" class="field-error">{{ errors.role }}</span>
          </div>

          <div class="form-group">
            <label for="is_active">Статус</label>
            <select id="is_active" v-model="form.is_active" class="form-input">
              <option :value="true">Активен</option>
              <option :value="false">Заблокирован</option>
            </select>
          </div>

          <div class="form-group">
            <label for="is_staff">Права администратора</label>
            <select id="is_staff" v-model="form.is_staff" class="form-input">
              <option :value="false">Нет</option>
              <option :value="true">Да</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Password (only for new users) -->
      <div v-if="!isEditing" class="form-section">
        <h3>Пароль</h3>

        <div class="form-grid">
          <div class="form-group">
            <label for="password">Пароль *</label>
            <input
              id="password"
              type="password"
              v-model="form.password"
              :class="['form-input', { 'error': errors.password }]"
              placeholder="Введите пароль"
              required
            />
            <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
          </div>

          <div class="form-group">
            <label for="password_confirm">Подтверждение пароля *</label>
            <input
              id="password_confirm"
              type="password"
              v-model="form.password_confirm"
              :class="['form-input', { 'error': errors.password_confirm }]"
              placeholder="Повторите пароль"
              required
            />
            <span v-if="errors.password_confirm" class="field-error">{{ errors.password_confirm }}</span>
          </div>
        </div>

        <!-- Password Strength Indicator -->
        <div v-if="form.password" class="password-strength">
          <div class="strength-bar">
            <div
              class="strength-fill"
              :class="passwordStrengthClass"
              :style="{ width: passwordStrength + '%' }"
            ></div>
          </div>
          <span class="strength-text">{{ passwordStrengthText }}</span>
        </div>
      </div>

      <!-- Profile Information -->
      <div class="form-section">
        <h3>Дополнительная информация</h3>

        <div class="form-grid">
          <div class="form-group">
            <label for="phone">Телефон</label>
            <input
              id="phone"
              type="tel"
              v-model="form.phone"
              class="form-input"
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div class="form-group">
            <label for="avatar">Аватар (URL)</label>
            <input
              id="avatar"
              type="url"
              v-model="form.avatar"
              class="form-input"
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          <div class="form-group">
            <label for="timezone">Часовой пояс</label>
            <select id="timezone" v-model="form.timezone" class="form-input">
              <option value="">Выберите часовой пояс</option>
              <option value="Europe/Moscow">Москва (UTC+3)</option>
              <option value="Asia/Tomsk">Томск (UTC+7)</option>
              <option value="Europe/London">Лондон (UTC+0)</option>
              <option value="America/New_York">Нью-Йорк (UTC-5)</option>
              <option value="Asia/Tokyo">Токио (UTC+9)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="language">Язык</label>
            <select id="language" v-model="form.language" class="form-input">
              <option value="ru">Русский</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="bio">О себе</label>
          <textarea
            id="bio"
            v-model="form.bio"
            class="form-textarea"
            rows="3"
            placeholder="Краткая информация о пользователе..."
          ></textarea>
        </div>
      </div>

      <!-- Settings -->
      <div class="form-section">
        <h3>Настройки</h3>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="form.settings.email_notifications"
            />
            Email уведомления
          </label>

          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="form.settings.push_notifications"
            />
            Push уведомления
          </label>

          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="form.settings.allow_direct_messages"
            />
            Разрешить личные сообщения
          </label>

          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="form.settings.show_online_status"
            />
            Показывать статус "онлайн"
          </label>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" @click="$emit('cancel')" :disabled="loading">
          Отмена
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          <LoadingSpinner v-if="loading" size="small" :text="isEditing ? 'Сохранение...' : 'Создание...'" />
          <span v-else>{{ isEditing ? 'Сохранить' : 'Создать' }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, watch } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'cancel'])

const isEditing = computed(() => !!props.user)

// Form data
const form = ref({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  role: 'user',
  is_active: true,
  is_staff: false,
  password: '',
  password_confirm: '',
  phone: '',
  avatar: '',
  timezone: 'Asia/Tomsk',
  language: 'ru',
  bio: '',
  settings: {
    email_notifications: true,
    push_notifications: true,
    allow_direct_messages: true,
    show_online_status: true
  }
})

// Validation errors
const errors = ref({})

// Password strength
const passwordStrength = computed(() => {
  if (!form.value.password) return 0

  let strength = 0
  const password = form.value.password

  if (password.length >= 8) strength += 25
  if (/[a-z]/.test(password)) strength += 25
  if (/[A-Z]/.test(password)) strength += 25
  if (/[0-9]/.test(password)) strength += 25

  return strength
})

const passwordStrengthClass = computed(() => {
  if (passwordStrength.value < 25) return 'weak'
  if (passwordStrength.value < 50) return 'fair'
  if (passwordStrength.value < 75) return 'good'
  return 'strong'
})

const passwordStrengthText = computed(() => {
  if (passwordStrength.value < 25) return 'Слабый'
  if (passwordStrength.value < 50) return 'Нормальный'
  if (passwordStrength.value < 75) return 'Хороший'
  return 'Отличный'
})

// Methods
const validateForm = () => {
  errors.value = {}

  if (!form.value.username.trim()) {
    errors.value.username = 'Имя пользователя обязательно'
  }

  if (!form.value.email.trim()) {
    errors.value.email = 'Email обязателен'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.value.email = 'Неверный формат email'
  }

  if (!isEditing.value) {
    if (!form.value.password) {
      errors.value.password = 'Пароль обязателен'
    } else if (form.value.password.length < 8) {
      errors.value.password = 'Пароль должен содержать минимум 8 символов'
    }

    if (form.value.password !== form.value.password_confirm) {
      errors.value.password_confirm = 'Пароли не совпадают'
    }
  }

  if (!form.value.role) {
    errors.value.role = 'Роль обязательна'
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = () => {
  if (!validateForm()) return

  const userData = {
    ...form.value,
    settings: JSON.stringify(form.value.settings)
  }

  emit('save', userData)
}

// Initialize form with user data when editing
watch(() => props.user, (user) => {
  if (user) {
    form.value = {
      username: user.username || '',
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role || 'user',
      is_active: user.is_active !== false,
      is_staff: user.is_staff || false,
      phone: user.phone || '',
      avatar: user.avatar || '',
      timezone: user.timezone || 'Asia/Tomsk',
      language: user.language || 'ru',
      bio: user.bio || '',
      settings: user.settings ? JSON.parse(user.settings) : {
        email_notifications: true,
        push_notifications: true,
        allow_direct_messages: true,
        show_online_status: true
      }
    }
  }
}, { immediate: true })
</script>

<style scoped>
.user-edit {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-width: 800px;
  margin: 0 auto;
}

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.edit-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.edit-form {
  padding: 24px;
}

.form-section {
  margin-bottom: 32px;
}

.form-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.form-input,
.form-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-input.error,
.form-textarea.error {
  border-color: #dc2626;
}

.field-error {
  font-size: 12px;
  color: #dc2626;
  margin-top: 4px;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.checkbox-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
}

.password-strength {
  margin-top: 8px;
}

.strength-bar {
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
}

.strength-fill.weak {
  background: #dc2626;
}

.strength-fill.fair {
  background: #f59e0b;
}

.strength-fill.good {
  background: #3b82f6;
}

.strength-fill.strong {
  background: #10b981;
}

.strength-text {
  font-size: 12px;
  font-weight: 500;
}

.strength-text.weak {
  color: #dc2626;
}

.strength-text.fair {
  color: #f59e0b;
}

.strength-text.good {
  color: #3b82f6;
}

.strength-text.strong {
  color: #10b981;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}
</style>