<!-- src/components/VideoCall.vue - Complete main video call component -->
<template>
  <div class="min-h-screen bg-warp-bg text-warp-text flex flex-col main-container">
    <!-- Header -->
    <VideoCallHeader
      :room-code="roomInfo?.short_code || ''"
      :connection-status-text="connectionStatusText"
      :connection-status-color="connectionStatusColor"
      :call-duration="callDuration"
      :participant-count="participantCount"
      :unread-messages="unreadMessages"
      :is-screen-sharing="isScreenSharing"
      :is-recording="isRecording"
      :is-multi-user-call="webrtcStore?.isMultiUserCall || false"
      :show-menu="showMenu"
      @toggle-chat="chat.toggleChat()"
      @toggle-screen-share="handleToggleScreenShare"
      @audio-settings-changed="onAudioSettingsChanged"
      @toggle-menu="showMenu = !showMenu"
      @close-menu="showMenu = false"
      @share-room="shareRoom"
      @toggle-recording="toggleRecording"
      @toggle-stats="showStats = !showStats"
      @end-call="handleEndCall"
      @show-participants="showParticipantsList = true"
    />

    <!-- Video Container -->
    <div class="flex-1 relative overflow-hidden">
      <!-- Chat Panel (Overlay) -->
      <VideoCallSidebar
        :show-chat="showChat"
        :room-code="roomInfo?.short_code || ''"
        :participant-id="currentParticipantId || ''"
        :websocket="websocket"
        @close="chat.closeChat()"
        @new-message="onNewChatMessage"
      />
      <!-- Screen Share Display (overlay) - show all active screen shares -->
      <div
        v-if="orderedScreenShares.length > 0 && !isScreenShareOverlayHidden"
        class="absolute inset-0 z-30 bg-black/90 backdrop-blur-xl"
      >
        <!-- Main screen share (first one) -->
        <div
          v-if="orderedScreenShares[0]"
          class="absolute inset-0"
        >
          <video
            :ref="(el) => setScreenShareVideoRef(el, orderedScreenShares[0]?.participantId)"
            autoplay
            playsinline
            muted
            class="w-full h-full object-contain"
          ></video>
          <div class="absolute top-4 left-4 px-4 py-2 bg-warp-surfaceAlt/90 text-warp-text rounded-lg z-10 border border-warp-border">
            <p class="text-sm font-medium">
              {{ orderedScreenShares[0].participantId === currentParticipantId ? 'Your Screen' : (orderedScreenShares[0].participantName || 'Someone') + "'s Screen" }}
            </p>
          </div>
        </div>
        
        <!-- Other screen shares as thumbnails (if multiple) -->
          <div
            v-if="orderedScreenShares.length > 1"
            class="absolute bottom-4 right-4 flex gap-2 z-20"
          >
          <div
            v-for="screenShare in orderedScreenShares.slice(1)"
            :key="screenShare.participantId"
            class="w-48 h-32 bg-warp-surfaceAlt/90 backdrop-blur-md rounded-xl overflow-hidden border border-warp-border/80 cursor-pointer hover:border-warp-accent hover:shadow-warp-md transition-all duration-200"
            @click="switchToScreenShareByParticipant(screenShare.participantId)"
          >
            <video
              :ref="(el) => setScreenShareThumbnailRef(el, screenShare.participantId)"
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
            ></video>
            <div class="absolute bottom-0 left-0 right-0 px-2 py-1 bg-warp-surfaceAlt/95 text-warp-text text-xs border-t border-warp-border/60">
              {{ screenShare.participantName || 'Screen' }}
            </div>
          </div>
        </div>
        <!-- Controls for screen share overlay -->
        <button
          v-if="isScreenSharing"
          @click="handleToggleScreenShare"
          class="absolute top-4 right-4 z-10 btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Stop Sharing
        </button>
        <button
          v-else
          @click="isScreenShareOverlayHidden = true"
          class="absolute top-4 right-4 z-10 btn-secondary flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18M10.58 10.58A2 2 0 0010 12a2 2 0 002 2c.52 0 .99-.2 1.34-.53M9.88 5.09A9.77 9.77 0 0112 4c5 0 9.27 3.11 11 8-1 2.77-3 5-5.6 6.37M6.1 6.1C3.98 7.52 2.35 9.57 1 12c.84 2.33 2.29 4.27 4.16 5.63" />
          </svg>
          Hide Share
        </button>
      </div>

      <button
        v-if="orderedScreenShares.length > 0 && isScreenShareOverlayHidden"
        @click="isScreenShareOverlayHidden = false"
        class="absolute top-4 right-4 z-20 btn-secondary flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6-1s-3-7-9-7-9 7-9 7 3 7 9 7 9-7 9-7z" />
        </svg>
        View Screen Share
      </button>

      <div class="relative w-full h-full px-2 sm:px-4 pb-2">
        <!-- Multi-user call (3+ participants) -->
        <ParticipantGrid
          v-if="webrtcStore?.isMultiUserCall"
          :room-code="roomInfo?.short_code"
          :waiting-message="waitingMessage"
          :show-participants-count="true"
          :layout="currentLayout"
          :pinned-participant-id="pinnedParticipantId || ''"
          :max-participants-per-page="maxParticipantsPerPage"
          @participant-count-changed="onParticipantCountChanged"
        />

        <!-- Two-user call (existing layout for backward compatibility) -->
        <template v-else-if="webrtcStore.participantCount === 2">
        <div
          class="two-user-layout relative w-full h-full">
        <!-- Remote Video (main) -->
        <div v-if="webrtcStore.hasRemoteVideo" class="absolute inset-0 bg-black">
          <video
            ref="remoteVideoRef"
            autoplay
            playsinline
            class="w-full h-full object-contain"
            @loadedmetadata="onRemoteVideoLoaded"
          ></video>

          <!-- Remote video overlay info -->
          <div
            v-if="showVideoInfo"
            class="absolute top-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg text-white text-sm backdrop-blur-sm"
          >
            <p>{{ remoteVideoInfo }}</p>
          </div>
        </div>

        <!-- No remote video placeholder -->
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-warp-surface via-warp-bg to-black"
        >
          <div class="text-center text-warp-text max-w-md mx-auto p-8">
            <div
              class="w-32 h-32 bg-warp-surfaceAlt rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-gentle"
            >
              <svg
                class="w-16 h-16 text-warp-muted"
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
            <p class="text-warp-muted mb-4">Share the room code to invite someone:</p>
            <div class="bg-warp-surfaceAlt px-4 py-3 rounded-xl border border-warp-border">
              <p class="font-mono font-bold text-2xl tracking-wider text-warp-accent2">
                {{ roomInfo?.short_code }}
              </p>
            </div>
            <button
              @click="copyRoomCode"
              class="mt-4 btn-primary inline-flex items-center space-x-2"
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
          v-if="webrtcStore.localStream && webrtcStore.hasLocalVideo"
          :class="[
            'absolute z-20 rounded-2xl overflow-hidden shadow-warp-md transition-all duration-300 cursor-pointer border bg-black/80 backdrop-blur-md',
            localVideoSize === 'small'
              ? 'w-40 h-30 bottom-4 right-4'
              : localVideoSize === 'large'
                ? 'w-80 h-60 bottom-4 right-4'
                : 'w-60 h-45 bottom-4 right-4',
            webrtcStore.isVideoEnabled ? 'border-green-400/90' : 'border-warp-border/80',
          ]"
          @click="toggleLocalVideoSize"
        >
          <video
            :ref="setLocalVideoRef"
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
            class="absolute inset-0 bg-warp-surfaceAlt/90 backdrop-blur-sm flex items-center justify-center"
          >
            <svg class="w-8 h-8 text-warp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          class="absolute top-4 right-4 bg-warp-surfaceAlt/90 px-3 py-2 rounded-lg text-warp-text text-sm z-10 border border-warp-border"
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
      </template>

      <!-- Single participant waiting state -->
      <template v-else>
      <div class="single-user-layout flex items-center justify-center flex-col">
        <!-- Local preview video so user sees themselves even when alone in the room -->
        <div
          v-if="webrtcStore.localStream && webrtcStore.hasLocalVideo"
          class="max-w-2xl mx-auto mt-6 mb-4 rounded-xl overflow-hidden shadow-2xl border-2 border-warp-accent2 bg-black"
        >
          <video
            :ref="setLocalVideoRef"
            autoplay
            muted
            playsinline
            class="w-full h-full object-cover"
            :class="{ mirror: shouldMirrorLocal }"
          ></video>
        </div>

        <div class="text-center text-warp-text max-w-md mx-auto p-8">
          <div
            class="w-32 h-32 bg-warp-surfaceAlt rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-gentle shadow-warp-md"
          >
            <svg
              class="w-16 h-16 text-warp-muted"
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
          <p class="text-warp-muted mb-4">Share the room code to invite someone:</p>
          <div class="bg-warp-surfaceAlt px-4 py-3 rounded-xl border border-warp-border">
            <p class="font-mono font-bold text-2xl tracking-wider text-warp-accent2">
              {{ roomInfo?.short_code }}
            </p>
          </div>
          <button
            @click="copyRoomCode"
            class="mt-4 btn-primary inline-flex items-center space-x-2"
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
      </template>
