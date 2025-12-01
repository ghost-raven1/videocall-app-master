<!-- src/components/AudioSettings.vue - Audio settings and testing component -->
<template>
  <div class="audio-settings">
    <button
      @click="showSettings = !showSettings"
      class="settings-button"
      title="Audio Settings"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>
    </button>

    <!-- Settings Modal -->
    <Teleport to="body">
      <div
        v-if="showSettings"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showSettings = false"
      >
        <div class="card w-full max-w-lg p-6" @click.stop>
          <h3 class="text-lg font-semibold text-warp-text mb-4">
            Audio Settings
          </h3>

          <!-- Microphone Selection -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-warp-muted mb-2">
              Microphone
            </label>
            <select
              v-model="selectedMicrophone"
              @change="changeMicrophone"
              class="input-field w-full"
            >
              <option v-for="device in microphones" :key="device.deviceId" :value="device.deviceId">
                {{ device.label || `Microphone ${device.deviceId.substring(0, 8)}` }}
              </option>
            </select>
          </div>

          <!-- Microphone Test -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-warp-muted mb-2">
              Microphone Test
            </label>
            <div class="flex items-center space-x-3">
              <button
                @click="toggleMicTest"
                :class="[
                  'px-4 py-2 rounded-lg transition-colors',
                  isTesting ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-warp-accent hover:bg-warp-accent/90 text-white'
                ]"
              >
                {{ isTesting ? 'Stop Test' : 'Test Microphone' }}
              </button>
              
              <!-- Volume Meter -->
              <div class="flex-1 bg-warp-surfaceAlt rounded-full h-4 overflow-hidden">
                <div
                  class="h-full bg-green-500 transition-all duration-100"
                  :style="{ width: `${audioLevel}%` }"
                ></div>
              </div>
              
              <span class="text-sm text-warp-muted w-12">
                {{ Math.round(audioLevel) }}%
              </span>
            </div>
          </div>

          <!-- Sensitivity (Gain) -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-warp-muted mb-2">
              Microphone Sensitivity
            </label>
            <div class="flex items-center space-x-3">
              <svg class="w-4 h-4 text-warp-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
              </svg>
              <input
                v-model.number="sensitivity"
                @input="updateSensitivity"
                type="range"
                min="0"
                max="100"
                class="flex-1"
              />
              <svg class="w-5 h-5 text-warp-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16z"></path>
              </svg>
              <span class="text-sm text-warp-muted w-12">
                {{ sensitivity }}%
              </span>
            </div>
          </div>

          <!-- Noise Suppression -->
          <div class="mb-6">
            <label class="flex items-center justify-between">
              <span class="text-sm font-medium text-warp-muted">
                Noise Suppression
              </span>
              <input
                v-model="noiseSuppression"
                @change="updateNoiseSuppression"
                type="checkbox"
                class="toggle-checkbox"
              />
            </label>
            <p class="text-xs text-warp-muted mt-1">
              Reduces background noise
            </p>
          </div>

          <!-- Echo Cancellation -->
          <div class="mb-6">
            <label class="flex items-center justify-between">
              <span class="text-sm font-medium text-warp-muted">
                Echo Cancellation
              </span>
              <input
                v-model="echoCancellation"
                @change="updateEchoCancellation"
                type="checkbox"
                class="toggle-checkbox"
              />
            </label>
            <p class="text-xs text-warp-muted mt-1">
              Prevents audio feedback
            </p>
          </div>

          <!-- Auto Gain Control -->
          <div class="mb-6">
            <label class="flex items-center justify-between">
              <span class="text-sm font-medium text-warp-muted">
                Auto Gain Control
              </span>
              <input
                v-model="autoGainControl"
                @change="updateAutoGainControl"
                type="checkbox"
                class="toggle-checkbox"
              />
            </label>
            <p class="text-xs text-warp-muted mt-1">
              Automatically adjusts volume
            </p>
          </div>

          <!-- Audio Quality Preset -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-warp-muted mb-2">
              Audio Quality
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="preset in qualityPresets"
                :key="preset.value"
                @click="applyPreset(preset)"
                :class="[
                  'px-3 py-2 rounded-lg text-sm transition-colors',
                  currentPreset === preset.value
                    ? 'bg-warp-accent text-white shadow-warp-sm'
                    : 'bg-warp-surfaceAlt text-warp-muted hover:bg-warp-surface'
                ]"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center">
            <button
              @click="resetToDefaults"
              class="text-sm text-warp-muted hover:text-warp-text"
            >
              Reset to Defaults
            </button>
            <button
              @click="showSettings = false"
              class="btn-primary px-6 py-2"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['settings-changed'])

// State
const showSettings = ref(false)
const microphones = ref([])
const selectedMicrophone = ref(null)
const isTesting = ref(false)
const audioLevel = ref(0)
const sensitivity = ref(50)
const noiseSuppression = ref(true)
const echoCancellation = ref(true)
const autoGainControl = ref(true)
const currentPreset = ref('balanced')

