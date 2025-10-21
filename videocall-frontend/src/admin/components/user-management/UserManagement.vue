<template>
  <div class="user-management">
    <!-- Header with Actions -->
    <div class="management-header">
      <div class="header-info">
        <h1>Управление пользователями</h1>
        <p>Создание, редактирование и мониторинг пользователей системы</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="exportUsers">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          Экспорт
        </button>
        <button class="btn btn-primary" @click="showCreateUser = true">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"/>
          </svg>
          Создать пользователя
        </button>
      </div>
    </div>

    <!-- Search and Filters Bar -->
    <div class="management-filters">
      <div class="search-section">
        <div class="search-box">
          <svg fill="currentColor" viewBox="0 0 20 20" class="search-icon">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <input
            type="text"
            v-model="searchQuery"
            @input="handleSearch"
            placeholder="Поиск по имени, email или ID..."
            class="search-input"
          />
          <button v-if="searchQuery" class="search-clear" @click="clearSearch">
            ×
          </button>
        </div>
      </div>

      <div class="filter-section">
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

        <button class="btn btn-secondary btn-sm" @click="showFilters = !showFilters">
          <svg fill="currentColor" viewBox="0 0 20 20" class="btn-icon">
            <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 011 1H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 011 1H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
          </svg>
          {{ showFilters ? 'Скрыть фильтры' : 'Показать фильтры' }}
        </button>
      </div>
    </div>

    <!-- Advanced Filters Panel -->
    <div v-if="showFilters" class="advanced-filters">
      <UserFilters
        v-model="advancedFilters"
        @reset="handleFiltersReset"
      />
    </div>

    <!-- Bulk Actions Bar -->
    <div v-if="selectedUsers.length > 0" class="bulk-actions">
      <div class="bulk-info">
        Выбрано {{ selectedUsers.length }} пользователей
      </div>
      <div class="bulk-buttons">
        <button class="btn btn-secondary btn-sm" @click="selectAllUsers">
          Выбрать всех
        </button>
        <button class="btn btn-secondary btn-sm" @click="clearSelection">
          Очистить
        </button>
        <button class="btn btn-warning btn-sm" @click="bulkBlockUsers">
          Заблокировать
        </button>
        <button class="btn btn-danger btn-sm" @click="bulkDeleteUsers">
          Удалить
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="management-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <LoadingSpinner text="Загрузка пользователей..." />
      </div>

      <!-- Error State -->
      <ErrorMessage
        v-else-if="error"
        :title="'Ошибка загрузки пользователей'"
        :message="error"
        type="error"
        dismissible
        @dismiss="error = null"
      />

      <!-- Users List -->
      <div v-else>
        <UserList
          :users="filteredUsers"
          :loading="loading"
          :error="error"
          :total-users="totalUsers"
          :current-page="currentPage"
          :total-pages="totalPages"
          :show-stats="true"
          :show-filters="false"
          @create-user="handleCreateUser"
          @view-user="handleViewUser"
          @edit-user="handleEditUser"
          @delete-user="handleDeleteUser"
          @change-page="handlePageChange"
          @search="handleSearch"
          @filter="handleFilterChange"
          @sort="handleSort"
        />
      </div>
    </div>

    <!-- Modals and Dialogs -->
    <UserEdit
      v-if="showCreateUser || showEditUser"
      :user="editingUser"
      :loading="saving"
      @save="handleSaveUser"
      @cancel="handleCancelEdit"
    />

    <UserActivity
      v-if="showUserActivity"
      :user="viewingUser"
      @close="showUserActivity = false"
    />

    <ConfirmDialog
      v-if="showDeleteConfirm"
      :show="showDeleteConfirm"
      title="Удаление пользователя"
      :message="`Вы уверены, что хотите удалить пользователя '${deletingUser?.username}'? Это действие нельзя отменить.`"
      type="danger"
      confirm-text="Удалить"
      cancel-text="Отмена"
      :loading="deleting"
      @confirm="confirmDeleteUser"
      @cancel="cancelDeleteUser"
    />

    <ConfirmDialog
      v-if="showBulkDeleteConfirm"
      :show="showBulkDeleteConfirm"
      title="Массовое удаление пользователей"
      :message="`Вы уверены, что хотите удалить ${selectedUsers.length} пользователей? Это действие нельзя отменить.`"
      type="danger"
      confirm-text="Удалить всех"
      cancel-text="Отмена"
      :loading="bulkDeleting"
      @confirm="confirmBulkDeleteUsers"
      @cancel="cancelBulkDeleteUsers"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'