</div>

    <!-- Media access error banner -->
    <div
      v-if="mediaError"
      data-test="media-error-banner"
      class="mx-4 mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 animate-fade-in"
    >
      <div class="flex">
        <svg
          class="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          ></path>
        </svg>
        <div class="flex-1">
          <p class="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
            Camera access needed
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-400 mt-1">{{ mediaError }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              @click="initializeCall"
              class="text-sm bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-md font-medium transition-colors"
            >
              Try again
            </button>
            <button
              @click="showPermissionHelp = !showPermissionHelp"
              class="text-sm text-yellow-600 dark:text-yellow-400 underline hover:no-underline"
            >
              Need help?
            </button>
            <template v-if="isDeviceBusyError">
              <button
                @click="joinWithAudioOnly"
                class="text-sm bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-md font-medium transition-colors"
              >
                Join with audio only
              </button>
              <button
                @click="joinWithVideoOnly"
                class="text-sm bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-md font-medium transition-colors"
              >
                Join with camera only
              </button>
            </template>
          </div>

          <!-- Permission help -->
          <div
            v-if="showPermissionHelp"
            class="mt-3 p-3 bg-yellow-100 dark:bg-yellow-800/30 rounded-md"
          >
            <p class="text-sm text-yellow-700 dark:text-yellow-300 font-medium mb-2">
              To enable camera access:
            </p>
            <ul class="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
              <li>• Click the camera icon in your browser's address bar</li>
              <li>• Select "Allow" when prompted for camera permission</li>
              <li>• Refresh the page if needed</li>
              <li>• Make sure no other app is using your camera or microphone</li>
              <li v-if="isDeviceBusyError">• Close apps that use camera/microphone (Zoom, Meet, etc.)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <VideoCallControls
      :room-code="roomInfo?.short_code || ''"
      :participant-id="currentParticipantId || ''"
      :is-multi-user-call="webrtcStore?.isMultiUserCall || false"
      :participant-count="webrtcStore.participantCount"
      :is-audio-enabled="webrtcStore.isAudioEnabled"
      :is-video-enabled="webrtcStore.isVideoEnabled"
      :is-screen-sharing="isScreenSharing"
      :is-recording="isRecording"
      :adaptive-level="adaptiveVideoLevel"
      @recording-started="onRecordingStarted"
      @recording-stopped="onRecordingStopped"
      @layout-changed="onLayoutChanged"
      @screen-share-toggled="onScreenShareToggled"
      @recording-toggled="onRecordingToggled"
      @participant-pinned="onParticipantPinned"
      @quality-settings-changed="onQualitySettingsChanged"
      @toggle-audio="handleToggleAudio"
      @toggle-video="handleToggleVideo"
      @share-room="shareRoom"
      @end-call="handleEndCall"
    />

      <!-- Connection status message -->
      <transition name="fade">
        <div
          v-if="connectionMessage"
          class="mt-3 text-center text-xs sm:text-sm text-warp-muted px-3 py-1 inline-flex items-center justify-center rounded-full bg-warp-surfaceAlt/80 border border-warp-border/60 mx-auto"
        >
          {{ connectionMessage }}
        </div>
      </transition>

      <!-- Fallback mode message -->
      <div v-if="fallbackModeMessage" class="mt-4 text-center">
        <div class="bg-yellow-500/10 border border-yellow-400/60 rounded-lg p-3 text-sm">
          <div class="flex items-center justify-center space-x-2 text-yellow-200">
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
              class="text-xs btn-primary px-3 py-1"
            >
              Restore Video
            </button>
            <button
              @click="handleConnectionHelp"
              class="text-xs btn-secondary px-3 py-1"
            >
              Get Help
            </button>
          </div>
        </div>
      </div>

    <!-- Share Modal -->
    <Teleport to="body">
      <div
        v-if="showShareModal"
        class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-50 p-4"
        @click="showShareModal = false"
      >
        <div class="card w-full max-w-md p-6 animate-slide-up" @click.stop>
          <h3 class="text-lg font-semibold text-warp-text mb-4">Share Room</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-warp-muted mb-2">
                Room Code
              </label>
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
              <label class="block text-sm font-medium text-warp-muted mb-2">
                Room Link
              </label>
              <div class="flex items-center space-x-2">
                <input :value="roomLink" readonly class="input-field flex-1 text-sm" />
                <button @click="copyRoomLink" class="btn-secondary px-4 py-3 min-w-[70px]">
                  {{ roomLinkCopied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>

            <!-- QR Code (if available) -->
            <div v-if="qrCodeUrl" class="text-center">
              <label class="block text-sm font-medium text-warp-muted mb-2">
                QR Code
              </label>
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

    <!-- Participants List Modal -->
    <Teleport to="body">
      <div
        v-if="showParticipantsList"
        class="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-md flex items-center justify-center z-50 p-4"
        @click="showParticipantsList = false"
      >
        <div
          class="card max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col animate-slide-up"
          @click.stop
        >
          <div class="p-6 border-b border-warp-border flex items-center justify-between">
            <h2 class="text-xl font-bold text-warp-text">Participants ({{ participantCount }})</h2>
              <button
              @click="showParticipantsList = false"
              class="p-2 hover:bg-warp-surfaceAlt rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
            <div class="flex-1 overflow-y-auto p-6">
            <!-- Local participant -->
            <div class="flex items-center space-x-3 p-3 bg-warp-surfaceAlt/70 rounded-lg mb-2">
              <div class="w-10 h-10 bg-warp-accent rounded-full flex items-center justify-center text-white font-semibold">
                {{ currentParticipantName?.charAt(0)?.toUpperCase() || 'Y' }}
              </div>
              <div class="flex-1">
                <p class="font-medium text-warp-text">{{ currentParticipantName || 'You' }}</p>
                <p class="text-sm text-warp-muted">You</p>
              </div>
              <div class="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <!-- Remote participants -->
            <div
              v-for="participant in webrtcStore.remoteParticipants"
              :key="participant.id"
              class="flex items-center space-x-3 p-3 bg-warp-surface/80 rounded-lg mb-2"
            >
              <div class="w-10 h-10 bg-warp-surfaceAlt rounded-full flex items-center justify-center text-white font-semibold">
                {{ participant.name?.charAt(0)?.toUpperCase() || 'U' }}
              </div>
              <div class="flex-1">
                <p class="font-medium text-warp-text">{{ participant.name || 'Unknown' }}</p>
                <p class="text-sm text-warp-muted">{{ participant.connectionState || 'connecting' }}</p>
              </div>
              <div
                :class="[
                  'w-2 h-2 rounded-full',
                  participant.connectionState === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
                ]"
              ></div>
            </div>
            <div v-if="webrtcStore.remoteParticipants.length === 0" class="text-center text-warp-muted py-8">
              No other participants yet
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Connection Stats Modal -->
    <Teleport to="body">
      <div
        v-if="showStats"
        class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-50 p-4"
        @click="showStats = false"
      >
        <div class="card w-full max-w-lg p-6 animate-slide-up max-h-96 overflow-y-auto" @click.stop>
          <h3 class="text-lg font-semibold text-warp-text mb-4">
            Connection Statistics
          </h3>

          <div v-if="connectionStats" class="space-y-4 text-sm">
            <!-- Overall Quality -->
            <div
              class="flex justify-between items-center p-3 bg-warp-surfaceAlt/80 rounded-lg"
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
              <h4 class="font-medium text-warp-text mb-2">Video</h4>
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
              <h4 class="font-medium text-warp-text mb-2">Audio</h4>
              <div class="space-y-2 pl-4">
                <div class="flex justify-between">
                  <span>Bitrate</span>
                  <span>{{ audioBitrate }} kbps</span>
                </div>
              </div>
            </div>

            <!-- Connection Stats -->
            <div v-if="connectionStats.connection">
              <h4 class="font-medium text-warp-text mb-2">Connection</h4>
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

          <div v-else class="text-center py-8 text-warp-muted">
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
          <h3 class="text-lg font-semibold text-warp-text mb-4">Connection Help</h3>

          <div class="space-y-4 text-sm">
            <div class="p-3 bg-blue-500/10 rounded-lg">
              <h4 class="font-medium text-warp-text mb-2">Common Solutions:</h4>
              <ul class="space-y-1 text-warp-muted">
                <li>• Check your internet connection</li>
                <li>• Disable VPN if using one</li>
                <li>• Close other applications using camera/microphone</li>
                <li>• Refresh the page to restart the call</li>
              </ul>
            </div>

            <div class="p-3 bg-green-500/10 rounded-lg">
              <h4 class="font-medium text-warp-text mb-2">Still Having Issues?</h4>
              <ul class="space-y-1 text-warp-muted">
                <li>• Try using a different browser</li>
                <li>• Check if your firewall is blocking the connection</li>
                <li>• Ensure no browser extensions are interfering</li>
              </ul>
            </div>

            <div class="p-3 bg-yellow-500/10 rounded-lg">
              <h4 class="font-medium text-warp-text mb-2">Current Status:</h4>
              <div class="text-warp-muted">
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
            <button @click="refreshConnection" class="btn-primary px-4 py-2 bg-red-600 hover:bg-red-700">
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
          class="animate-spin rounded-full h-16 w-16 border-b-2 border-warp-accent mx-auto mb-4"
        ></div>
        <h3 class="text-xl font-medium mb-2">{{ connectingMessage }}</h3>
        <p class="text-warp-muted">{{ connectingSubMessage }}</p>
      </div>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useWebRTCStore } from '@/stores/webrtc'
