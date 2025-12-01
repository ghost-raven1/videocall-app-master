// src/admin/views/AdminRooms.vue - Admin rooms management page
<template>
  <div class="admin-rooms space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-warp-text">Управление комнатами</h2>
      <div class="flex space-x-3">
        <button
          @click="showCreateModal = true"
          class="btn-primary"
        >
          Создать комнату
        </button>
        <button
          @click="exportRooms"
          class="btn-secondary"
          :disabled="selectedRooms.length === 0"
        >
          Экспорт CSV
        </button>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="card p-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-warp-muted mb-2">
            Поиск
          </label>
          <input
            v-model="filters.search"
            @input="debounceSearch"
            type="text"
            placeholder="Поиск по ID, коду..."
            class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-warp-muted mb-2">
            Статус
          </label>
          <select
            v-model="filters.status"
            @change="loadRooms"
            class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
            <option value="error">Ошибки</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-warp-muted mb-2">
            Тип
          </label>
          <select
            v-model="filters.type"
            @change="loadRooms"
            class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
          >
            <option value="">Все типы</option>
            <option value="public">Публичные</option>
            <option value="private">Приватные</option>
          </select>
        </div>
        <div class="flex items-end">
          <button
            @click="resetFilters"
            class="w-full px-4 py-2 text-warp-muted hover:text-warp-text"
          >
            Сбросить фильтры
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div v-if="selectedRooms.length > 0" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-blue-800 dark:text-blue-200">
          Выбрано комнат: {{ selectedRooms.length }}
        </span>
        <div class="flex space-x-2">
          <button
            @click="bulkCloseRooms"
            class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Закрыть выбранные
          </button>
          <button
            @click="bulkDeleteRooms"
            class="px-3 py-1 bg-red-800 text-white text-sm rounded hover:bg-red-900"
          >
            Удалить выбранные
          </button>
          <button
            @click="clearSelection"
            class="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
          >
            Очистить выбор
          </button>
        </div>
      </div>
    </div>

    <!-- Rooms Table -->
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-warp-border/60">
          <thead class="bg-warp-surfaceAlt">
            <tr>
              <th class="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  :checked="selectAll"
                  @change="toggleSelectAll"
                  class="rounded border-warp-border text-warp-accent focus:ring-warp-accent"
                />
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Комната
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Статус
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Участники
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Создано
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-warp-surface divide-y divide-warp-border/60">
            <tr v-for="room in rooms" :key="room.id" class="hover:bg-warp-surfaceAlt">
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  :value="room.id"
                  v-model="selectedRooms"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ room.name || `Комната ${room.short_code}` }}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      ID: {{ room.room_id }} | Код: {{ room.short_code }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                  room.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                  room.status === 'inactive' ? 'bg-warp-surfaceAlt text-warp-muted border border-warp-border/60' :
                  'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                ]">
                  {{ room.status === 'active' ? 'Активна' : room.status === 'inactive' ? 'Неактивна' : 'Ошибка' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-warp-text">
                {{ room.participants || 0 }} / {{ room.max_participants || 50 }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-warp-muted">
                {{ formatDate(room.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <button
                    @click="viewRoomDetails(room)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Просмотр
                  </button>
                  <button
                    v-if="room.status === 'active'"
                    @click="closeRoom(room)"
                    class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Закрыть
                  </button>
                  <button
                    @click="deleteRoom(room)"
                    class="text-red-800 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
                  >
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="bg-warp-surface px-4 py-3 flex items-center justify-between border-t border-warp-border sm:px-6">
        <div class="flex-1 flex justify-between sm:hidden">
          <button
            @click="previousPage"
            :disabled="currentPage === 1"
            class="relative inline-flex items-center px-4 py-2 border border-warp-border text-sm font-medium rounded-md text-warp-text bg-warp-surface hover:bg-warp-surfaceAlt disabled:opacity-50"
          >
            Назад
          </button>
          <button
            @click="nextPage"
            :disabled="currentPage >= totalPages"
            class="ml-3 relative inline-flex items-center px-4 py-2 border border-warp-border text-sm font-medium rounded-md text-warp-text bg-warp-surface hover:bg-warp-surfaceAlt disabled:opacity-50"
          >
            Далее
          </button>
        </div>
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-warp-muted">
              Показано <span class="font-medium">{{ ((currentPage - 1) * perPage) + 1 }}</span>
              до <span class="font-medium">{{ Math.min(currentPage * perPage, total) }}</span>
              из <span class="font-medium">{{ total }}</span> результатов
            </p>
          </div>
          <div>
            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                @click="previousPage"
                :disabled="currentPage === 1"
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-warp-border bg-warp-surface text-sm font-medium text-warp-muted hover:bg-warp-surfaceAlt disabled:opacity-50"
              >
                Назад
              </button>
              <button
                @click="nextPage"
                :disabled="currentPage >= totalPages"
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-warp-border bg-warp-surface text-sm font-medium text-warp-muted hover:bg-warp-surfaceAlt disabled:opacity-50"
              >
                Далее
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <LoadingSpinner />
    </div>

    <!-- Create Room Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 w-96 card">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-warp-text mb-4">
            Создать новую комнату
          </h3>
          <form @submit.prevent="createRoom">
            <div class="mb-4">
              <label class="block text-sm font-medium text-warp-muted mb-2">
                Название комнаты
              </label>
              <input
                v-model="newRoom.name"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
                placeholder="Введите название комнаты"
              />
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-warp-muted mb-2">
                Максимум участников
              </label>
              <input
                v-model.number="newRoom.max_participants"
                type="number"
                min="2"
                max="100"
                class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
              />
            </div>
            <div class="mb-4">
              <label class="flex items-center">
                <input
                  v-model="newRoom.is_private"
                  type="checkbox"
                  class="rounded border-warp-border text-warp-accent focus:ring-warp-accent"
                />
                <span class="ml-2 text-sm text-warp-muted">
                  Приватная комната
                </span>
              </label>
            </div>
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                @click="showCreateModal = false"
                class="btn-secondary px-4 py-2"
              >
                Отмена
              </button>
              <button
                type="submit"
                :disabled="creating"
                class="btn-primary px-4 py-2 disabled:opacity-50"
              >
                {{ creating ? 'Создание...' : 'Создать' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useAdminStore } from '../stores/admin'
import LoadingSpinner from '../components/ui/LoadingSpinner.vue'

// Store
const adminStore = useAdminStore()

// Reactive state
const loading = ref(false)
const creating = ref(false)
const showCreateModal = ref(false)
const selectedRooms = ref([])
const currentPage = ref(1)
const perPage = ref(20)
const total = ref(0)
const totalPages = ref(0)

const rooms = ref([])

const filters = reactive({
  search: '',
  status: '',
  type: ''
})

const newRoom = reactive({
  name: '',
  max_participants: 50,
  is_private: false
})

// Computed
const selectAll = computed({
  get: () => selectedRooms.value.length === rooms.value.length && rooms.value.length > 0,
  set: (value) => {
    if (value) {
      selectedRooms.value = rooms.value.map(room => room.id)
    } else {
      selectedRooms.value = []
    }
  }
})

// Methods
const loadRooms = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: perPage.value,
      search: filters.search,
      status: filters.status,
      type: filters.type
    }

    await adminStore.loadRooms(params)
    rooms.value = adminStore.roomManagement.rooms || []
    total.value = adminStore.roomManagement.total || 0
    totalPages.value = Math.ceil(total.value / perPage.value)
  } catch (error) {
    console.error('Failed to load rooms:', error)
  } finally {
    loading.value = false
  }
}

const createRoom = async () => {
  creating.value = true
  try {
    const roomData = {
      name: newRoom.name,
      max_participants: newRoom.max_participants,
      type: newRoom.is_private ? 'private' : 'public'
    }

    await adminStore.createRoom(roomData)

    showCreateModal.value = false
    resetNewRoom()
    await loadRooms()
  } catch (error) {
    console.error('Failed to create room:', error)
  } finally {
    creating.value = false
  }
}

const viewRoomDetails = (room) => {
  // Navigate to room details or show modal
  console.log('View room details:', room)
}

const closeRoom = async (room) => {
  if (confirm(`Вы уверены, что хотите закрыть комнату ${room.name || room.short_code}?`)) {
    try {
      await adminStore.forceCloseRoom(room.id, 'Закрыто администратором')
      await loadRooms()
    } catch (error) {
      console.error('Failed to close room:', error)
    }
  }
}

const deleteRoom = async (room) => {
  if (confirm(`Вы уверены, что хотите удалить комнату ${room.name || room.short_code}?`)) {
    try {
      await adminStore.deleteRoom(room.id)
      await loadRooms()
    } catch (error) {
      console.error('Failed to delete room:', error)
    }
  }
}

const bulkCloseRooms = async () => {
  if (confirm(`Вы уверены, что хотите закрыть ${selectedRooms.value.length} комнат?`)) {
    try {
      await adminStore.bulkUpdateRooms(selectedRooms.value, 'close')
      selectedRooms.value = []
      await loadRooms()
    } catch (error) {
      console.error('Failed to bulk close rooms:', error)
    }
  }
}

const bulkDeleteRooms = async () => {
  if (confirm(`Вы уверены, что хотите удалить ${selectedRooms.value.length} комнат?`)) {
    try {
      await adminStore.bulkUpdateRooms(selectedRooms.value, 'delete')
      selectedRooms.value = []
      await loadRooms()
    } catch (error) {
      console.error('Failed to bulk delete rooms:', error)
    }
  }
}

const exportRooms = () => {
  // Export selected or all rooms to CSV
  const dataToExport = selectedRooms.value.length > 0
    ? rooms.value.filter(room => selectedRooms.value.includes(room.id))
    : rooms.value

  const csvContent = convertToCSV(dataToExport)
  downloadCSV(csvContent, 'rooms_export.csv')
}

const convertToCSV = (data) => {
  const headers = ['ID', 'Название', 'Код', 'Статус', 'Участники', 'Создано']
  const rows = data.map(room => [
    room.room_id,
    room.name || '',
    room.short_code,
    room.status,
    `${room.participants || 0}/${room.max_participants || 50}`,
    formatDate(room.created_at)
  ])

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

const downloadCSV = (content, filename) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('ru-RU')
}

const debounceSearch = debounce(() => {
  currentPage.value = 1
  loadRooms()
}, 500)

const resetFilters = () => {
  filters.search = ''
  filters.status = ''
  filters.type = ''
  currentPage.value = 1
  loadRooms()
}

const resetNewRoom = () => {
  newRoom.name = ''
  newRoom.max_participants = 50
  newRoom.is_private = false
}

const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedRooms.value = []
  } else {
    selectedRooms.value = rooms.value.map(room => room.id)
  }
}

const clearSelection = () => {
  selectedRooms.value = []
}

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadRooms()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadRooms()
  }
}

// Debounce utility function
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Lifecycle
onMounted(() => {
  loadRooms()
})
</script>