<!-- src/components/VideoCall.vue - Complete main video call component -->
<template>
  <div class="min-h-screen bg-black flex flex-col main-container">
    <!-- Loading overlay -->
    <div v-if="isConnecting" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div class="text-center text-white">
        <div class="inline-block w-12 h-12 border-4 border-t-green-500 border-white border-opacity-25 rounded-full animate-spin mb-4"></div>
        <p class="text-lg font-medium">{{ connectionMessage }}</p>
        <p class="text-sm text-gray-300 mt-2">{{ connectionProgress }}</p>
      </div>
    </div>
    
    <!-- Header -->
    <header
      class="bg-gray-900 text-white p-4 flex items-center justify-between z-10 safe-area-inset"
    >
      <div class="flex items-center space-x-4">
        <h1 class="text-lg font-medium">Room {{ roomInfo?.short_code }}</h1>
        <div class="flex items-center space-x-2 text-sm text-gray-300">
          <div :class="['w-2 h-2 rounded-full animate-pulse', connectionStatusColor]"></div>
          <span>{{ connectionStatusText }}</span>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <!-- Call duration -->
        <div v-if="callDuration > 0" class="text-sm text-gray-300 font-mono">
          {{ utils.formatDuration(callDuration) }}
        </div>

        <!-- Participants count -->
        <div class="flex items-center space-x-1 text-sm text-gray-300">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
            ></path>
          </svg>
          <span>{{ participantCount }}</span>
        </div>

        <!-- Chat button -->
        <button
          @click="showChat = !showChat"
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
          @click="toggleScreenShare"
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
        <AudioSettings @settings-changed="onAudioSettingsChanged" />

        <!-- Menu button -->
        <button
          @click="showMenu = !showMenu"
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
            v-click-outside="() => (showMenu = false)"
            class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50"
          >
            <button
              @click="shareRoom"
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
              @click="toggleRecording"
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
              @click="showStats = !showStats"
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
              @click="handleEndCall"
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

    <!-- Video Container -->
    <div class="flex-1 relative overflow-hidden">
      <!-- Chat Panel (Overlay) -->
      <div
        v-if="showChat"
        class="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-white dark:bg-gray-800 shadow-2xl z-20 transform transition-transform duration-300"
        :class="showChat ? 'translate-x-0' : 'translate-x-full'"
      >
        <RoomChat
          v-if="roomInfo"
          :room-code="roomInfo.short_code"
          :participant-id="currentParticipantId"
          :websocket="websocket"
          @close="showChat = false"
          @new-message="onNewChatMessage"
        />
      </div>
      <!-- Multi-user call (3+ participants) -->
      <ParticipantGrid
        v-if="webrtcStore.isMultiUserCall"
        :room-code="roomInfo?.short_code"
        :waiting-message="waitingMessage"
        :show-participants-count="true"
        @participant-count-changed="onParticipantCountChanged"
      />

      <!-- Two-user call (existing layout for backward compatibility) -->
      <div v-else-if="webrtcStore.participantCount === 2" class="two-user-layout">
        <!-- Remote Video (main) -->
        <div v-if="webrtcStore.hasRemoteVideo" class="absolute inset-0">
          <video
            ref="remoteVideoRef"
            autoplay
            playsinline
            class="w-full h-full object-cover"
            @loadedmetadata="onRemoteVideoLoaded"
          ></video>

          <!-- Remote video overlay info -->
          <div
            v-if="showVideoInfo"
            class="absolute top-4 left-4 bg-black bg-opacity-50 px-3 py-2 rounded-lg text-white text-sm"
          >
            <p>{{ remoteVideoInfo }}</p>
          </div>
        </div>

        <!-- No remote video placeholder -->
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900"
        >
          <div class="text-center text-white max-w-md mx-auto p-8">
            <div
              class="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-gentle"
            >
              <svg
                class="w-16 h-16 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                ></path>
              </svg>
            </div>
            <h3 class="text-xl font-medium mb-2">{{ waitingMessage }}</h3>
            <p class="text-gray-400 mb-4">Share the room code to invite someone:</p>
            <div class="bg-gray-800 px-4 py-3 rounded-xl">
              <p class="font-mono font-bold text-2xl tracking-wider text-green-400">
                {{ roomInfo?.short_code }}
              </p>
            </div>
            <button
              @click="copyRoomCode"
              class="mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors inline-flex items-center space-x-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                ></path>
              </svg>
              <span>{{ roomCodeCopied ? 'Copied!' : 'Copy Code' }}</span>
            </button>
          </div>
        </div>

        <!-- Local Video (picture-in-picture) -->
        <div
          v-if="webrtcStore.hasLocalVideo"
          :class="[
            'absolute z-20 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 cursor-pointer border-2',
            localVideoSize === 'small'
              ? 'w-32 h-24 bottom-4 right-4'
              : localVideoSize === 'large'
                ? 'w-64 h-48 bottom-4 right-4'
                : 'w-48 h-36 bottom-4 right-4',
            webrtcStore.isVideoEnabled ? 'border-green-400' : 'border-gray-600',
          ]"
          @click="toggleLocalVideoSize"
        >
          <video
            ref="localVideoRef"
            autoplay
            muted
            playsinline
            class="w-full h-full object-cover"
            :class="{ mirror: shouldMirrorLocal }"
          ></video>

          <!-- Local video controls overlay -->
          <div
            class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity flex items-center justify-center opacity-0 hover:opacity-100"
          >
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 8V4m0 0h4M4 4l5 5m11-5v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v2M4 9h1m11 0h5m-9 0a1 1 0 011-1v-1a1 1 0 011-1m-1 1v1a1 1 0 001 1M9 7h8a3 3 0 013 3v2"
              ></path>
            </svg>
          </div>

          <!-- Muted indicator -->
          <div
            v-if="!webrtcStore.isAudioEnabled"
            class="absolute bottom-2 left-2 bg-red-500 rounded-full p-1"
          >
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v2M4 9h1m11 0h5m-9 0a1 1 0 011-1v-1a1 1 0 011-1m-1 1v1a1 1 0 001 1M9 7h8a3 3 0 013 3v2"
              ></path>
            </svg>
          </div>

          <!-- Camera off indicator -->
          <div
            v-if="!webrtcStore.isVideoEnabled"
            class="absolute inset-0 bg-gray-800 flex items-center justify-center"
          >
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"
              ></path>
            </svg>
          </div>
        </div>

        <!-- Connection quality indicator -->
        <div
          v-if="connectionStats && showConnectionQuality"
          class="absolute top-4 right-4 bg-black bg-opacity-50 px-3 py-2 rounded-lg text-white text-sm z-10"
        >
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                connectionQuality >= 80
                  ? 'bg-green-400'
                  : connectionQuality >= 50
                    ? 'bg-yellow-400'
                    : 'bg-red-400',
              ]"
            ></div>
            <span>{{ connectionQualityText }}</span>
          </div>
        </div>
      </div>

      <!-- Single participant waiting state -->
      <div v-else class="single-user-layout">
        <div class="text-center text-white max-w-md mx-auto p-8">
          <div
            class="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-gentle"
          >
            <svg
              class="w-16 h-16 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-medium mb-2">{{ waitingMessage }}</h3>
          <p class="text-gray-400 mb-4">Share the room code to invite someone:</p>
          <div class="bg-gray-800 px-4 py-3 rounded-xl">
            <p class="font-mono font-bold text-2xl tracking-wider text-green-400">
              {{ roomInfo?.short_code }}
            </p>
          </div>
          <button
            @click="copyRoomCode"
            class="mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors inline-flex items-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              ></path>
            </svg>
            <span>{{ roomCodeCopied ? 'Copied!' : 'Copy Code' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="bg-gray-900 p-4 safe-area-inset">
      <!-- Recording Controls (Enterprise feature) -->
      <div v-if="roomInfo" class="mb-4 flex justify-center">
        <RecordingControls
          :room-code="roomInfo.short_code"
          :participant-id="currentParticipantId"
          @recording-started="onRecordingStarted"
          @recording-stopped="onRecordingStopped"
        />
      </div>

      <!-- Multi-user controls for 3+ participants -->
      <MultiUserControls
        v-if="webrtcStore.isMultiUserCall"
        :participant-count="webrtcStore.participantCount"
        @layout-changed="onLayoutChanged"
        @screen-share-toggled="onScreenShareToggled"
        @recording-toggled="onRecordingToggled"
        @participant-pinned="onParticipantPinned"
      />

      <!-- Standard controls for 2-user calls (backward compatibility) -->
      <div v-else class="max-w-md mx-auto flex items-center justify-center space-x-6">
        <!-- Toggle Audio -->
        <button
          @click="webrtcStore.toggleAudio"
          :class="[
            'control-button',
            webrtcStore.isAudioEnabled ? 'control-button-active' : 'control-button-danger',
          ]"
          :title="webrtcStore.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'"
        >
          <svg
            v-if="webrtcStore.isAudioEnabled"
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            ></path>
          </svg>
          <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v2M4 9h1m11 0h5m-9 0a1 1 0 011-1v-1a1 1 0 011-1m-1 1v1a1 1 0 001 1M9 7h8a3 3 0 013 3v2"
            ></path>
          </svg>
        </button>

        <!-- Toggle Video -->
        <button
          @click="webrtcStore.toggleVideo"
          :class="[
            'control-button',
            webrtcStore.isVideoEnabled ? 'control-button-active' : 'control-button-danger',
          ]"
          :title="webrtcStore.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'"
        >
          <svg
            v-if="webrtcStore.isVideoEnabled"
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            ></path>
          </svg>
          <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-1.5-1.5m-6.364-6.364L8.5 14.5 7 13l1.636-1.636m0 0L9 10.5"
            ></path>
          </svg>
        </button>

        <!-- Share Room -->
        <button
          @click="shareRoom"
          class="control-button control-button-inactive"
          title="Share room"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
            ></path>
          </svg>
        </button>

        <!-- End Call -->
        <button
          @click="handleEndCall"
          class="control-button control-button-danger bg-red-500 hover:bg-red-600"
          title="End call"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18"
            ></path>
          </svg>
        </button>
      </div>

      <!-- Screen Share Controls -->
      <div v-if="roomInfo" class="mt-4">
        <ScreenShareControls
          :room-code="roomInfo.short_code"
          :participant-id="currentParticipantId"
          :peer-connection="peerConnection"
          @screen-share-started="onScreenShareStarted"
          @screen-share-stopped="onScreenShareStopped"
        />
      </div>

      <!-- Connection status message -->
      <div v-if="connectionMessage" class="mt-4 text-center text-sm text-gray-400">
        {{ connectionMessage }}
      </div>

      <!-- Fallback mode message -->
      <div v-if="fallbackModeMessage" class="mt-4 text-center">
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm">
          <div class="flex items-center justify-center space-x-2 text-yellow-800 dark:text-yellow-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <span>{{ fallbackModeMessage }}</span>
          </div>

          <!-- Fallback controls -->
          <div v-if="showFallbackControls" class="mt-3 flex justify-center space-x-2">
            <button
              v-if="canRestoreVideo"
              @click="restoreVideoFromAudioOnly"
              class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors"
            >
              Restore Video
            </button>
            <button
              @click="handleConnectionHelp"
              class="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
            >
              Get Help
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <Teleport to="body">
      <div
        v-if="showShareModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showShareModal = false"
      >
        <div class="card w-full max-w-md p-6 animate-slide-up" @click.stop>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Share Room</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >Room Code</label
              >
              <div class="flex items-center space-x-2">
                <input
                  :value="roomInfo?.short_code"
                  readonly
                  class="input-field flex-1 font-mono text-center text-lg tracking-wider"
                />
                <button @click="copyRoomCode" class="btn-secondary px-4 py-3 min-w-[70px]">
                  {{ roomCodeCopied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >Room Link</label
              >
              <div class="flex items-center space-x-2">
                <input :value="roomLink" readonly class="input-field flex-1 text-sm" />
                <button @click="copyRoomLink" class="btn-secondary px-4 py-3 min-w-[70px]">
                  {{ roomLinkCopied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>

            <!-- QR Code (if available) -->
            <div v-if="qrCodeUrl" class="text-center">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >QR Code</label
              >
              <div class="inline-block p-3 bg-white rounded-lg">
                <img :src="qrCodeUrl" alt="Room QR Code" class="w-32 h-32" />
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button @click="showShareModal = false" class="btn-primary px-6 py-2">Close</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Connection Stats Modal -->
    <Teleport to="body">
      <div
        v-if="showStats"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showStats = false"
      >
        <div class="card w-full max-w-lg p-6 animate-slide-up max-h-96 overflow-y-auto" @click.stop>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Connection Statistics
          </h3>

          <div v-if="connectionStats" class="space-y-4 text-sm">
            <!-- Overall Quality -->
            <div
              class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <span class="font-medium">Connection Quality</span>
              <div class="flex items-center space-x-2">
                <div
                  :class="[
                    'w-3 h-3 rounded-full',
                    connectionQuality >= 80
                      ? 'bg-green-400'
                      : connectionQuality >= 50
                        ? 'bg-yellow-400'
                        : 'bg-red-400',
                  ]"
                ></div>
                <span>{{ connectionQuality }}%</span>
              </div>
            </div>

            <!-- Video Stats -->
            <div v-if="connectionStats.video">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">Video</h4>
              <div class="space-y-2 pl-4">
                <div class="flex justify-between">
                  <span>Resolution</span>
                  <span>{{ videoResolution }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Frame Rate</span>
                  <span>{{ videoFrameRate }} fps</span>
                </div>
                <div class="flex justify-between">
                  <span>Bitrate</span>
                  <span>{{ videoBitrate }} kbps</span>
                </div>
              </div>
            </div>

            <!-- Audio Stats -->
            <div v-if="connectionStats.audio">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">Audio</h4>
              <div class="space-y-2 pl-4">
                <div class="flex justify-between">
                  <span>Bitrate</span>
                  <span>{{ audioBitrate }} kbps</span>
                </div>
              </div>
            </div>

            <!-- Connection Stats -->
            <div v-if="connectionStats.connection">
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">Connection</h4>
              <div class="space-y-2 pl-4">
                <div class="flex justify-between">
                  <span>Round Trip Time</span>
                  <span>{{ roundTripTime }} ms</span>
                </div>
                <div class="flex justify-between">
                  <span>Bandwidth</span>
                  <span>{{ bandwidth }} kbps</span>
                </div>
                <div class="flex justify-between">
                  <span>Packet Loss</span>
                  <span>{{ packetLoss }}%</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8 text-gray-500">
            <p>No connection statistics available</p>
          </div>

          <div class="mt-6 flex justify-end">
            <button @click="showStats = false" class="btn-primary px-6 py-2">Close</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Connection Help Modal -->
    <Teleport to="body">
      <div
        v-if="showConnectionHelp"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showConnectionHelp = false"
      >
        <div class="card w-full max-w-md p-6 animate-slide-up" @click.stop>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connection Help</h3>

          <div class="space-y-4 text-sm">
            <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">Common Solutions:</h4>
              <ul class="space-y-1 text-blue-800 dark:text-blue-200">
                <li>• Check your internet connection</li>
                <li>• Disable VPN if using one</li>
                <li>• Close other applications using camera/microphone</li>
                <li>• Refresh the page to restart the call</li>
              </ul>
            </div>

            <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 class="font-medium text-green-900 dark:text-green-100 mb-2">Still Having Issues?</h4>
              <ul class="space-y-1 text-green-800 dark:text-green-200">
                <li>• Try using a different browser</li>
                <li>• Check if your firewall is blocking the connection</li>
                <li>• Ensure no browser extensions are interfering</li>
              </ul>
            </div>

            <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <h4 class="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Current Status:</h4>
              <div class="text-yellow-800 dark:text-yellow-200">
                <p><strong>Mode:</strong> {{ currentFallbackMode || 'Normal' }}</p>
                <p><strong>Quality:</strong> {{ connectionQualityText }}</p>
                <p><strong>State:</strong> {{ webrtcStore.connectionState }}</p>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-between">
            <button @click="showConnectionHelp = false" class="btn-secondary px-4 py-2">
              Close
            </button>
            <button @click="refreshConnection" class="btn-primary px-4 py-2 bg-red-500 hover:bg-red-600">
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Full screen loading overlay -->
    <div
      v-if="isConnecting"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
    >
      <div class="text-center text-white">
        <div
          class="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"
        ></div>
        <h3 class="text-xl font-medium mb-2">{{ connectingMessage }}</h3>
        <p class="text-gray-300">{{ connectingSubMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWebRTCStore } from '@/stores/webrtc'
import { useRoomsStore } from '@/stores/rooms'
import { useGlobalStore } from '@/stores/global'
import ParticipantGrid from '@/components/ParticipantGrid.vue'
import RoomChat from '@/components/RoomChat.vue'
import AudioSettings from '@/components/AudioSettings.vue'
import RecordingControls from '@/components/RecordingControls.vue'
import ScreenShareControls from '@/components/ScreenShareControls.vue'
import MultiUserControls from '@/components/MultiUserControls.vue'
import * as webrtcService from '@/services/webrtc'
import * as utils from '@/services/utils'
import * as mediaService from '@/services/media'

const route = useRoute()
const router = useRouter()
const webrtcStore = useWebRTCStore()
const roomsStore = useRoomsStore()
const globalStore = useGlobalStore()

// Template refs
const localVideoRef = ref(null)
const remoteVideoRef = ref(null)

// Reactive state
const roomInfo = ref(null)
const callStartTime = ref(null)
const callDuration = ref(0)
const localVideoSize = ref('medium')
const showShareModal = ref(false)
const showStats = ref(false)
const showMenu = ref(false)
const roomCodeCopied = ref(false)
const roomLinkCopied = ref(false)
const shouldMirrorLocal = ref(true)
const showVideoInfo = ref(false)
const showConnectionQuality = ref(true)
const isConnecting = ref(false)
const connectingMessage = ref('Connecting...')
const connectingSubMessage = ref('Setting up your video call')

// Connection monitoring
const connectionStats = ref(null)
const statsMonitor = ref(null)

// Fallback and quality state
const isInFallbackMode = ref(false)
const currentFallbackMode = ref(null) // 'audio_only', 'chat_only', null
const connectionQualityWarnings = ref([])
const showConnectionHelp = ref(false)

// Chat and Screen Share state
const showChat = ref(false)
const unreadMessages = ref(0)
const websocket = ref(null)
const currentParticipantId = ref(null)
const isScreenSharing = ref(false)
const peerConnection = ref(null)

// Connection state variables
const connectionProgress = ref('Please wait while we set up your call')
const connectionRetryCount = ref(0)
const maxRetries = 3

// Computed properties
const connectionStatusText = computed(() => {
  switch (webrtcStore.connectionState) {
    case 'new':
      return 'Initializing...'
    case 'connecting':
      return 'Connecting...'
    case 'connected':
      return 'Connected'
    case 'disconnected':
      return 'Disconnected'
    case 'failed':
      return 'Connection failed'
    case 'closed':
      return 'Connection closed'
    default:
      return 'Unknown'
  }
})

const connectionStatusColor = computed(() => {
  switch (webrtcStore.connectionState) {
    case 'connected':
      return 'bg-green-400'
    case 'connecting':
    case 'new':
      return 'bg-yellow-400'
    case 'disconnected':
    case 'failed':
    case 'closed':
      return 'bg-red-400'
    default:
      return 'bg-gray-400'
  }
})

const participantCount = computed(() => {
  return webrtcStore.remoteParticipants.length + 1 // +1 for local participant
})

const roomLink = computed(() => {
  if (roomInfo.value) {
    return `${window.location.origin}/join/${roomInfo.value.short_code}`
  }
  return ''
})

const qrCodeUrl = computed(() => {
  return roomInfo.value?.qr_code || null
})

const waitingMessage = computed(() => {
  const messages = [
    'Waiting for others to join...',
    'Room is ready for participants',
    'Share the code to get started',
  ]
  return messages[Math.floor(Date.now() / 5000) % messages.length]
})

const connectionMessage = computed(() => {
  if (webrtcStore.connectionState === 'connecting') {
    return 'Establishing secure connection...'
  } else if (webrtcStore.connectionState === 'failed') {
    return isInFallbackMode.value
      ? `Connection issues detected. Running in ${currentFallbackMode.value?.replace('_', '-')} mode.`
      : 'Connection failed. Please check your internet connection.'
  } else if (webrtcStore.connectionState === 'disconnected') {
    return webrtcStore.connectionRecoveryInProgress
      ? 'Attempting to restore connection...'
      : 'Disconnected. Attempting to reconnect...'
  }
  return ''
})

const fallbackModeMessage = computed(() => {
  switch (currentFallbackMode.value) {
    case 'audio_only':
      return 'Video unavailable. Continue with audio only or check your connection.'
    case 'chat_only':
      return 'Audio and video unavailable. You can continue with chat or refresh the page.'
    default:
      return null
  }
})

const showFallbackControls = computed(() => {
  return isInFallbackMode.value && currentFallbackMode.value !== null
})

const canRestoreVideo = computed(() => {
  return currentFallbackMode.value === 'audio_only' && webrtcStore.hasLocalVideo
})

// Connection quality computed properties
const connectionQuality = computed(() => {
  if (!connectionStats.value) return 0
  return webrtcService.calculateQuality(connectionStats.value)
})

const connectionQualityText = computed(() => {
  const quality = connectionQuality.value
  if (quality >= 80) return 'Excellent'
  if (quality >= 60) return 'Good'
  if (quality >= 40) return 'Fair'
  return 'Poor'
})

const videoResolution = computed(() => {
  if (connectionStats.value?.video?.inbound) {
    const { frameWidth, frameHeight } = connectionStats.value.video.inbound
    return `${frameWidth || 0}×${frameHeight || 0}`
  }
  return 'N/A'
})

const videoFrameRate = computed(() => {
  return connectionStats.value?.video?.inbound?.framesPerSecond || 0
})

const videoBitrate = computed(() => {
  if (connectionStats.value?.video?.inbound?.bytesReceived) {
    return Math.round(connectionStats.value.video.inbound.bytesReceived / 1000)
  }
  return 0
})

const audioBitrate = computed(() => {
  if (connectionStats.value?.audio?.inbound?.bytesReceived) {
    return Math.round(connectionStats.value.audio.inbound.bytesReceived / 1000)
  }
  return 0
})

const roundTripTime = computed(() => {
  const rtt = connectionStats.value?.connection?.currentRoundTripTime
  return rtt ? Math.round(rtt * 1000) : 0
})

const bandwidth = computed(() => {
  const bw = connectionStats.value?.connection?.availableOutgoingBitrate
  return bw ? Math.round(bw / 1000) : 0
})

const packetLoss = computed(() => {
  if (connectionStats.value?.video?.inbound) {
    const { packetsLost, packetsReceived } = connectionStats.value.video.inbound
    if (packetsReceived && packetsLost) {
      return Math.round((packetsLost / packetsReceived) * 100)
    }
  }
  return 0
})

const remoteVideoInfo = computed(() => {
  if (connectionStats.value?.video?.inbound) {
    const { frameWidth, frameHeight, framesPerSecond } = connectionStats.value.video.inbound
    return `${frameWidth}×${frameHeight} @ ${Math.round(framesPerSecond)}fps`
  }
  return ''
})

// Methods
const initializeCall = async () => {
  const roomId = route.params.roomId

  try {
    isConnecting.value = true
    connectionMessage.value = 'Finding room...'
    connectionProgress.value = 'Step 1/4: Locating room'

    // Get room info
    const roomResult = await roomsStore.getRoomInfo(roomId)
    if (!roomResult.success) {
      globalStore.addNotification('Room not found or expired', 'error')
      router.push('/')
      return
    }

    roomInfo.value = roomResult.room
    connectionMessage.value = 'Accessing camera and microphone...'
    connectionProgress.value = 'Step 2/4: Setting up media devices'

    // Initialize media
    const mediaResult = await webrtcStore.initializeLocalMedia()
    if (!mediaResult.success) {
      globalStore.addNotification('Failed to access camera/microphone', 'error')
    }

    connectingMessage.value = 'Setting up connection...'
    connectingSubMessage.value = 'Preparing for video call'

    // Create peer connection
    const peerResult = webrtcStore.createPeerConnection()
    if (!peerResult.success) {
      throw new Error('Failed to create peer connection')
    }

    connectingMessage.value = 'Connecting to room...'
    connectingSubMessage.value = 'Almost ready'

    // Connect WebSocket with timeout
    try {
      await webrtcStore.connectWebSocket(roomId)
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      globalStore.addNotification('Failed to connect to room. Please try again.', 'error')
      isConnecting.value = false
      return
    }

    // Start call timer and monitoring
    callStartTime.value = new Date()
    startStatsMonitoring()
    setupEnhancedMonitoring()

    isConnecting.value = false
  } catch (error) {
    console.error('Failed to initialize call:', error)
    globalStore.addNotification('Failed to join call', 'error')
    isConnecting.value = false
    router.push('/')
  }
}

const handleEndCall = async () => {
  try {
    // Show confirmation if call is active
    if (webrtcStore.isConnected) {
      const confirmed = confirm('Are you sure you want to end this call?')
      if (!confirmed) return
    }

    // Stop stats monitoring
    if (statsMonitor.value) {
      clearInterval(statsMonitor.value)
      statsMonitor.value = null
    }

    // End the call
    await webrtcStore.endCall()

    // Leave room
    if (roomInfo.value) {
      const callEndTime = new Date()
      const duration = Math.floor((callEndTime - callStartTime.value) / 1000)

      await roomsStore.leaveRoom(roomInfo.value.room_id)

      // Update history with call duration
      roomsStore.updateHistoryEntry(roomInfo.value.room_id, {
        duration: duration,
        status: 'completed',
        ended_at: callEndTime.toISOString(),
      })
    }

    router.push('/')
  } catch (error) {
    console.error('Failed to end call properly:', error)
    // Force navigate even if there's an error
    router.push('/')
  }
}

const toggleLocalVideoSize = () => {
  const sizes = ['small', 'medium', 'large']
  const currentIndex = sizes.indexOf(localVideoSize.value)
  const nextIndex = (currentIndex + 1) % sizes.length
  localVideoSize.value = sizes[nextIndex]
}

const shareRoom = () => {
  showShareModal.value = true
  showMenu.value = false
}

const copyRoomCode = async () => {
  if (roomInfo.value) {
    const result = await utils.copyToClipboard(roomInfo.value.short_code)
    if (result.success) {
      roomCodeCopied.value = true
      globalStore.addNotification('Room code copied!', 'success', 2000)
      setTimeout(() => {
        roomCodeCopied.value = false
      }, 2000)
    }
  }
}

const copyRoomLink = async () => {
  const result = await utils.copyToClipboard(roomLink.value)
  if (result.success) {
    roomLinkCopied.value = true
    globalStore.addNotification('Room link copied!', 'success', 2000)
    setTimeout(() => {
      roomLinkCopied.value = false
    }, 2000)
  }
}

const onRemoteVideoLoaded = () => {
  showVideoInfo.value = true
  setTimeout(() => {
    showVideoInfo.value = false
  }, 3000)
}

const onParticipantCountChanged = (data) => {
  console.log('Participant count changed:', data)
  // Handle participant count changes if needed
}

const onLayoutChanged = (layout) => {
  console.log('Layout changed to:', layout)
  // Handle layout changes if needed
}

const onScreenShareToggled = (isSharing) => {
  console.log('Screen share toggled:', isSharing)
  // Handle screen share toggle if needed
}

const onRecordingToggled = (isRecording) => {
  console.log('Recording toggled:', isRecording)
  // Handle recording toggle if needed
}

const onParticipantPinned = (participantId) => {
  console.log('Participant pinned:', participantId)
  // Handle participant pinning if needed
}

const startStatsMonitoring = () => {
  if (webrtcStore.peerConnection) {
    statsMonitor.value = webrtcService.createQualityMonitor(
      webrtcStore.peerConnection,
      (quality, stats) => {
        connectionStats.value = stats
      },
      2000, // Update every 2 seconds
    )
  }
}

const setupEnhancedMonitoring = () => {
  // Monitor connection quality and fallback scenarios
  if (webrtcStore.peerConnection) {
    webrtcService.monitorConnectionState(
      webrtcStore.peerConnection,
      'main_participant',
      handleConnectionRecovery,
      handleConnectionQualityChange
    )
  }
}

const handleConnectionRecovery = (recoveryInfo) => {
  console.log('Connection recovery needed:', recoveryInfo)

  if (recoveryInfo.type === 'connection_failed') {
    if (recoveryInfo.canRecover === false) {
      globalStore.addNotification(
        'Unable to maintain connection. Please refresh the page.',
        'error',
        10000
      )
      showConnectionHelp.value = true
    } else {
      globalStore.addNotification('Attempting to restore connection...', 'info', 3000)
    }
  }
}

const handleConnectionQualityChange = (quality, state) => {
  console.log('Connection quality changed:', quality, state)

  // Show warnings for poor quality
  if (quality.score < 40 && !connectionQualityWarnings.value.includes('poor_quality')) {
    connectionQualityWarnings.value.push('poor_quality')
    globalStore.addNotification(
      'Connection quality is poor. The system will attempt to optimize.',
      'warning',
      5000
    )
  }

  // Clear warnings when quality improves
  if (quality.score >= 60) {
    connectionQualityWarnings.value = []
  }
}

const restoreVideoFromAudioOnly = () => {
  if (currentFallbackMode.value === 'audio_only' && webrtcStore.hasLocalVideo) {
    // Attempt to restore video by re-enabling video tracks
    globalStore.addNotification('Attempting to restore video...', 'info', 3000)

    // This would trigger a reconnection with video enabled
    // The retry service will handle the restoration
    webrtcStore.toggleVideo()

    // Reset fallback mode
    isInFallbackMode.value = false
    currentFallbackMode.value = null
  }
}

const handleConnectionHelp = () => {
  showConnectionHelp.value = true
}

const refreshConnection = () => {
  window.location.reload()
}

// Chat handlers
const onNewChatMessage = (message) => {
  if (!showChat.value) {
    unreadMessages.value++
    // Optional: Play notification sound
    // new Audio('/notification.mp3').play()
  }
}

const toggleScreenShare = async () => {
  if (isScreenSharing.value) {
    // Stop screen sharing handled by ScreenShareControls component
    isScreenSharing.value = false
  } else {
    isScreenSharing.value = true
  }
}

const onScreenShareStarted = ({ session, stream }) => {
  console.log('Screen share started:', session)
  isScreenSharing.value = true
  // Add screen share stream to peer connection if needed
  if (peerConnection.value && stream) {
    stream.getTracks().forEach(track => {
      peerConnection.value.addTrack(track, stream)
    })
  }
}

const onScreenShareStopped = ({ session }) => {
  console.log('Screen share stopped:', session)
  isScreenSharing.value = false
}

// Recording handlers
const onRecordingStarted = (recording) => {
  console.log('Recording started:', recording)
  // Optional: Show notification
}

const onRecordingStopped = (recording) => {
  console.log('Recording stopped:', recording)
  // Optional: Show notification
}

// Audio settings handler
const onAudioSettingsChanged = async (settings) => {
  console.log('Audio settings changed:', settings)
  
  // Apply new audio constraints
  try {
    const constraints = {
      audio: {
        deviceId: settings.deviceId ? { exact: settings.deviceId } : undefined,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl
      }
    }
    
    // Restart audio stream with new settings
    if (webrtcStore.localStream) {
      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Replace audio track
      const audioTrack = newStream.getAudioTracks()[0]
      const oldAudioTrack = webrtcStore.localStream.getAudioTracks()[0]
      
      if (oldAudioTrack) {
        webrtcStore.localStream.removeTrack(oldAudioTrack)
        oldAudioTrack.stop()
      }
      
      webrtcStore.localStream.addTrack(audioTrack)
      
      console.log('Audio settings applied successfully')
    }
  } catch (error) {
    console.error('Failed to apply audio settings:', error)
  }
}

// Watch chat visibility to reset unread count
watch(showChat, (isVisible) => {
  if (isVisible) {
    unreadMessages.value = 0
  }
})

// Watch for stream changes
watch(
  () => webrtcStore.localStream,
  (newStream) => {
    nextTick(() => {
      if (localVideoRef.value && newStream) {
        localVideoRef.value.srcObject = newStream
      }
    })
  },
  { immediate: true },
)

watch(
  () => webrtcStore.remoteStream,
  (newStream) => {
    nextTick(() => {
      if (remoteVideoRef.value && newStream) {
        remoteVideoRef.value.srcObject = newStream
      }
    })
  },
  { immediate: true },
)

// Update call duration
let durationInterval = null

const updateCallDuration = () => {
  if (callStartTime.value) {
    callDuration.value = Math.floor((new Date() - callStartTime.value) / 1000)
  }
}

// Click outside directive
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  },
}

// Lifecycle
onMounted(() => {
  initializeCall()
  durationInterval = setInterval(updateCallDuration, 1000)
})

// Импортируем onUnmounted выше в скрипте
import { onUnmounted } from 'vue'

onUnmounted(async () => {
  // Cleanup intervals
  if (durationInterval) {
    clearInterval(durationInterval)
  }
  if (statsMonitor.value) {
    clearInterval(statsMonitor.value)
  }

  // End call and leave room
  try {
    await webrtcStore.endCall()

    if (roomInfo.value) {
      await roomsStore.leaveRoom(roomInfo.value.room_id)
    }
  } catch (error) {
    console.error('Cleanup error:', error)
  }
})
</script>

<style scoped>
.mirror {
  transform: scaleX(-1);
}

.control-button {
  @apply p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95;
}

.control-button-active {
  @apply bg-green-500 hover:bg-green-600 text-white;
}

.control-button-inactive {
  @apply bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200;
}

.control-button-danger {
  @apply bg-red-500 hover:bg-red-600 text-white;
}

/* Animations */
@keyframes bounce-gentle {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

.animate-bounce-gentle {
  animation: bounce-gentle 2s ease-in-out infinite;
}

/* Responsive design */
@media (max-width: 768px) {
  .control-button {
    @apply p-3;
  }

  .control-button svg {
    @apply w-5 h-5;
  }
}

/* Safe area for mobile devices */
.safe-area-inset {
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
}
</style>

<script>
export default {
  data() {
    return {
      // Существующие свойства
      isConnecting: false,
      connectionMessage: 'Подключение к комнате...',
      connectionProgress: 'Инициализация...',
      connectionRetryCount: 0,
      maxRetries: 3,
      showMenu: false,
      // Новые свойства для записи
      isRecording: false,
      mediaRecorder: null,
      recordedChunks: []
    };
  },
  methods: {
    // Существующие методы
    
    toggleRecording() {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    },
  
  startRecording() {
    if (!this.localStream) {
      this.$toast.error('Нет доступного потока для записи');
      return;
    }
    
    try {
      // Получаем все аудио и видео потоки
      const streams = [this.localStream];
      this.participants.forEach(p => {
        if (p.stream) streams.push(p.stream);
      });
      
      // Создаем общий поток из всех потоков
      const combinedStream = new MediaStream();
      
      // Добавляем все аудио и видео треки в общий поток
      streams.forEach(stream => {
        stream.getTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      });
      
      // Создаем MediaRecorder
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      this.recordedChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        // Создаем Blob из записанных данных
        const blob = new Blob(this.recordedChunks, {
          type: 'video/webm'
        });
        
        // Создаем URL для скачивания
        const url = URL.createObjectURL(blob);
        
        // Создаем ссылку для скачивания
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `videocall-recording-${new Date().toISOString()}.webm`;
        
        // Добавляем ссылку в DOM и кликаем по ней
        document.body.appendChild(a);
        a.click();
        
        // Удаляем ссылку из DOM
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        this.$toast.success('Запись сохранена');
      };
      
      // Начинаем запись
      this.mediaRecorder.start();
      this.isRecording = true;
      this.$toast.info('Запись начата');
    } catch (error) {
      console.error('Ошибка при начале записи:', error);
      this.$toast.error('Не удалось начать запись');
    }
  },
  
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }
}
}
</script>