import { useRoomsStore } from '@/stores/rooms'
import { useGlobalStore } from '@/stores/global'
import ParticipantGrid from '@/components/ParticipantGrid.vue'
import VideoCallHeader from '@/components/VideoCallHeader.vue'
import VideoCallControls from '@/components/VideoCallControls.vue'
import VideoCallSidebar from '@/components/VideoCallSidebar.vue'
import { useVideoCallController } from '@/controllers/video-call/useVideoCallController'
import { useRoomChatController } from '@/controllers/room/useRoomChatController'
import { webrtcService } from '@/services/webrtc'
import { utils } from '@/services/utils'

const route = useRoute()
const webrtcStore = useWebRTCStore()
const roomsStore = useRoomsStore()
const globalStore = useGlobalStore()

// Initialize video call controller
const videoCall = useVideoCallController(utils.normalizeRouteParam(route.params.roomId))
const { callState, screenShare, recording } = videoCall

// Template refs - use ref for template refs (not shallowRef)
const localVideoRef = ref(null)
const remoteVideoRef = ref(null)
const screenShareVideoRefs = ref(new Map()) // Map<participantId, videoElement>
const screenShareThumbnailRefs = ref(new Map()) // Map<participantId, videoElement>
const currentScreenShareIndex = ref(0) // Index of currently displayed screen share
const isScreenShareOverlayHidden = ref(false)

