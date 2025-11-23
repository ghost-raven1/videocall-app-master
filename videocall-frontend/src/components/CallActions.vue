<template>
  <div class="call-actions-container">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="title-icon">📹</span>
          Видеозвонки
        </h1>
        <p class="hero-subtitle">Общайтесь в реальном времени с качественным видео и звуком</p>
      </div>
    </div>

    <!-- Main Actions -->
    <div class="actions-wrapper">
      <div class="actions-container">
        <!-- Создать новый звонок -->
        <div class="action-card create-card">
          <div class="card-icon">✨</div>
          <h2 class="card-title">Создать новый звонок</h2>
          <p class="card-description">Создайте новую комнату для видеозвонка и пригласите участников по уникальному коду</p>
          <button 
            @click="createNewCall" 
            :disabled="isCreating"
            class="action-button primary-button"
          >
            <span v-if="!isCreating">🚀 Создать звонок</span>
            <span v-else class="loading">
              <span class="spinner"></span>
              Создание...
            </span>
          </button>
        </div>
        
        <!-- Присоединиться к звонку -->
        <div class="action-card join-card">
          <div class="card-icon">🔗</div>
          <h2 class="card-title">Присоединиться к звонку</h2>
          <p class="card-description">Введите код комнаты для присоединения к существующему звонку</p>
          <div class="join-input-group">
            <input 
              v-model="roomCode" 
              type="text" 
              placeholder="Введите код комнаты (например: ABC123)" 
              class="room-code-input"
              :disabled="isJoining"
              @keyup.enter="joinCall"
              maxlength="10"
            />
            <button 
              @click="joinCall" 
              class="action-button secondary-button"
              :disabled="!roomCode || isJoining"
            >
              <span v-if="!isJoining">→ Присоединиться</span>
              <span v-else class="loading">
                <span class="spinner"></span>
                Присоединение...
              </span>
            </button>
          </div>
          <p v-if="error" class="error-message">{{ error }}</p>
        </div>
      </div>

      <!-- Features Section -->
      <div class="features-section">
        <div class="feature-item">
          <div class="feature-icon">🔒</div>
          <p class="feature-text">Безопасно</p>
        </div>
        <div class="feature-item">
          <div class="feature-icon">⚡</div>
          <p class="feature-text">Быстро</p>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🎥</div>
          <p class="feature-text">HD качество</p>
        </div>
        <div class="feature-item">
          <div class="feature-icon">💬</div>
          <p class="feature-text">Чат в реальном времени</p>
        </div>
      </div>
    </div>

    <!-- Admin Link (small and subtle) -->
    <div class="admin-link-container">
      <router-link to="/admin/login" class="admin-link">
        <span class="admin-icon">🔑</span>
        Вход для администратора
      </router-link>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '../stores/rooms'

export default {
  name: 'CallActions',
  setup() {
    const router = useRouter()
    const roomsStore = useRoomsStore()
    const roomCode = ref('')
    const error = ref('')
    const isCreating = ref(false)
    const isJoining = ref(false)

    // Создать новый звонок
    const createNewCall = async () => {
      try {
        isCreating.value = true
        error.value = ''
        
        // Создаем комнату через API
        const result = await roomsStore.createRoom()
        
        if (result.success && result.room) {
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
        
        // Проверяем существование комнаты и присоединяемся через API
        const result = await roomsStore.joinRoom(roomCode.value.trim().toUpperCase())
        
        if (result.success && result.room) {
          // Переходим в комнату
          router.push(`/call/${result.room.room_id}`)
        } else {
          error.value = result.error || 'Комната не найдена. Проверьте код комнаты.'
        }
      } catch (err) {
        error.value = 'Не удалось присоединиться к комнате. Пожалуйста, попробуйте снова.'
        console.error('Error joining room:', err)
      } finally {
        isJoining.value = false
      }
    }

    return {
      roomCode,
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
.call-actions-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow-x: hidden;
}

/* Hero Section */
.hero-section {
  text-align: center;
  margin-bottom: 3rem;
  animation: fadeInDown 0.6s ease-out;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero-title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 800;
  color: white;
  margin-bottom: 1rem;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.title-icon {
  font-size: 1.2em;
  animation: pulse 2s ease-in-out infinite;
}

.hero-subtitle {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: rgba(255, 255, 255, 0.95);
  font-weight: 400;
  max-width: 600px;
  margin: 0 auto;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.1);
}

/* Actions Container */
.actions-wrapper {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.actions-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

/* Action Cards */
.action-card {
  background: white;
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.action-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.create-card::before {
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.join-card::before {
  background: linear-gradient(90deg, #f093fb, #f5576c);
}

.action-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2);
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: inline-block;
  animation: bounce 2s ease-in-out infinite;
}

.card-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.75rem;
}

.card-description {
  color: #64748b;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  flex-grow: 1;
}

/* Buttons */
.action-button {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
}

.primary-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.secondary-button {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
}

.secondary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 87, 108, 0.5);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Join Input Group */
.join-input-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.room-code-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.3s ease;
  font-weight: 600;
  letter-spacing: 1px;
  text-align: center;
  text-transform: uppercase;
}

.room-code-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.room-code-input:disabled {
  background-color: #f1f5f9;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.9rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fee2e2;
  border-radius: 8px;
  text-align: center;
}

/* Features Section */
.features-section {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
  animation: fadeInUp 0.8s ease-out 0.4s both;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: white;
  opacity: 0.9;
  transition: opacity 0.3s ease;
}

.feature-item:hover {
  opacity: 1;
}

.feature-icon {
  font-size: 2rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.feature-text {
  font-size: 0.9rem;
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Admin Link */
.admin-link-container {
  margin-top: 2rem;
  animation: fadeIn 1s ease-out 0.6s both;
}

.admin-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.1);
}

.admin-link:hover {
  color: white;
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.admin-icon {
  font-size: 1rem;
}

/* Animations */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .actions-container {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .action-card {
    padding: 1.5rem;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .features-section {
    gap: 1rem;
  }

  .feature-icon {
    font-size: 1.5rem;
  }

  .feature-text {
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .call-actions-container {
    padding: 1rem 0.5rem;
  }

  .action-card {
    padding: 1.25rem;
  }

  .card-title {
    font-size: 1.5rem;
  }

  .card-description {
    font-size: 0.9rem;
  }

  .join-input-group {
    gap: 0.75rem;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .action-card {
    background: #1e293b;
    color: white;
  }

  .card-title {
    color: white;
  }

  .card-description {
    color: #cbd5e1;
  }

  .room-code-input {
    background: #0f172a;
    border-color: #334155;
    color: white;
  }

  .room-code-input:focus {
    border-color: #667eea;
  }
}
</style>
