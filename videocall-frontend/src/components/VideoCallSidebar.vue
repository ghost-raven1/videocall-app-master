<!-- src/components/VideoCallSidebar.vue - Sidebar component extracted from VideoCall.vue -->
<template>
  <div
    class="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-warp-surface shadow-warp-md z-20 transform transition-transform duration-300 border-l border-warp-border"
    :class="showChat ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-full opacity-0 pointer-events-none'"
    :aria-hidden="!showChat"
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
    type: Object,
    default: null
  }
})

defineEmits(['close', 'new-message'])
</script>