// Ref callback functions for template (to avoid TypeScript syntax in template)
const setLocalVideoRef = (el) => {
  localVideoRef.value = el
}

// UI state (not business logic)
const localVideoSize = ref('medium')
const showShareModal = ref(false)
const showStats = ref(false)
const showMenu = ref(false)
const showParticipantsList = ref(false)
// Media error banner state
const mediaError = ref(null)
const showPermissionHelp = ref(false)
const roomCodeCopied = ref(false)
const roomLinkCopied = ref(false)
const shouldMirrorLocal = ref(true)
const showVideoInfo = ref(false)
const showConnectionQuality = ref(true)
const currentLayout = ref('auto') // 'auto', 'grid', 'focus', 'sidebar'

// Connection monitoring
const connectionStats = ref(null)
const statsMonitor = ref(null)

// Fallback and quality state
const isInFallbackMode = ref(false)
const currentFallbackMode = ref(null) // 'audio_only', 'chat_only', null
const connectionQualityWarnings = ref([])
const showConnectionHelp = ref(false)

// Chat state - initialize websocket and participant first
const websocket = ref(null)
const currentParticipantId = ref(null)
// Get participant name from localStorage or use default
const currentParticipantName = ref(
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem('userName') || 'You')
    : 'You',
)

// Chat controller - initialize after websocket and participant are available
const chat = useRoomChatController()
const showChat = computed(() => chat?.isOpen?.value ?? false)
const unreadMessages = computed(() => chat?.unreadCount?.value ?? 0)

// Keep chat context in sync with current room and WebSocket
watch(
  () => roomsStore.currentRoom,
  (newRoom) => {
    if (newRoom && newRoom.participant_id) {
      currentParticipantId.value = String(newRoom.participant_id)
    }
  },
  { immediate: true },
)

watch(
  () => webrtcStore.websocket,
  (newWebsocket) => {
    const ws = newWebsocket && typeof newWebsocket === 'object' && 'value' in newWebsocket
      ? newWebsocket.value
      : newWebsocket
    if (ws && typeof ws === 'object' && 'readyState' in ws) {
      websocket.value = ws
    } else {
      websocket.value = null
    }
  },
  { immediate: true },
)

// Toggle handlers for VideoCallControls - defined early to ensure availability in template
const handleToggleAudio = () => {
  webrtcStore.toggleAudio()
}

const handleToggleVideo = () => {
  webrtcStore.toggleVideo()
}

// Use roomInfo from controller
const roomInfo = computed(() => videoCall?.roomInfo?.value ?? null)

// Computed properties - use controller values
const connectionStatusText = computed(() => callState?.connectionStatusText?.value ?? 'Connecting...')
const connectionStatusColor = computed(() => callState?.connectionStatusColor?.value ?? 'bg-yellow-400')
const callDuration = computed(() => callState?.callDuration?.value ?? 0)
const isConnecting = computed(() => callState?.isConnecting?.value ?? false)
const connectingMessage = computed(() => callState?.connectingMessage?.value ?? 'Connecting...')
const connectingSubMessage = computed(() => callState?.connectingSubMessage?.value ?? '')
// connectionProgress is managed inside the controller; no local binding needed

