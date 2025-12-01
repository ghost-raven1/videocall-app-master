// src/components/Dashboard.vue - Main dashboard component
<template>
  <div class="min-h-screen text-warp-text">
    <!-- Header -->
    <header
      class="bg-warp-surface/95 backdrop-blur-md shadow-warp-sm border-b border-warp-border/80"
    >
      <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center bg-warp-accent shadow-warp-md border border-warp-border/80">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
          <h1 class="text-xl font-semibold text-warp-text">
            {{ $t('dashboard.videoCall') }}
          </h1>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Admin panel link for admin users -->
          <button
            v-if="globalStore.user?.role === 'admin' || globalStore.user?.is_staff"
            @click="goToAdminPanel"
            class="text-warp-muted hover:text-warp-text transition-colors"
            title="Админ-панель"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>

          <button
            @click="handleLogout"
            class="text-warp-muted hover:text-warp-text transition-colors"
            title="Выйти"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <!-- Admin Panel Section -->
      <div v-if="isAdminView" class="mb-8">
        <h2 class="text-xl font-bold text-warp-text mb-4">
          Панель администратора
        </h2>
        <div class="card p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <ActionCard
              title="Управление пользователями"
              description="Создание, редактирование и удаление пользователей"
              icon="users"
              @click="handleAdminAction('users')"
            />
            <ActionCard
              title="Управление комнатами"
              description="Просмотр и управление всеми комнатами"
              icon="video"
              @click="handleAdminAction('rooms')"
            />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActionCard
              title="Настройки системы"
              description="Изменение глобальных настроек приложения"
              icon="settings"
              @click="handleAdminAction('settings')"
            />
            <ActionCard
              title="Статистика и логи"
              description="Просмотр статистики использования и логов"
              icon="chart"
              @click="handleAdminAction('stats')"
            />
          </div>
        </div>
      </div>
      
      <!-- Video Preview -->
      <div v-if="!isAdminView" class="mb-8">
        <VideoPreview />
      </div>

      <!-- Action Buttons -->
      <div v-if="!isAdminView" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <ActionCard
          :title="$t('dashboard.cards.createLink.title')"
          :description="$t('dashboard.cards.createLink.desc')"
          icon="plus"
          :loading="roomsStore.isCreatingRoom"
          @click="handleCreateRoom"
        />

        <ActionCard
          :title="$t('dashboard.cards.joinCall.title')"
          :description="$t('dashboard.cards.joinCall.desc')"
          icon="login"
          @click="showJoinModal = true"
        />
      </div>

      <!-- Room History -->
      <div v-if="roomsStore.roomHistory.length > 0" class="mb-8">
        <h2 class="text-lg font-semibold text-warp-text mb-4">
          {{ $t('dashboard.recentRooms') }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="room in roomsStore.roomHistory.slice(0, 5)"
            :key="room.room_id"
            class="card p-4 flex items-center justify-between"
          >
            <div class="flex-1">
              <p class="font-medium text-warp-text">
                {{ room.short_code }}
              </p>
              <p class="text-sm text-warp-muted">
                {{ utils.formatRelativeTime(new Date(room.joined_at)) }}
              </p>
            </div>
            <button
              @click="handleJoinRoom(room.short_code)"
              :disabled="roomsStore.isJoiningRoom"
              class="btn-secondary px-4 py-2 text-sm"
            >
              {{ $t('dashboard.rejoin') }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Join Room Modal -->
    <Teleport to="body">
      <div
        v-if="showJoinModal"
        class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-50 p-4"
        @click="showJoinModal = false"
      >
        <div class="card w-full max-w-md p-6 animate-slide-up" @click.stop>
          <h3 class="text-lg font-semibold text-warp-text mb-4">
            {{ $t('app.modals.joinVideoCall.title') }}
          </h3>

          <form @submit.prevent="handleJoinSubmit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-warp-muted mb-2">
                {{ $t('app.modals.joinVideoCall.title') }}
              </label>
              <input
                v-model="joinInput"
                type="text"
                :placeholder="$t('app.modals.joinVideoCall.enterRoomCodeOrPasteLink')"
                class="input-field"
                :disabled="roomsStore.isJoiningRoom"
              />
            </div>

            <div class="flex space-x-3">
              <button
                type="button"
                @click="showJoinModal = false"
                class="btn-secondary flex-1"
                :disabled="roomsStore.isJoiningRoom"
              >
                {{ $t('app.buttons.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="!joinInput.trim() || roomsStore.isJoiningRoom"
                class="btn-primary flex-1 disabled:opacity-50"
              >
                <span v-if="roomsStore.isJoiningRoom">{{ $t('app.buttons.joining') }}</span>
                <span v-else>{{ $t('app.buttons.join') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Room Created Modal -->
    <RoomCreatedModal
      v-if="showRoomCreatedModal && createdRoom"
      :room="createdRoom"
      @close="showRoomCreatedModal = false"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardView' })
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGlobalStore } from '../stores/global'
import { useRoomsStore } from '../stores/rooms'
import { utils } from '../services/utils'
import VideoPreview from './VideoPreview.vue'
import ActionCard from './ActionCard.vue'
import RoomCreatedModal from './RoomCreatedModal.vue'

const router = useRouter()
const route = useRoute()
const globalStore = useGlobalStore()
const roomsStore = useRoomsStore()

// Reactive state
const showJoinModal = ref(false)
const showRoomCreatedModal = ref(false)
const joinInput = ref('')
const createdRoom = ref(null)

// Computed properties
const isAdminView = computed(() => {
  return route.meta.isAdmin === true || route.path === '/admin'
})

// Methods
const handleLogout = async () => {
  await globalStore.logout()
  router.push('/')
}

const goToAdminPanel = () => {
  router.push('/admin')
}

const handleAdminAction = (action) => {
  switch(action) {
    case 'users':
      // Здесь будет логика управления пользователями
      console.log('Управление пользователями')
      break
    case 'rooms':
      // Здесь будет логика управления комнатами
      console.log('Управление комнатами')
      break
    case 'settings':
      // Здесь будет логика настроек системы
      console.log('Настройки системы')
      break
    case 'stats':
      // Здесь будет логика статистики и логов
      console.log('Статистика и логи')
      break
  }
}

const handleCreateRoom = async () => {
  const result = await roomsStore.createRoom()

  if (result.success) {
    createdRoom.value = result.room
    showRoomCreatedModal.value = true
  }
}

const handleJoinRoom = async (roomIdentifier) => {
  const result = await roomsStore.joinRoom(roomIdentifier)

  if (result.success) {
    router.push(`/call/${result.room.room_id}`)
  }
}

const handleJoinSubmit = async () => {
  if (!joinInput.value.trim()) return

  // Extract room code from URL if needed
  let roomIdentifier = joinInput.value.trim()

  // If it's a full URL, extract the room code
  if (roomIdentifier.includes('/join/')) {
    const match = roomIdentifier.match(/\/join\/([A-Z0-9]+)/)
    if (match) {
      roomIdentifier = match[1]
    }
  }

  showJoinModal.value = false
  await handleJoinRoom(roomIdentifier)
  joinInput.value = ''
}

onMounted(() => {
  roomsStore.loadHistory()
})
</script>
