<template>
  <div class="call-actions-container">
    <div class="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6">
      <h1 class="text-2xl font-bold text-center mb-6">Видеозвонки</h1>
      
      <div class="grid grid-cols-1 gap-6">
        <!-- Создать новый звонок -->
        <div class="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <h2 class="text-xl font-semibold mb-3">Создать новый звонок</h2>
          <p class="text-gray-600 mb-4">Создайте новую комнату для видеозвонка и пригласите участников</p>
          <button 
            @click="createNewCall" 
            :disabled="isCreating"
            class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
          >
            {{ isCreating ? 'Создание...' : 'Создать звонок' }}
          </button>
        </div>
        
        <!-- Присоединиться к звонку -->
        <div class="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <h2 class="text-xl font-semibold mb-3">Присоединиться к звонку</h2>
          <p class="text-gray-600 mb-2">Введите код комнаты для присоединения к существующему звонку</p>
          <div class="flex flex-col md:flex-row gap-2">
            <input 
              v-model="roomCode" 
              type="text" 
              placeholder="Введите код комнаты" 
              class="flex-grow border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              @click="joinCall" 
              class="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
              :disabled="!roomCode || isJoining"
            >
              {{ isJoining ? 'Присоединение...' : 'Присоединиться' }}
            </button>
          </div>
          <p v-if="error" class="text-red-500 mt-2 text-sm">{{ error }}</p>
        </div>
      </div>
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
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 1rem;
}
</style>