const participantCount = computed(() => {
  // Use store's participantCount which handles SFU mode correctly
  return webrtcStore.participantCount
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
  // While the call is in the "connecting" phase, show a single
  // message based on callState rather than raw store state so
  // it disappears once the overlay is gone.
  if (isConnecting.value) {
    return 'Establishing secure connection...'
  }

  if (webrtcStore.connectionState === 'failed') {
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

// Use screen share state from controller
const isScreenSharing = computed(() => screenShare?.isScreenSharing?.value ?? false)

// Get all active screen shares (local and remote)
const allActiveScreenShares = computed(() => {
  const activeShares = []
  
  // Check local screen share
  if (screenShare?.isScreenSharing?.value && screenShare?.screenShareStream?.value) {
    const localStream = screenShare.screenShareStream.value
    const videoTracks = localStream.getVideoTracks()
    if (localStream.active && videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
      activeShares.push({
        participantId: String(currentParticipantId.value || 'local'),
        participantName: 'You',
        stream: localStream
      })
    }
  }
  
  // Check remote screen shares from store
  const remoteScreenShares = webrtcStore.remoteScreenShareStreams || new Map()
  for (const [participantId, stream] of remoteScreenShares.entries()) {
    if (stream && stream.active) {
      const videoTracks = stream.getVideoTracks()
      if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
        const participant = webrtcStore.remoteParticipants.find(p => p.id === participantId)
        activeShares.push({
          participantId: participantId,
          participantName: participant?.name || `Participant ${participantId.slice(-4)}`,
          stream: stream
        })
      }
    }
  }
  
  // Also check participants with isScreenSharing flag and screenShareStream
  for (const participant of webrtcStore.remoteParticipants || []) {
    if (participant.isScreenSharing && participant.screenShareStream) {
      const stream = participant.screenShareStream
      if (stream && stream.active) {
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
          // Check if already added
          if (!activeShares.find(s => s.participantId === participant.id)) {
            activeShares.push({
              participantId: participant.id,
              participantName: participant.name || `Participant ${participant.id.slice(-4)}`,
              stream: stream
            })
          }
        }
      }
    }
  }
  
  return activeShares
})

const orderedScreenShares = computed(() => {
  const shares = allActiveScreenShares.value
  if (shares.length === 0) return []

  const safeIndex = Math.max(0, Math.min(currentScreenShareIndex.value, shares.length - 1))
  return [
    shares[safeIndex],
    ...shares.slice(0, safeIndex),
    ...shares.slice(safeIndex + 1),
  ]
})

// Legacy active screen share helpers removed (unused in template)

// Helper function to set screen share video ref
// @param el {HTMLVideoElement|null}
// @param participantId {string|undefined}
const setScreenShareVideoRef = (el, participantId) => {
  if (el && participantId) {
    screenShareVideoRefs.value.set(participantId, el)
  } else if (participantId) {
    screenShareVideoRefs.value.delete(participantId)
  }
}

// Helper function to set screen share thumbnail ref
// @param el {HTMLVideoElement|null}
// @param participantId {string|undefined}
const setScreenShareThumbnailRef = (el, participantId) => {
  if (el && participantId) {
    screenShareThumbnailRefs.value.set(participantId, el)
  } else if (participantId) {
    screenShareThumbnailRefs.value.delete(participantId)
  }
}

// Function to switch to a different screen share
const switchToScreenShare = (index) => {
  if (index >= 0 && index < allActiveScreenShares.value.length) {
    currentScreenShareIndex.value = index
  }
}

const switchToScreenShareByParticipant = (participantId) => {
  const targetIndex = allActiveScreenShares.value.findIndex(
    (share) => share.participantId === participantId,
  )
  if (targetIndex !== -1) {
    switchToScreenShare(targetIndex)
  }
}

// Use recording state from controller
const isRecording = computed(() => recording?.isRecording?.value ?? false)

// ID of pinned participant (for focus layout / grid ordering)
const pinnedParticipantId = ref(null)

// Layout / quality controls from MultiUserControls
const maxParticipantsPerPage = ref(9)
const adaptiveQuality = ref(true)
// Current video quality mode selected in MultiUserControls: 'auto' | 'low' | 'medium' | 'high'
const currentVideoQuality = ref('auto')
// Effective quality level used for adaptive constraints when in 'auto' mode
const adaptiveVideoLevel = ref('high')

const fallbackModeMessage = computed(() => {
  switch (currentFallbackMode.value) {
    case 'audio_only':
      return 'Video unavailable. Continue with audio only or check your connection.'
    case 'video_only':
      return 'Microphone unavailable. Continue with camera only or retry device access.'
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
  return currentFallbackMode.value === 'audio_only'
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
// Use controller's initializeCall method
const initializeCall = async () => {
  const roomId = utils.normalizeRouteParam(route.params.roomId)
  if (typeof videoCall?.initializeCall !== 'function') {
    mediaError.value = 'Call controller is not initialized'
    return
  }
  const result = await videoCall.initializeCall(roomId)
  
  if (result.success) {
    const fallbackMode = result.fallbackMode ?? null
    isInFallbackMode.value = fallbackMode !== null
    currentFallbackMode.value = fallbackMode

    // Start stats monitoring after successful initialization
    startStatsMonitoring()
    setupEnhancedMonitoring()
    mediaError.value = null
  } else {
    isInFallbackMode.value = false
    currentFallbackMode.value = null

    // Surface media access errors to banner
    const err = result.error || ''
    if (/camera|microphone|Permission/i.test(err)) {
      mediaError.value = err
    }
  }
}

// Use controller's handleEndCall method
const handleEndCall = async () => {
  // Stop stats monitoring
  if (statsMonitor.value) {
    clearInterval(statsMonitor.value)
    statsMonitor.value = null
  }
  
  // Update history with call duration if needed
  if (roomInfo.value && callState?.callStartTime?.value) {
    const callEndTime = new Date()
    const duration = Math.floor((callEndTime.getTime() - callState.callStartTime.value.getTime()) / 1000)
    
    await roomsStore.updateHistoryEntry(roomInfo.value.room_id, {
      duration: duration,
      status: 'completed',
      ended_at: callEndTime.toISOString(),
    })
  }
  
  // Use controller's method
  if (typeof videoCall?.handleEndCall === 'function') {
    await videoCall.handleEndCall()
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
  currentLayout.value = layout
  // Force re-render of ParticipantGrid by triggering reactivity
  nextTick(() => {
    console.log('Layout updated in VideoCall:', currentLayout.value)
  })
}

const onScreenShareToggled = async () => {
  await handleToggleScreenShare()
}

// @param _nextIsRecording {boolean}
const onRecordingToggled = async () => {
  // Delegate to shared recording controller toggle to keep state consistent
  await toggleRecording()
}

// @param participantId {string}
const onParticipantPinned = (participantId) => {
  // Toggle pin state
  const nextPinned = pinnedParticipantId.value === participantId ? null : participantId
  pinnedParticipantId.value = nextPinned

  // Reflect pin state on participants so MultiUserControls can highlight
  webrtcStore.remoteParticipants.forEach((p) => {
    p.isPinned = nextPinned === p.id
  })
}

/**
 * @param {{ videoQuality: string; maxParticipantsPerPage: number; adaptiveQuality: boolean }} settings
 */
const onQualitySettingsChanged = (settings) => {
  currentVideoQuality.value = settings.videoQuality || 'auto'

  // Clamp max participants per page to sane bounds
  const raw = Number(settings.maxParticipantsPerPage) || 9
  maxParticipantsPerPage.value = Math.min(25, Math.max(4, raw))
  adaptiveQuality.value = !!settings.adaptiveQuality

  // When user switches away from auto, sync adaptive level once to their explicit choice
  if (currentVideoQuality.value === 'low' || currentVideoQuality.value === 'medium' || currentVideoQuality.value === 'high') {
    adaptiveVideoLevel.value = currentVideoQuality.value
  }
}

// Select active peer connection (SFU preferred, else first P2P)
const getActivePeerConnection = () => {
  if (webrtcStore.sfuMode && webrtcStore.sfuPeerConnection) {
    return webrtcStore.sfuPeerConnection
  }
  if (webrtcStore.peerConnections && webrtcStore.peerConnections.size > 0) {
    for (const pc of webrtcStore.peerConnections.values()) {
      if (pc) return pc
    }
  }
  return null
}

const startStatsMonitoring = () => {
  const pc = getActivePeerConnection()
  if (pc) {
    statsMonitor.value = webrtcService.createQualityMonitor(
      pc,
      (quality, stats) => {
        connectionStats.value = stats
      },
      2000, // Update every 2 seconds
    )
  }
}

const setupEnhancedMonitoring = () => {
  // Monitor connection quality and fallback scenarios
  const pc = getActivePeerConnection()
  if (pc) {
    webrtcService.monitorConnectionState(
      pc,
      'main_participant',
      (participantId, recoveryInfo) => handleConnectionRecovery(participantId, recoveryInfo),
      handleConnectionQualityChange
    )
  }
}

const handleConnectionRecovery = (participantId, recoveryInfo) => {
  console.log('Connection recovery needed:', participantId, recoveryInfo)

  if (recoveryInfo && recoveryInfo.canRecover === false) {
    globalStore.addNotification(
      'Unable to maintain connection. Please refresh the page.',
      'error',
      10000
    )
    showConnectionHelp.value = true
  } else if (recoveryInfo) {
    globalStore.addNotification('Attempting to restore connection...', 'info', 3000)
  }
}

const handleConnectionQualityChange = (quality, state) => {
  console.log('Connection quality changed:', quality, state)

  // If adaptive quality is disabled, just track internally without user-facing warnings
  if (!adaptiveQuality.value) {
    if (quality.score >= 60) {
      connectionQualityWarnings.value = []
    }
    return
  }

  // Auto-adapt video quality only when user selected "Auto" mode
  if (currentVideoQuality.value === 'auto') {
    // Simple state machine: high -> medium -> low when качество падает, и обратно при улучшении
    if (quality.score < 30 && adaptiveVideoLevel.value !== 'low') {
      applyAdaptiveVideoLevel('low')
    } else if (quality.score < 55 && adaptiveVideoLevel.value === 'high') {
      applyAdaptiveVideoLevel('medium')
    } else if (quality.score > 80 && adaptiveVideoLevel.value !== 'high') {
      applyAdaptiveVideoLevel('high')
    }
  }

  // Show warnings for poor quality
  if (quality.score < 40 && !connectionQualityWarnings.value.includes('poor_quality')) {
    connectionQualityWarnings.value.push('poor_quality')
    globalStore.addNotification(
      'Connection quality is poor. The system will attempt to optimize.',
      'warning',
      5000,
    )
  }

  // Clear warnings when quality improves
  if (quality.score >= 60) {
    connectionQualityWarnings.value = []
  }
}

// Apply adaptive video constraints based on current SFU/P2P stream
/**
 * @param {'low'|'medium'|'high'} level
 */
const applyAdaptiveVideoLevel = async (level) => {
  adaptiveVideoLevel.value = level

  try {
    const presets = {
      low: { width: 640, height: 360, frameRate: 15 },
      medium: { width: 1280, height: 720, frameRate: 25 },
      high: { width: 1920, height: 1080, frameRate: 30 },
    }
    const preset = presets[level]

    // Update store constraints for future getUserMedia
    const mc = webrtcStore.mediaConstraints
    if (mc && mc.video) {
      mc.video.width = { ideal: preset.width, max: preset.width }
      mc.video.height = { ideal: preset.height, max: preset.height }
      mc.video.frameRate = { ideal: preset.frameRate, max: preset.frameRate }
    }

    // Apply to current local video track
    const stream = webrtcStore.localStream
    if (stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) {
      const track = stream.getVideoTracks()[0]
      if (track && track.applyConstraints) {
        await track.applyConstraints({
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
        })
      }
    }
  } catch (err) {
    console.warn('Failed to apply adaptive video level', level, err)
  }
}

const restoreVideoFromAudioOnly = () => {
  if (currentFallbackMode.value === 'audio_only') {
    // Attempt to restore video by re-enabling video tracks
    globalStore.addNotification('Attempting to restore video...', 'info', 3000)

    // Full reconnect is the safest way to renegotiate and restore missing tracks.
    refreshConnection()
  }
}

const handleConnectionHelp = () => {
  showConnectionHelp.value = true
}

const refreshConnection = async () => {
  try {
    if (typeof videoCall?.refreshConnection === 'function') {
      await videoCall.refreshConnection()
      mediaError.value = null
      showConnectionHelp.value = false
      return
    }
  } catch (error) {
    console.error('Controller-based refresh failed, falling back to page reload:', error)
  }

  window.location.reload()
}

// Chat handlers - use controller
const onNewChatMessage = (message) => {
  // Controller handles unread count automatically
  chat.addMessage(message)
}

// Use controller's screen share methods
const handleToggleScreenShare = async () => {
  if (typeof screenShare?.toggleScreenShare !== 'function') {
    return
  }

  const wasSharing = screenShare?.isScreenSharing?.value ?? false
  await screenShare.toggleScreenShare()
  
  // Store screen share stream in webrtc store for adding to new peer connections
  if (screenShare?.isScreenSharing?.value && screenShare?.screenShareStream?.value) {
    webrtcStore.localScreenShareStream = screenShare.screenShareStream.value
  } else {
    webrtcStore.localScreenShareStream = null
  }
  
  // After toggling, if screen share started, add stream to existing peer connections
  if (screenShare?.isScreenSharing?.value && !wasSharing && screenShare?.screenShareStream?.value) {
    const stream = screenShare.screenShareStream.value
    console.log('Adding screen share stream to peer connections:', stream)
    
    // Add tracks to peer connections (P2P or SFU)
    try {
      if (webrtcStore.sfuMode && webrtcStore.sfuPeerConnection) {
        // SFU mode: use SFU manager to add screen share track
        // Access SFU manager from store - it should be available
        if (webrtcStore.sfuManager) {
          webrtcStore.sfuManager.addScreenShareTrack(stream)
          console.log('Screen share track added to SFU peer connection via manager')
        } else {
          // Fallback: add directly to SFU peer connection
          const sfuPc = webrtcStore.sfuPeerConnection
          stream.getTracks().forEach(track => {
            // Remove old screen share track if exists
            const senders = sfuPc.getSenders()
            const sender = senders.find(s => 
              s.track && s.track.kind === track.kind && (s.track.label || '').includes('screen')
            )
            if (sender) {
              sfuPc.removeTrack(sender)
            }
            // Add new screen share track
            sfuPc.addTrack(track, stream)
          })
          console.log('Screen share track added to SFU peer connection (fallback)')
          
          // Create new offer to negotiate screen share
          // Create and send offer via SFU manager if available
          if (webrtcStore.sfuManager && typeof webrtcStore.sfuManager.createAndSendOffer === 'function') {
            await webrtcStore.sfuManager.createAndSendOffer().catch((error) => {
              console.error('Failed to create/send SFU offer via manager:', error)
            })
          } else {
            const offer = await sfuPc.createOffer()
            await sfuPc.setLocalDescription(offer)
            // Fallback: avoid direct WebSocket access if possible; rely on manager when available
          }
        }
      } else if (!webrtcStore.sfuMode && webrtcStore.peerConnections && webrtcStore.peerConnections.size > 0) {
        // P2P mode: add to all existing peer connections
        webrtcStore.peerConnections.forEach((pc, participantId) => {
          try {
            stream.getTracks().forEach(track => {
              // Remove old screen share track if exists
              const senders = pc.getSenders()
              const sender = senders.find(s => 
                s.track && s.track.kind === track.kind && (s.track.label || '').includes('screen')
              )
              if (sender) {
                pc.removeTrack(sender)
              }
              // Add new screen share track
              pc.addTrack(track, stream)
            })
            console.log(`Screen share track added to peer connection for ${participantId}`)
          } catch (error) {
            console.error(`Failed to add screen share track to peer ${participantId}:`, error)
          }
        })
      } else {
        // No peer connections yet - stream is stored in webrtcStore.localScreenShareStream
        // and will be added automatically when peer connections are created
        console.log('No peer connections yet. Screen share stream stored and will be added when connections are created.')
      }
    } catch (error) {
      console.error('Failed to add screen share to peer connections:', error)
    }
  } else if (!(screenShare?.isScreenSharing?.value) && wasSharing) {
    // Screen share stopped - remove from all peer connections
    webrtcStore.localScreenShareStream = null
    
    // Remove from SFU if in SFU mode
    if (webrtcStore.sfuMode && webrtcStore.sfuPeerConnection) {
      if (webrtcStore.sfuManager) {
        webrtcStore.sfuManager.removeScreenShareTrack()
        console.log('Screen share track removed from SFU peer connection via manager')
      } else {
        // Fallback: remove directly
        const sfuPc = webrtcStore.sfuPeerConnection
        const senders = sfuPc.getSenders()
        senders.forEach(sender => {
          if (sender.track && (sender.track.label || '').includes('screen')) {
            sfuPc.removeTrack(sender)
          }
        })
        console.log('Screen share track removed from SFU peer connection (fallback)')
      }
    }
  }
}

// Recording handlers - use controller
const toggleRecording = async () => {
  if (roomInfo.value && typeof recording?.toggleRecording === 'function') {
    await recording.toggleRecording(roomInfo.value.short_code, currentParticipantId.value || undefined)
  }
}

const onRecordingStarted = (recordingData) => {
  console.log('Recording started:', recordingData)
  // Controller already handles notifications
}

const onRecordingStopped = (recordingData) => {
  console.log('Recording stopped:', recordingData)
  // Controller already handles notifications
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
      const newAudioTrack = newStream.getAudioTracks()[0]

      if (!newAudioTrack) {
        throw new Error('No audio track available from selected input')
      }

      const replaceSenderTrack = async (pc) => {
        if (!pc || typeof pc.getSenders !== 'function') {
          return
        }

        const audioSender = pc.getSenders().find((sender) => sender.track?.kind === 'audio')
        if (audioSender && typeof audioSender.replaceTrack === 'function') {
          await audioSender.replaceTrack(newAudioTrack)
          return
        }

        if (typeof pc.addTrack === 'function') {
          pc.addTrack(newAudioTrack, webrtcStore.localStream)
        }
      }

      if (webrtcStore.sfuPeerConnection) {
        await replaceSenderTrack(webrtcStore.sfuPeerConnection)
      }

      if (webrtcStore.peerConnections && typeof webrtcStore.peerConnections.forEach === 'function') {
        const tasks: Promise<void>[] = []
        webrtcStore.peerConnections.forEach((pc) => {
          tasks.push(replaceSenderTrack(pc))
        })
        await Promise.all(tasks)
      }

      const oldAudioTrack = webrtcStore.localStream.getAudioTracks()[0]
      if (oldAudioTrack) {
        webrtcStore.localStream.removeTrack(oldAudioTrack)
        oldAudioTrack.stop()
      }

      webrtcStore.localStream.addTrack(newAudioTrack)
      webrtcStore.isAudioEnabled = newAudioTrack.enabled

      // Stop extra tracks from temporary stream to avoid leaks.
      newStream.getTracks().forEach((track) => {
        if (track !== newAudioTrack) {
          track.stop()
        }
      })

      globalStore.addNotification('Audio settings applied', 'success', 2500)
      console.log('Audio settings applied successfully')
    }
  } catch (error) {
    console.error('Failed to apply audio settings:', error)
    globalStore.addNotification('Failed to apply audio settings', 'error', 4000)
  }
}

// Watch chat visibility to reset unread count
watch(showChat, (isVisible) => {
  if (isVisible && chat && typeof chat.markAsRead === 'function') {
    chat.markAsRead()
  }
})

// Unpin participant automatically if they leave the call
watch(
  () => webrtcStore.remoteParticipants,
  (participants) => {
    if (pinnedParticipantId.value && !participants.some((p) => p.id === pinnedParticipantId.value)) {
      pinnedParticipantId.value = null
    }
  },
  { deep: false },
)

// Watch for stream changes and video enabled state
watch(
  () => [webrtcStore.localStream, webrtcStore.isVideoEnabled],
  ([newStream, isVideoEnabled]) => {
    nextTick(() => {
      if (!localVideoRef.value) {
        // Ref not available yet, will be set when element is mounted
        return
      }
      
      // Check if stream has active video tracks
      if (newStream && newStream.active) {
        const videoTracks = newStream.getVideoTracks()
        const hasActiveVideo = videoTracks.length > 0 && videoTracks.some(track => track.enabled && track.readyState === 'live')
        
        if (hasActiveVideo && isVideoEnabled) {
          localVideoRef.value.srcObject = newStream
          console.log('Local video stream attached to video element', {
            stream: newStream,
            videoTracks: videoTracks.length,
            videoEnabled: videoTracks[0]?.enabled,
            videoReadyState: videoTracks[0]?.readyState,
            isVideoEnabled
          })
          
          // Ensure video plays
          if (!document.contains(localVideoRef.value)) {
            return
          }
          const playPromise = localVideoRef.value.play()
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              const msg = String(err?.message || '')
              // Ignore expected interruptions during layout/stream changes
              if (/interrupted|removed from the document|autoplay/i.test(msg)) {
                return
              }
              console.warn('Failed to autoplay local video:', err)
            })
          }
        } else {
          // Stream exists but video track is disabled or not live
          localVideoRef.value.srcObject = null
          console.log('Local video stream exists but video track is disabled or not live', {
            hasTracks: videoTracks.length > 0,
            trackEnabled: videoTracks[0]?.enabled,
            trackReadyState: videoTracks[0]?.readyState,
            isVideoEnabled
          })
        }
      } else {
        localVideoRef.value.srcObject = null
        console.log('Local video stream removed or not active', {
          hasStream: !!newStream,
          streamActive: newStream?.active,
          isVideoEnabled
        })
      }
    })
  },
  { immediate: true, deep: false },
)