import ErrorMessage from '../ui/ErrorMessage.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import UserList from './UserList.vue'
import UserEdit from './UserEdit.vue'
import UserFilters from './UserFilters.vue'
import UserActivity from './UserActivity.vue'

// Component state
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref(null)

// Modal states
const showCreateUser = ref(false)
const showEditUser = ref(false)
const showUserActivity = ref(false)
const showDeleteConfirm = ref(false)
const showBulkDeleteConfirm = ref(false)

// Filter states
const searchQuery = ref('')
const statusFilter = ref('')
const roleFilter = ref('')
const showFilters = ref(false)
const advancedFilters = ref({})

// Selection state
const selectedUsers = ref([])
const allSelected = ref(false)

// Current user actions
const editingUser = ref(null)
const viewingUser = ref(null)
const deletingUser = ref(null)

// Data
const users = ref([])
const totalUsers = ref(0)
const currentPage = ref(1)
const totalPages = ref(1)
const sortField = ref('username')
const sortDirection = ref('asc')

// Computed
const filteredUsers = computed(() => {
  let filtered = [...users.value]

  // Apply search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.id.toString().includes(query)
    )
  }

  // Apply status filter
  if (statusFilter.value) {
    filtered = filtered.filter(user =>
      statusFilter.value === 'online' ? user.is_online : !user.is_online
    )
  }

  // Apply role filter
  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role === roleFilter.value)
  }

  return filtered
})

