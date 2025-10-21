<template>
  <div class="user-list">
    <div class="user-list-header">
      <div class="user-list-title">
        <h2>Пользователи</h2>
        <span class="user-count">({{ totalUsers }} пользователей)</span>
      </div>
      <div class="user-list-actions">
        <button class="btn btn-primary" @click="$emit('create-user')">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"/>
          </svg>
          Добавить пользователя
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="user-stats" v-if="showStats">
      <div class="stat-card">
        <div class="stat-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ totalUsers }}</div>
          <div class="stat-label">Всего пользователей</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon online">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ onlineUsers }}</div>
          <div class="stat-label">Онлайн</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon admin">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-number">{{ adminUsers }}</div>
          <div class="stat-label">Администраторов</div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="user-list-filters" v-if="showFilters">
      <div class="search-box">
        <svg fill="currentColor" viewBox="0 0 20 20" class="search-icon">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
        </svg>
        <input
          type="text"
          placeholder="Поиск пользователей..."
          v-model="searchQuery"
          @input="handleSearch"
          class="search-input"
        />
      </div>

      <div class="filter-controls">
        <select v-model="statusFilter" @change="handleFilterChange" class="filter-select">
          <option value="">Все статусы</option>
          <option value="online">Онлайн</option>
          <option value="offline">Офлайн</option>
        </select>

        <select v-model="roleFilter" @change="handleFilterChange" class="filter-select">
          <option value="">Все роли</option>
          <option value="admin">Администратор</option>
          <option value="moderator">Модератор</option>
          <option value="user">Пользователь</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <LoadingSpinner :text="'Загрузка пользователей...'" />
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

    <!-- Users Table -->
    <div v-else-if="users.length > 0" class="user-table-container">
      <table class="user-table">
        <thead>
          <tr>
            <th @click="sortBy('username')" class="sortable" :class="{ active: sortField === 'username' }">
              Пользователь
              <svg v-if="sortField === 'username'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('email')" class="sortable" :class="{ active: sortField === 'email' }">
              Email
              <svg v-if="sortField === 'email'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('role')" class="sortable" :class="{ active: sortField === 'role' }">
              Роль
              <svg v-if="sortField === 'role'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('is_online')" class="sortable" :class="{ active: sortField === 'is_online' }">
              Статус
              <svg v-if="sortField === 'is_online'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th @click="sortBy('last_login')" class="sortable" :class="{ active: sortField === 'last_login' }">
              Последний вход
              <svg v-if="sortField === 'last_login'" fill="currentColor" viewBox="0 0 20 20" class="sort-icon">
                <path v-if="sortDirection === 'asc'" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
              </svg>
            </th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="user-row">
            <td class="user-info">
              <div class="user-avatar">
                <img
                  v-if="user.avatar"
                  :src="user.avatar"
                  :alt="user.username"
                  class="avatar-img"
                />
                <div v-else class="avatar-placeholder">
                  {{ user.username.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="user-details">
                <div class="username">{{ user.username }}</div>
                <div class="user-id">ID: {{ user.id }}</div>
              </div>
            </td>
            <td class="user-email">{{ user.email }}</td>
            <td>
              <span :class="['role-badge', user.role]">
                {{ getRoleLabel(user.role) }}
              </span>
            </td>
            <td>
              <span :class="['status-badge', { online: user.is_online }]">
                <span class="status-dot" :class="{ online: user.is_online }"></span>
                {{ user.is_online ? 'Онлайн' : 'Офлайн' }}
              </span>
            </td>
            <td class="last-login">
              {{ formatDate(user.last_login) }}
            </td>
            <td class="user-actions">
              <button
                class="btn btn-sm btn-secondary"
                @click="$emit('view-user', user)"
                title="Просмотреть"
              >
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button
                class="btn btn-sm btn-primary"
                @click="$emit('edit-user', user)"
                title="Редактировать"
              >
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
              </button>
              <button
                class="btn btn-sm btn-danger"
                @click="$emit('delete-user', user)"
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
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
      </svg>
      <h3>Пользователи не найдены</h3>
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
  users: {
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
  totalUsers: {
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
  'create-user',
  'view-user',
  'edit-user',
  'delete-user',
  'change-page',
  'search',
  'filter'
])

// Local state
const searchQuery = ref('')
const statusFilter = ref('')
const roleFilter = ref('')
const sortField = ref('username')
const sortDirection = ref('asc')

// Computed
const onlineUsers = computed(() => {
  return props.users.filter(user => user.is_online).length
})

const adminUsers = computed(() => {
  return props.users.filter(user => user.role === 'admin').length
})

// Methods
const handleSearch = () => {
  emit('search', searchQuery.value)
}

const handleFilterChange = () => {
  emit('filter', {
    status: statusFilter.value,
    role: roleFilter.value
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

const getRoleLabel = (role) => {
  const labels = {
    admin: 'Админ',
    moderator: 'Модератор',
    user: 'Пользователь'
  }
  return labels[role] || role
}

const formatDate = (date) => {
  if (!date) return 'Никогда'
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.user-list {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.user-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.user-list-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.user-count {
  color: #6b7280;
  font-size: 14px;
  margin-left: 8px;
}

.user-stats {
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

.stat-icon.online {
  background: #dcfce7;
  color: #16a34a;
}

.stat-icon.admin {
  background: #fef3c7;
  color: #d97706;
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

.user-list-filters {
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

.user-table-container {
  overflow-x: auto;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
}

.user-table th {
  background: #f9fafb;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.user-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.user-table th.sortable:hover {
  background: #f3f4f6;
}

.user-table th.sortable.active {
  background: #e5e7eb;
}

.sort-icon {
  width: 16px;
  height: 16px;
  margin-left: 4px;
}

.user-row {
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}

.user-row:hover {
  background: #f9fafb;
}

.user-table td {
  padding: 16px;
  vertical-align: middle;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.user-details .username {
  font-weight: 500;
  color: #1f2937;
}

.user-id {
  font-size: 12px;
  color: #6b7280;
}

.role-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.role-badge.admin {
  background: #fef3c7;
  color: #d97706;
}

.role-badge.moderator {
  background: #e0e7ff;
  color: #4338ca;
}

.role-badge.user {
  background: #f3f4f6;
  color: #6b7280;
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

.status-badge.online {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge:not(.online) {
  background: #fef2f2;
  color: #dc2626;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.online {
  background: #16a34a;
}

.status-dot:not(.online) {
  background: #dc2626;
}

.last-login {
  color: #6b7280;
  font-size: 14px;
}

.user-actions {
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