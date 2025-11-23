<!-- src/components/VideoCallHeader.vue - Header component extracted from VideoCall.vue -->
<template>
  <header
    class="bg-gray-900 text-white p-4 flex items-center justify-between z-10 safe-area-inset"
  >
    <div class="flex items-center space-x-4">
      <h1 class="text-lg font-medium">Room {{ roomCode }}</h1>
      <div class="flex items-center space-x-2 text-sm text-gray-300">
        <div :class="['w-2 h-2 rounded-full animate-pulse', connectionStatusColor]"></div>
        <span>{{ connectionStatusText }}</span>
      </div>
    </div>

    <div class="flex items-center space-x-4">
      <!-- Call duration -->
      <div v-if="callDuration > 0" class="text-sm text-gray-300 font-mono">
        {{ formattedDuration }}
      </div>

      <!-- Participants count (clickable to show participants list) -->
      <button
        @click="$emit('show-participants')"
        class="flex items-center space-x-1 text-sm text-gray-300 hover:text-white transition-colors cursor-pointer"
        :title="`${participantCount} participant${participantCount !== 1 ? 's' : ''}`"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          ></path>
        </svg>
        <span>{{ participantCount }}</span>
      </button>

      <!-- Chat button -->
      <button
        @click="$emit('toggle-chat')"
        class="p-2 hover:bg-gray-800 rounded-full transition-colors relative"
        title="Toggle chat"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span v-if="unreadMessages > 0" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {{ unreadMessages > 9 ? '9+' : unreadMessages }}
        </span>
      </button>

      <!-- Screen share button -->
      <button
        @click="$emit('toggle-screen-share')"
        :class="[
          'p-2 rounded-full transition-colors',
          isScreenSharing ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-gray-800'
        ]"
        :title="isScreenSharing ? 'Stop sharing' : 'Share screen'"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      <!-- Audio Settings button -->
      <AudioSettings @settings-changed="$emit('audio-settings-changed', $event)" />

      <!-- Menu button -->
      <button
        @click="$emit('toggle-menu')"
        class="p-2 hover:bg-gray-800 rounded-full transition-colors relative"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          ></path>
        </svg>

        <!-- Dropdown menu -->
        <div
          v-if="showMenu"
          v-click-outside="$emit('close-menu')"
          class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50"
        >
          <button
            @click="$emit('share-room')"
            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
              ></path>
            </svg>
            <span>Поделиться комнатой</span>
          </button>
          <button
            @click="$emit('toggle-recording')"
            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
          >
            <svg class="w-4 h-4" :style="isRecording ? 'color: red;' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              ></path>
            </svg>
            <span>{{ isRecording ? 'Остановить запись' : 'Начать запись' }}</span>
          </button>
          <button
            @click="$emit('toggle-stats')"
            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H2a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              ></path>
            </svg>
            <span>Connection stats</span>
          </button>
          <div class="border-t border-gray-200 dark:border-gray-600 my-2"></div>
          <button
            @click="$emit('end-call')"
            class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18"
              ></path>
            </svg>
            <span>End call</span>
          </button>
        </div>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import AudioSettings from './AudioSettings.vue'
import { utils } from '@/services/utils'

const props = defineProps({
  roomCode: {
    type: String,
    default: ''
  },
  connectionStatusText: {
    type: String,
    default: 'Connecting...'
  },
  connectionStatusColor: {
    type: String,
    default: 'bg-yellow-400'
  },
  callDuration: {
    type: Number,
    default: 0
  },
  participantCount: {
    type: Number,
    default: 0
  },
  unreadMessages: {
    type: Number,
    default: 0
  },
  isScreenSharing: {
    type: Boolean,
    default: false
  },
  isRecording: {
    type: Boolean,
    default: false
  },
  showMenu: {
    type: Boolean,
    default: false
  }
})

defineEmits([
  'toggle-chat',
  'toggle-screen-share',
  'audio-settings-changed',
  'toggle-menu',
  'close-menu',
  'share-room',
  'toggle-recording',
  'toggle-stats',
  'end-call',
  'show-participants'
])

const formattedDuration = computed(() => {
  return utils.formatDuration(props.callDuration)
})
</script>