// Methods
const loadUsers = async (page = 1) => {
  loading.value = true
  error.value = null

  try {
    // Mock API call - in real app this would be an actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Mock data
    const mockUsers = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      username: `user${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: i === 0 ? 'admin' : ['user', 'moderator'][Math.floor(Math.random() * 2)],
      is_online: Math.random() > 0.3,
      last_login: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      avatar: null,
      first_name: `Имя${i + 1}`,
      last_name: `Фамилия${i + 1}`,
      is_active: Math.random() > 0.1,
      is_staff: i === 0
    }))

    users.value = mockUsers.slice((page - 1) * 20, page * 20)
    totalUsers.value = mockUsers.length
    totalPages.value = Math.ceil(mockUsers.length / 20)
    currentPage.value = page

  } catch (err) {
    error.value = 'Не удалось загрузить пользователей'
    console.error('Failed to load users:', err)
  } finally {
    loading.value = false
  }
}

const handleSearch = (query) => {
  searchQuery.value = query
  currentPage.value = 1
  // In real app, this would trigger a new API call with search params
}

const handleFilterChange = (filters) => {
  if (filters.status !== undefined) {
    statusFilter.value = filters.status
  }
  if (filters.role !== undefined) {
    roleFilter.value = filters.role
  }
  currentPage.value = 1
}

const handleSort = (sort) => {
  sortField.value = sort.field
  sortDirection.value = sort.direction
  // In real app, this would trigger a new API call with sort params
}

const handlePageChange = (page) => {
  loadUsers(page)
}

const handleCreateUser = () => {
  editingUser.value = null
  showCreateUser.value = true
}

const handleEditUser = (user) => {
  editingUser.value = user
  showEditUser.value = true
}

const handleViewUser = (user) => {
  viewingUser.value = user
  showUserActivity.value = true
}

const handleDeleteUser = (user) => {
  deletingUser.value = user
  showDeleteConfirm.value = true
}

const handleSaveUser = async (userData) => {
  saving.value = true

  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (editingUser.value) {
      // Update existing user
      const index = users.value.findIndex(u => u.id === editingUser.value.id)
      if (index > -1) {
        users.value[index] = { ...users.value[index], ...userData }
      }
    } else {
      // Create new user
      const newUser = {
        id: Date.now(),
        ...userData,
        created_at: new Date(),
        last_login: null,
        is_online: false
      }
      users.value.unshift(newUser)
      totalUsers.value += 1
    }

    showCreateUser.value = false
    showEditUser.value = false
    editingUser.value = null

  } catch (err) {
    error.value = 'Не удалось сохранить пользователя'
    console.error('Failed to save user:', err)
  } finally {
    saving.value = false
  }
}

const handleCancelEdit = () => {
  showCreateUser.value = false
  showEditUser.value = false
  editingUser.value = null
}

const confirmDeleteUser = async () => {
  deleting.value = true

  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500))

    // Remove user from list
    const index = users.value.findIndex(u => u.id === deletingUser.value.id)
    if (index > -1) {
      users.value.splice(index, 1)
      totalUsers.value -= 1
    }

    showDeleteConfirm.value = false
    deletingUser.value = null

  } catch (err) {
    error.value = 'Не удалось удалить пользователя'
    console.error('Failed to delete user:', err)
  } finally {
    deleting.value = false
  }
}

const cancelDeleteUser = () => {
  showDeleteConfirm.value = false
  deletingUser.value = null
}

const clearSearch = () => {
  searchQuery.value = ''
  handleSearch('')
}

const handleFiltersReset = () => {
  statusFilter.value = ''
  roleFilter.value = ''
  advancedFilters.value = {}
}

const selectAllUsers = () => {
  selectedUsers.value = [...users.value.map(u => u.id)]
  allSelected.value = true
}

const clearSelection = () => {
  selectedUsers.value = []
  allSelected.value = false
}

const bulkBlockUsers = () => {
  // Implementation for bulk blocking users
  console.log('Bulk blocking users:', selectedUsers.value)
}

const bulkDeleteUsers = () => {
  showBulkDeleteConfirm.value = true
}

const confirmBulkDeleteUsers = async () => {
  const bulkDeleting = ref(true)

  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Remove selected users
    users.value = users.value.filter(u => !selectedUsers.value.includes(u.id))
    totalUsers.value -= selectedUsers.value.length

    selectedUsers.value = []
    showBulkDeleteConfirm.value = false

  } catch (err) {
    error.value = 'Не удалось удалить пользователей'
    console.error('Failed to bulk delete users:', err)
  } finally {
    bulkDeleting.value = false
  }
}

const cancelBulkDeleteUsers = () => {
  showBulkDeleteConfirm.value = false
}

const exportUsers = () => {
  // Implementation for exporting users data
  const dataStr = JSON.stringify(filteredUsers.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `users_export_${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// Initialize
onMounted(() => {
  loadUsers()
})

// Watch for filter changes
watch([statusFilter, roleFilter], () => {
  // Reset to first page when filters change
  if (currentPage.value !== 1) {
    currentPage.value = 1
  }
})
</script>

<style scoped>
.user-management {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  gap: 24px;
}

.header-info h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
}

.header-info p {
  margin: 0;
  color: #6b7280;
  font-size: 16px;
}

.management-filters {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  align-items: center;
}

.search-section {
  flex: 1;
  min-width: 300px;
}

.search-box {
  position: relative;
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
  padding: 12px 16px 12px 44px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.search-clear {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: color 0.2s;
}

.search-clear:hover {
  color: #374151;
}

.filter-section {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-select {
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  min-width: 140px;
}

.filter-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.advanced-filters {
  margin-bottom: 24px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  margin-bottom: 24px;
}

.bulk-info {
  font-weight: 500;
  color: #92400e;
}

.bulk-buttons {
  display: flex;
  gap: 8px;
}

.management-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.loading-container {
  padding: 60px;
  text-align: center;
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.btn-sm {
  padding: 8px 12px;
  font-size: 12px;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* Responsive */
@media (max-width: 768px) {
  .user-management {
    padding: 16px;
  }

  .management-header {
    flex-direction: column;
    align-items: stretch;
  }

  .management-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-section {
    justify-content: space-between;
  }

  .bulk-actions {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .bulk-buttons {
    justify-content: center;
  }
}
</style>