// Audio context for testing
let audioContext = null
let analyser = null
let microphone = null
let animationFrame = null
let testStream = null

// Quality presets
const qualityPresets = [
  {
    value: 'low',
    label: 'Low',
    settings: {
      noiseSuppression: false,
      echoCancellation: true,
      autoGainControl: false,
      sensitivity: 30
    }
  },
  {
    value: 'balanced',
    label: 'Balanced',
    settings: {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      sensitivity: 50
    }
  },
  {
    value: 'high',
    label: 'High',
    settings: {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      sensitivity: 70
    }
  }
]

// Methods
const loadMicrophones = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    microphones.value = devices.filter(device => device.kind === 'audioinput')
    
    if (microphones.value.length > 0 && !selectedMicrophone.value) {
      selectedMicrophone.value = microphones.value[0].deviceId
    }
  } catch (error) {
    console.error('Failed to load microphones:', error)
  }
}

const changeMicrophone = async () => {
  if (isTesting.value) {
    await stopMicTest()
    await startMicTest()
  }
  emitSettings()
}

const toggleMicTest = async () => {
  if (isTesting.value) {
    await stopMicTest()
  } else {
    await startMicTest()
  }
}

const startMicTest = async () => {
  try {
    const constraints = {
      audio: {
        deviceId: selectedMicrophone.value ? { exact: selectedMicrophone.value } : undefined,
        echoCancellation: echoCancellation.value,
        noiseSuppression: noiseSuppression.value,
        autoGainControl: autoGainControl.value
      }
    }

    testStream = await navigator.mediaDevices.getUserMedia(constraints)
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    microphone = audioContext.createMediaStreamSource(testStream)
    
    analyser.fftSize = 256
    microphone.connect(analyser)
    
    isTesting.value = true
    updateAudioLevel()
  } catch (error) {
    console.error('Failed to start microphone test:', error)
    alert('Failed to access microphone: ' + error.message)
  }
}

const stopMicTest = async () => {
  isTesting.value = false
  audioLevel.value = 0
  
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  
  if (testStream) {
    testStream.getTracks().forEach(track => track.stop())
    testStream = null
  }
  
  if (audioContext) {
    await audioContext.close()
    audioContext = null
  }
  
  analyser = null
  microphone = null
}

const updateAudioLevel = () => {
  if (!analyser || !isTesting.value) return
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(dataArray)
  
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length
  const normalizedLevel = (average / 255) * 100
  
  // Apply sensitivity
  audioLevel.value = Math.min(100, normalizedLevel * (sensitivity.value / 50))
  
  animationFrame = requestAnimationFrame(updateAudioLevel)
}

const updateSensitivity = () => {
  emitSettings()
}

const updateNoiseSuppression = () => {
  if (isTesting.value) {
    // Restart test with new settings
    stopMicTest().then(() => startMicTest())
  }
  emitSettings()
}

const updateEchoCancellation = () => {
  if (isTesting.value) {
    stopMicTest().then(() => startMicTest())
  }
  emitSettings()
}

const updateAutoGainControl = () => {
  if (isTesting.value) {
    stopMicTest().then(() => startMicTest())
  }
  emitSettings()
}

const applyPreset = (preset) => {
  currentPreset.value = preset.value
  noiseSuppression.value = preset.settings.noiseSuppression
  echoCancellation.value = preset.settings.echoCancellation
  autoGainControl.value = preset.settings.autoGainControl
  sensitivity.value = preset.settings.sensitivity
  
  if (isTesting.value) {
    stopMicTest().then(() => startMicTest())
  }
  emitSettings()
}

const resetToDefaults = () => {
  applyPreset(qualityPresets[1]) // Balanced preset
}

const emitSettings = () => {
  emit('settings-changed', {
    deviceId: selectedMicrophone.value,
    noiseSuppression: noiseSuppression.value,
    echoCancellation: echoCancellation.value,
    autoGainControl: autoGainControl.value,
    sensitivity: sensitivity.value
  })
}

// Lifecycle
onMounted(() => {
  loadMicrophones()
})

onUnmounted(() => {
  if (isTesting.value) {
    stopMicTest()
  }
})
</script>

<style scoped>
.settings-button {
  @apply p-2 rounded-full hover:bg-warp-surfaceAlt transition-colors text-warp-muted;
}

.toggle-checkbox {
  @apply w-12 h-6 rounded-full relative cursor-pointer appearance-none bg-warp-surfaceAlt;
  @apply checked:bg-warp-accent2 transition-colors;
}

.toggle-checkbox::after {
  content: '';
  @apply absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform;
}

.toggle-checkbox:checked::after {
  @apply transform translate-x-6;
}
</style>
