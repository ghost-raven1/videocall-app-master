<template>
  <div class="room-list">
    <div class="room-list-header">
      <div class="room-list-title">
        <h2>Комнаты</h2>
        <span class="room-count">({{ totalRooms }} комнат)</span>
      </div>
      <div class="room-list-actions">
        <button class="btn btn-primary" @click="$emit('create-room')">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"/>
          </svg>
          Создать комнату
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="room-stats" v-if="showStats">
      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ totalRooms }}</div>
          <div class="stat-label">Всего комнат</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon active">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ activeRooms }}</div>
          <div class="stat-label">Активных</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon participants">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ totalParticipants }}</div>
          <div class="stat-label">Участников</div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="room-list-filters" v-if="showFilters">
      <div class="search-box">
        <svg fill="currentColor" viewBox="0 0 20 20" class="search-icon">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
        </svg>
        <input
          type="text"
          placeholder="Поиск комнат..."
          v-model="searchQuery"
          @input="handleSearch"
          class="search-input"
        />
      </div>

      <div class="filter-controls">
        <select v-model="statusFilter" @change="handleFilterChange" class="filter-select">
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
          <option value="error">С ошибками</option>
        </select>

        <select v-model="typeFilter" @change="handleFilterChange" class="filter-select">
          <option value="">Все типы</option>
          <option value="public">Публичные</option>
          <option value="private">Приватные</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <LoadingSpinner :text="'Загрузка комнат...'" />
    </div>

    <!-- Error State -->
    <ErrorMessage
      v-else-if="error"
      :title="'Ошибка загрузки'"
      :message="error"
      type="error"
      dismissible
      @dismiss="$emit('error-cleared')"
    />

    <!-- Rooms Table -->
    <div v-else-if="rooms.length > 0" class="room-table-container">
      <table class="room-table">
        <thead>
          <tr>
            <th @click="sortBy('room_id')" class="sortable" :class="{ active: sortField === 'room_id' }">
              Комната
              <svg v-if="sortField === 'room_id'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('name')" class="sortable" :class="{ active: sortField === 'name' }">
              Название
              <svg v-if="sortField === 'name'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('status')" class="sortable" :class="{ active: sortField === 'status' }">
              Статус
              <svg v-if="sortField === 'status'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('participants')" class="sortable" :class="{ active: sortField === 'participants' }">
              Участники
              <svg v-if="sortField === 'participants'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('created_at')" class="sortable" :class="{ active: sortField === 'created_at' }">
              Создана
              <svg v-if="sortField === 'created_at'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('last_activity')" class="sortable" :class="{ active: sortField === 'last_activity' }">
              Активность
              <svg v-if="sortField === 'last_activity'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="room in rooms" :key="room.id" class="room-row">
            <td class="room-info">
              <div class="room-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                </svg>
              </div>
              <div class="room-details">
                <div class="room-id">{{ room.room_id }}</div>
                <div class="room-code">{{ room.short_code }}</div>
              </div>
            </td>
            <td class="room-name">
              <div class="room-name-text">{{ room.name }}</div>
              <div class="room-type" :class="room.type">
                {{ getTypeLabel(room.type) }}
              </div>
            </td>
            <td>
              <span :class="['status-badge', room.status]">
                <span class="status-dot" :class="room.status"></span>
                {{ getStatusLabel(room.status) }}
              </span>
            </td>
            <td class="participants">
              <div class="participant-count">
                {{ room.participants }} / {{ room.max_participants || '∞' }}
              </div>
              <div class="participant-avatars">
                <div
                  v-for="i in Math.min(room.participants, 3)"
                  :key="i"
                  class="participant-avatar"
                >
                  <img
                    :src="`https://i.pravatar.cc/24?u=${room.id}_${i}`"
                    :alt="`Участник ${i}`"
                  />
                </div>
                <div v-if="room.participants > 3" class="more-participants">
                  +{{ room.participants - 3 }}
                </div>
              </div>
            </td>
            <td class="created-date">
              {{ formatDate(room.created_at) }}
            </td>
            <td class="last-activity">
              <div class="activity-time">{{ formatDate(room.last_activity) }}</div>
              <div class="activity-relative">{{ getRelativeTime(room.last_activity) }}</div>
            </td>
            <td class="room-actions">
              <button
                class="btn btn-sm btn-secondary"
                @click="$emit('view-room', room)"
                title="Просмотреть"
              >
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button
                class="btn btn-sm btn-primary"
                @click="$emit('edit-room', room)"
                title="Редактировать"
              >
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
              </button>
              <button
                class="btn btn-sm btn-warning"
                @click="$emit('force-close-room', room)"
                title="Принудительно закрыть"
                :disabled="room.status !== 'active'"
              >
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button
                class="btn btn-sm btn-danger"
                @click="$emit('delete-room', room)"
                title="Удалить"
              >
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
                  <path fill-rule="evenodd" d="M10 5a2 2 0 00-2 2v6a2 2 0 004 0V7a2 2 0 00-2-2z" clip-rule="evenodd"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <svg fill="currentColor" viewBox="0 0 20 20" class="empty-icon">
        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
      </svg>
      <h3>Комнаты не найдены</h3>
      <p>Попробуйте изменить параметры поиска или фильтры</p>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        class="btn btn-secondary btn-sm"
        @click="changePage(currentPage - 1)"
        :disabled="currentPage <= 1"
      >
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
        Назад
      </button>

      <div class="pagination-info">
        Страница {{ currentPage }} из {{ totalPages }}
      </div>

      <button
        class="btn btn-secondary btn-sm"
        @click="changePage(currentPage + 1)"
        :disabled="currentPage >= totalPages"
      >
        Далее
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'
import ErrorMessage from '../ui/ErrorMessage.vue'