watch(
  () => webrtcStore.remoteStream,
  (newStream) => {
    nextTick(() => {
      if (remoteVideoRef.value) {
        if (newStream && newStream.active) {
          // Only set srcObject if it's different to avoid unnecessary updates
          if (remoteVideoRef.value.srcObject !== newStream) {
            remoteVideoRef.value.srcObject = newStream
          }
          console.log('Remote video stream attached to video element', {
            hasVideoTracks: newStream.getVideoTracks().length > 0,
            hasAudioTracks: newStream.getAudioTracks().length > 0,
            streamActive: newStream.active
          })
          
          // Ensure video plays
          remoteVideoRef.value.play().catch(err => {
            console.warn('Failed to autoplay remote video:', err)
          })
        } else {
          if (remoteVideoRef.value.srcObject) {
            remoteVideoRef.value.srcObject = null
          }
          console.log('Remote video stream removed or not active', {
            hasStream: !!newStream,
            streamActive: newStream?.active
          })
        }
      }
    })
  },
  { immediate: true },
)

// Watch for screen share stream changes (local or remote)
// Watch for screen share stream changes (all active screen shares)
watch(
  () => orderedScreenShares.value,
  (orderedShares) => {
    const totalShares = allActiveScreenShares.value.length
    if (totalShares === 0) {
      currentScreenShareIndex.value = 0
      isScreenShareOverlayHidden.value = false
    } else if (currentScreenShareIndex.value >= totalShares) {
      currentScreenShareIndex.value = 0
    }

    nextTick(() => {
      // Update main screen share video
      if (orderedShares.length > 0) {
        const currentShare = orderedShares[0]
        const videoRef = screenShareVideoRefs.value.get(currentShare.participantId)
        if (videoRef && currentShare.stream) {
          if (videoRef.srcObject !== currentShare.stream) {
            videoRef.srcObject = currentShare.stream
          }
          videoRef.play().catch(err => {
            console.warn('Failed to autoplay screen share video:', err)
          })
        }
      }
      
      // Update thumbnail videos
      orderedShares.slice(1).forEach((share) => {
        const thumbnailRef = screenShareThumbnailRefs.value.get(share.participantId)
        if (thumbnailRef && share.stream) {
          if (thumbnailRef.srcObject !== share.stream) {
            thumbnailRef.srcObject = share.stream
          }
          thumbnailRef.play().catch(err => {
            console.warn('Failed to autoplay screen share thumbnail:', err)
          })
        }
      })
      
      // Clear refs for removed screen shares
      const activeParticipantIds = new Set(orderedShares.map(s => s.participantId))
      screenShareVideoRefs.value.forEach((ref, participantId) => {
        if (!activeParticipantIds.has(participantId) && ref) {
          ref.srcObject = null
        }
      })
      screenShareThumbnailRefs.value.forEach((ref, participantId) => {
        if (!activeParticipantIds.has(participantId) && ref) {
          ref.srcObject = null
        }
      })
    })
  },
  { immediate: true, deep: true }
)

