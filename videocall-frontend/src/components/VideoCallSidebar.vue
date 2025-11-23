<!-- src/components/VideoCallSidebar.vue - Sidebar component extracted from VideoCall.vue -->
<template>
  <div
    v-if="showChat"
    class="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-white dark:bg-gray-800 shadow-2xl z-20 transform transition-transform duration-300"
    :class="showChat ? 'translate-x-0' : 'translate-x-full'"
  >
    <RoomChat
      v-if="roomCode"
      :room-code="roomCode"
      :participant-id="participantId"
      :websocket="websocket"
      @close="$emit('close')"
      @new-message="$emit('new-message', $event)"
    />
  </div>
</template>

<script setup>
import RoomChat from './RoomChat.vue'

defineProps({
  showChat: {
    type: Boolean,
    default: false
  },
  roomCode: {
    type: String,
    default: ''
  },
  participantId: {
    type: String,
    default: ''
  },
  websocket: {
    type: WebSocket,
    default: null
  }
})

defineEmits(['close', 'new-message'])
</script>