const props = defineProps({
  rooms: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  totalRooms: {
    type: Number,
    default: 0
  },
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    default: 1
  },
  perPage: {
    type: Number,
    default: 20
  },
  showStats: {
    type: Boolean,
    default: true
  },
  showFilters: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'create-room',
  'view-room',
  'edit-room',
  'delete-room',
  'force-close-room',
  'change-page',
  'search',
  'filter',
  'sort'
])

// Local state
const searchQuery = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const sortField = ref('created_at')
const sortDirection = ref('desc')

// Computed
const activeRooms = computed(() => {
  return props.rooms.filter(room => room.status === 'active').length
})

const totalParticipants = computed(() => {
  return props.rooms.reduce((total, room) => total + (room.participants || 0), 0)
})

// Methods
const handleSearch = () => {
  emit('search', searchQuery.value)
}

const handleFilterChange = () => {
  emit('filter', {
    status: statusFilter.value,
    type: typeFilter.value
  })
}

const sortBy = (field) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'asc'
  }
  emit('sort', { field: sortField.value, direction: sortDirection.value })
}

const changePage = (page) => {
  if (page >= 1 && page <= props.totalPages) {
    emit('change-page', page)
  }
}

const getStatusLabel = (status) => {
  const labels = {
    active: 'Активная',
    inactive: 'Неактивная',
    error: 'Ошибка'
  }
  return labels[status] || status
}

const getTypeLabel = (type) => {
  const labels = {
    public: 'Публичная',
    private: 'Приватная'
  }
  return labels[type] || type
}

const formatDate = (date) => {
  if (!date) return 'Никогда'
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const getRelativeTime = (date) => {
  if (!date) return ''

  const now = new Date()
  const diff = now - new Date(date)
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) {
    return `${minutes}м назад`
  } else if (hours < 24) {
    return `${hours}ч назад`
  } else {
    return `${days}д назад`
  }
}
</script>

<style scoped>
.room-list {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.room-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.room-list-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.room-count {
  color: #6b7280;
  font-size: 14px;
  margin-left: 8px;
}

.room-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  color: #6b7280;
}

.stat-icon.active {
  background: #dcfce7;
  color: #16a34a;
}

.stat-icon.participants {
  background: #e0e7ff;
  color: #4338ca;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  margin-top: 2px;
}

.room-list-filters {
  display: flex;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 250px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: #6b7280;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.filter-controls {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  min-width: 140px;
}

.filter-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.room-table-container {
  overflow-x: auto;
}

.room-table {
  width: 100%;
  border-collapse: collapse;
}

.room-table th {
  background: #f9fafb;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.room-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.room-table th.sortable:hover {
  background: #f3f4f6;
}

.room-table th.sortable.active {
  background: #e5e7eb;
}

.sort-icon {
  width: 16px;
  height: 16px;
  margin-left: 4px;
}

.room-row {
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}

.room-row:hover {
  background: #f9fafb;
}

.room-table td {
  padding: 16px;
  vertical-align: middle;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.room-details .room-id {
  font-weight: 600;
  color: #1f2937;
}

.room-code {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
}

.room-name-text {
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
}

.room-type {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.room-type.public {
  background: #dcfce7;
  color: #16a34a;
}

.room-type.private {
  background: #fef3c7;
  color: #d97706;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.error {
  background: #fef2f2;
  color: #dc2626;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.active {
  background: #16a34a;
}

.status-dot.inactive {
  background: #6b7280;
}

.status-dot.error {
  background: #dc2626;
}

.participants {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.participant-count {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.participant-avatars {
  display: flex;
  gap: 2px;
}

.participant-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid white;
}

.participant-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.more-participants {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.created-date {
  color: #6b7280;
  font-size: 14px;
}

.last-activity {
  color: #6b7280;
  font-size: 14px;
}

.activity-time {
  margin-bottom: 2px;
}

.activity-relative {
  font-size: 12px;
  color: #9ca3af;
}

.room-actions {
  display: flex;
  gap: 4px;
}

.btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 8px;
  font-size: 12px;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-warning {
  background: #d97706;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #b45309;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #374151;
}

.empty-state p {
  margin: 0;
}

.loading-container {
  padding: 60px;
  text-align: center;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
}

.pagination-info {
  font-size: 14px;
  color: #6b7280;
}
</style>