// Update call duration
// Duration tracking is now handled by callState controller

// Click outside directive removed (unused)

// Lifecycle
// Update chat context when room info or websocket changes
watch(() => [roomInfo.value, websocket.value, currentParticipantId.value], ([newRoomInfo, newWebsocket, newParticipantId]) => {
  if (newRoomInfo && newParticipantId && chat && typeof chat.updateContext === 'function') {
    chat.updateContext(
      newRoomInfo.short_code,
      newParticipantId,
      currentParticipantName.value || 'You',
      newWebsocket
    )
  }
}, { immediate: true })

onMounted(async () => {
  await initializeCall()
  
  // Load recordings for the room
  if (roomInfo.value && typeof recording?.loadRecordings === 'function') {
    await recording.loadRecordings(roomInfo.value.short_code)
  }
  
  // Watch for room info changes to load recordings
  watch(() => roomInfo.value, async (newRoomInfo) => {
    if (newRoomInfo && typeof recording?.loadRecordings === 'function') {
      await recording.loadRecordings(newRoomInfo.short_code)
    }
  })
})

onUnmounted(async () => {
  // Cleanup intervals
  if (statsMonitor.value) {
    clearInterval(statsMonitor.value)
  }

  // Best-effort teardown if user leaves the route without pressing End call.
  if (
    typeof webrtcStore.endCall === 'function' &&
    (
      !!webrtcStore.isConnected ||
      !!webrtcStore.localStream ||
      ((webrtcStore.peerConnections?.size || 0) > 0)
    )
  ) {
    try {
      await webrtcStore.endCall()
    } catch (error) {
      console.error('Cleanup endCall failed during unmount:', error)
    }
  }

  // Use controller's cleanup
  if (videoCall && typeof videoCall.reset === 'function') {
    videoCall.reset()
  }
  if (chat && typeof chat.reset === 'function') {
    chat.reset()
  }
})

// Busy device detection for error banner
const isDeviceBusyError = computed((): boolean => {
  const msg = mediaError.value || ''
  return /already in use|NotReadableError|busy|unavailable/i.test(String(msg))
})

// Fallback handlers: audio-only or video-only initialization
const joinWithAudioOnly = async (): Promise<void> => {
  try {
    // Preserve full call flow: set constraints first, then run complete call initialization.
    webrtcStore.mediaConstraints = {
      ...webrtcStore.mediaConstraints,
      video: false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    } as any
    await initializeCall()
  } catch (err) {
    console.error('Failed to join with audio only:', err)
    mediaError.value = err instanceof Error ? err.message : 'Failed to initialize audio only'
  }
}

const joinWithVideoOnly = async (): Promise<void> => {
  try {
    // Preserve full call flow: set constraints first, then run complete call initialization.
    webrtcStore.mediaConstraints = {
      ...webrtcStore.mediaConstraints,
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    } as any
    await initializeCall()
  } catch (err) {
    console.error('Failed to join with video only:', err)
    mediaError.value = err instanceof Error ? err.message : 'Failed to initialize video only'
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.mirror {
  transform: scaleX(-1);
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
