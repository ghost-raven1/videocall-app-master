<template>
  <div class="min-h-screen flex items-center justify-center px-4 text-warp-text">
    <div class="card w-full max-w-md p-8 animate-fade-in">
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 bg-warp-accent rounded-full flex items-center justify-center mx-auto mb-4 border border-warp-border"
        >
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            ></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-warp-text mb-2">{{ $t('joinRoom.joinTitle') }}</h1>
        <p class="text-warp-muted">
          {{ $t('joinRoom.roomCode') }}:
          <span class="code-badge ml-1">{{ roomCode }}</span>
        </p>
      </div>

      <div v-if="isJoining" class="text-center py-8">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-warp-accent mx-auto mb-4"
        ></div>
        <p class="text-warp-muted">{{ $t('joinRoom.joiningRoom') }}</p>
      </div>

      <div v-else-if="error" class="text-center py-8">
        <div
          class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/40"
        >
          <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-warp-text mb-2">{{ $t('joinRoom.roomNotFound') }}</h3>
        <p class="text-warp-muted mb-4">{{ error }}</p>
        <button @click="$router.push('/')" class="btn-primary px-6 py-2">{{ $t('app.backToDashboard') }}</button>
      </div>

      <div v-else class="space-y-6">
        <div class="text-center">
          <button @click="joinRoom" class="btn-primary w-full py-4 text-lg">
            {{ $t('joinRoom.joinCall') }}
          </button>
        </div>

        <div class="text-center">
          <button
            @click="$router.push('/')"
            class="text-warp-muted hover:text-warp-text transition-colors"
          >
            {{ $t('app.backToDashboard') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '../stores/rooms'
import { utils } from '@/services/utils'

const route = useRoute()
const router = useRouter()
const roomsStore = useRoomsStore()

const roomCode = ref<string>('')
const isJoining = ref<boolean>(false)
const error = ref<string>('')

onMounted(() => {
  roomCode.value = utils.normalizeRouteParam(route.params.shortCode)
  if (!roomCode.value) {
    router.push('/')
  }
})

const joinRoom = async (): Promise<void> => {
  try {
    isJoining.value = true
    const result = await roomsStore.joinRoom(roomCode.value)

    if (result.success) {
      router.push(`/call/${result.room.room_id}`)
    } else {
      error.value = result.error
    }
  } catch (err) {
    error.value = 'Failed to join room'
  } finally {
    isJoining.value = false
  }
}
</script>
