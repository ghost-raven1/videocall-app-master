// src/admin/views/AdminUsers.vue - Admin users management page
<template>
  <div class="admin-users space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-warp-text">Управление пользователями</h2>
      <div class="flex space-x-3">
        <button
          @click="showCreateModal = true"
          class="btn-primary"
        >
          Добавить пользователя
        </button>
        <button
          @click="exportUsers"
          class="btn-secondary"
          :disabled="selectedUsers.length === 0"
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
            placeholder="Поиск по email, имени..."
            class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-warp-muted mb-2">
            Роль
          </label>
          <select
            v-model="filters.role"
            @change="loadUsers"
            class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
          >
            <option value="">Все роли</option>
            <option value="admin">Администраторы</option>
            <option value="moderator">Модераторы</option>
            <option value="user">Пользователи</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-warp-muted mb-2">
            Статус
          </label>
          <select
            v-model="filters.status"
            @change="loadUsers"
            class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
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
    <div v-if="selectedUsers.length > 0" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-blue-800 dark:text-blue-200">
          Выбрано пользователей: {{ selectedUsers.length }}
        </span>
        <div class="flex space-x-2">
          <button
            @click="bulkActivateUsers"
            class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Активировать
          </button>
          <button
            @click="bulkDeactivateUsers"
            class="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
          >
            Деактивировать
          </button>
          <button
            @click="bulkDeleteUsers"
            class="px-3 py-1 bg-red-800 text-white text-sm rounded hover:bg-red-900"
          >
            Удалить
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

    <!-- Users Table -->
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
                Пользователь
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Роль
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Статус
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Последний вход
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-warp-muted uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-warp-surface divide-y divide-warp-border/60">
            <tr v-for="user in users" :key="user.id" class="hover:bg-warp-surfaceAlt">
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  :value="user.id"
                  v-model="selectedUsers"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-full bg-warp-surfaceAlt flex items-center justify-center">
                      <span class="text-sm font-medium text-warp-muted">
                        {{ getInitials(user) }}
                      </span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-warp-text">
                      {{ user.email }}
                    </div>
                    <div class="text-sm text-warp-muted">
                      ID: {{ user.id }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                  user.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                  user.role === 'moderator' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                  'bg-warp-surfaceAlt text-warp-muted border border-warp-border/60'
                ]">
                  {{ user.role === 'admin' ? 'Администратор' : user.role === 'moderator' ? 'Модератор' : 'Пользователь' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                  user.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                  'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                ]">
                  {{ user.is_active ? 'Активен' : 'Неактивен' }}
                </span>
                <span v-if="user.is_online" class="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  Онлайн
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-warp-muted">
                {{ formatDate(user.last_login) || 'Никогда' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <button
                    @click="viewUserDetails(user)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Просмотр
                  </button>
                  <button
                    @click="editUser(user)"
                    class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Редактировать
                  </button>
                  <button
                    v-if="user.is_active"
                    @click="toggleUserStatus(user)"
                    class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                  >
                    Деактивировать
                  </button>
                  <button
                    v-else
                    @click="toggleUserStatus(user)"
                    class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                  >
                    Активировать
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

    <!-- Create/Edit User Modal -->
    <div v-if="showCreateModal || showEditModal" class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 w-96 card">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-warp-text mb-4">
            {{ editingUser ? 'Редактировать пользователя' : 'Создать нового пользователя' }}
          </h3>
          <form @submit.prevent="saveUser">
            <div class="mb-4">
              <label class="block text-sm font-medium text-warp-muted mb-2">
                Email *
              </label>
              <input
                v-model="userForm.email"
                type="email"
                required
                :disabled="editingUser"
                class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent disabled:opacity-50"
                placeholder="user@example.com"
              />
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-warp-muted mb-2">
                Роль
              </label>
              <select
                v-model="userForm.role"
                class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
              >
                <option value="user">Пользователь</option>
                <option value="moderator">Модератор</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
            <div v-if="!editingUser" class="mb-4">
              <label class="block text-sm font-medium text-warp-muted mb-2">
                Пароль *
              </label>
              <input
                v-model="userForm.password"
                type="password"
                required
                class="w-full px-3 py-2 rounded-lg border border-warp-border bg-warp-surfaceAlt text-warp-text focus:ring-2 focus:ring-warp-accent focus:border-warp-accent"
                placeholder="Введите пароль"
              />
            </div>
            <div class="mb-4">
              <label class="flex items-center">
                <input
                  v-model="userForm.is_active"
                  type="checkbox"
                  class="rounded border-warp-border text-warp-accent focus:ring-warp-accent"
                />
                <span class="ml-2 text-sm text-warp-muted">
                  Активный пользователь
                </span>
              </label>
            </div>
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                @click="closeUserModal"
                class="btn-secondary px-4 py-2"
              >
                Отмена
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="btn-primary px-4 py-2 disabled:opacity-50"
              >
                {{ saving ? 'Сохранение...' : editingUser ? 'Сохранить' : 'Создать' }}
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
const saving = ref(false)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const selectedUsers = ref([])
const currentPage = ref(1)
const perPage = ref(20)
const total = ref(0)
const totalPages = ref(0)
const editingUser = ref(null)

const users = ref([])

const filters = reactive({
  search: '',
  role: '',
  status: ''
})

const userForm = reactive({
  email: '',
  role: 'user',
  password: '',
  is_active: true
})

// Computed
const selectAll = computed({
  get: () => selectedUsers.value.length === users.value.length && users.value.length > 0,
  set: (value) => {
    if (value) {
      selectedUsers.value = users.value.map(user => user.id)
    } else {
      selectedUsers.value = []
    }
  }
})

// Methods
const loadUsers = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: perPage.value,
      search: filters.search,
      role: filters.role,
      status: filters.status
    }

    await adminStore.loadUsers(params)
    users.value = adminStore.userManagement.users || []
    total.value = adminStore.userManagement.total || 0
    totalPages.value = Math.ceil(total.value / perPage.value)
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    loading.value = false
  }
}

const saveUser = async () => {
  saving.value = true
  try {
    if (editingUser.value) {
      await adminStore.updateUser(editingUser.value.id, userForm)
    } else {
      await adminStore.createUser(userForm)
    }

    closeUserModal()
    resetUserForm()
    await loadUsers()
  } catch (error) {
    console.error('Failed to save user:', error)
  } finally {
    saving.value = false
  }
}

const viewUserDetails = (user) => {
  // Navigate to user details or show modal
  console.log('View user details:', user)
}

const editUser = (user) => {
  editingUser.value = user
  userForm.email = user.email
  userForm.role = user.role
  userForm.is_active = user.is_active
  showEditModal.value = true
}

const toggleUserStatus = async (user) => {
  try {
    if (user.is_active) {
      await adminStore.updateUser(user.id, { is_active: false })
    } else {
      await adminStore.updateUser(user.id, { is_active: true })
    }
    await loadUsers()
  } catch (error) {
    console.error('Failed to toggle user status:', error)
  }
}

const bulkActivateUsers = async () => {
  if (confirm(`Вы уверены, что хотите активировать ${selectedUsers.value.length} пользователей?`)) {
    try {
      await adminStore.bulkUpdateUsers(selectedUsers.value, 'activate')
      selectedUsers.value = []
      await loadUsers()
    } catch (error) {
      console.error('Failed to bulk activate users:', error)
    }
  }
}

const bulkDeactivateUsers = async () => {
  if (confirm(`Вы уверены, что хотите деактивировать ${selectedUsers.value.length} пользователей?`)) {
    try {
      await adminStore.bulkUpdateUsers(selectedUsers.value, 'deactivate')
      selectedUsers.value = []
      await loadUsers()
    } catch (error) {
      console.error('Failed to bulk deactivate users:', error)
    }
  }
}

const bulkDeleteUsers = async () => {
  if (confirm(`Вы уверены, что хотите удалить ${selectedUsers.value.length} пользователей?`)) {
    try {
      await adminStore.bulkUpdateUsers(selectedUsers.value, 'delete')
      selectedUsers.value = []
      await loadUsers()
    } catch (error) {
      console.error('Failed to bulk delete users:', error)
    }
  }
}

const exportUsers = () => {
  // Export selected or all users to CSV
  const dataToExport = selectedUsers.value.length > 0
    ? users.value.filter(user => selectedUsers.value.includes(user.id))
    : users.value

  const csvContent = convertToCSV(dataToExport)
  downloadCSV(csvContent, 'users_export.csv')
}

const convertToCSV = (data) => {
  const headers = ['ID', 'Email', 'Роль', 'Статус', 'Последний вход', 'Создан']
  const rows = data.map(user => [
    user.id,
    user.email,
    user.role,
    user.is_active ? 'Активен' : 'Неактивен',
    formatDate(user.last_login) || 'Никогда',
    formatDate(user.created_at)
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

const getInitials = (user) => {
  return user.email.substring(0, 2).toUpperCase()
}

const formatDate = (dateString) => {
  if (!dateString) return null
  return new Date(dateString).toLocaleString('ru-RU')
}

const debounceSearch = debounce(() => {
  currentPage.value = 1
  loadUsers()
}, 500)

const resetFilters = () => {
  filters.search = ''
  filters.role = ''
  filters.status = ''
  currentPage.value = 1
  loadUsers()
}

const resetUserForm = () => {
  userForm.email = ''
  userForm.role = 'user'
  userForm.password = ''
  userForm.is_active = true
  editingUser.value = null
}

const closeUserModal = () => {
  showCreateModal.value = false
  showEditModal.value = false
  editingUser.value = null
  resetUserForm()
}

const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedUsers.value = []
  } else {
    selectedUsers.value = users.value.map(user => user.id)
  }
}

const clearSelection = () => {
  selectedUsers.value = []
}

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadUsers()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadUsers()
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
  loadUsers()
})
</script>