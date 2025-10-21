<template>
  <div class="user-filters">
    <div class="filters-header">
      <h3>Фильтры пользователей</h3>
      <button class="btn btn-secondary btn-sm" @click="resetFilters">
        Сбросить
      </button>
    </div>

    <div class="filters-content">
      <!-- Search Filters -->
      <div class="filter-section">
        <h4>Поиск</h4>
        <div class="form-group">
          <label>Поиск по имени пользователя:</label>
          <input
            type="text"
            v-model="filters.search.username"
            @input="updateFilters"
            placeholder="Введите имя пользователя..."
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label>Поиск по email:</label>
          <input
            type="email"
            v-model="filters.search.email"
            @input="updateFilters"
            placeholder="Введите email..."
            class="form-input"
          />
        </div>
      </div>

      <!-- Status Filters -->
      <div class="filter-section">
        <h4>Статус</h4>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="filters.status.online"
              @change="updateFilters"
            />
            Онлайн
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="filters.status.offline"
              @change="updateFilters"
            />
            Офлайн
          </label>
        </div>
      </div>

      <!-- Role Filters -->
      <div class="filter-section">
        <h4>Роль</h4>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="filters.roles.admin"
              @change="updateFilters"
            />
            Администратор
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="filters.roles.moderator"
              @change="updateFilters"
            />
            Модератор
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="filters.roles.user"
              @change="updateFilters"
            />
            Пользователь
          </label>
        </div>
      </div>

      <!-- Date Filters -->
      <div class="filter-section">
        <h4>Дата регистрации</h4>
        <div class="form-group">
          <label>От:</label>
          <input
            type="date"
            v-model="filters.dateRange.from"
            @change="updateFilters"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>До:</label>
          <input
            type="date"
            v-model="filters.dateRange.to"
            @change="updateFilters"
            class="form-input"
          />
        </div>
      </div>

      <!-- Last Login Filters -->
      <div class="filter-section">
        <h4>Последний вход</h4>
        <div class="form-group">
          <label>От:</label>
          <input
            type="datetime-local"
            v-model="filters.lastLogin.from"
            @change="updateFilters"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>До:</label>
          <input
            type="datetime-local"
            v-model="filters.lastLogin.to"
            @change="updateFilters"
            class="form-input"
          />
        </div>
      </div>

      <!-- Activity Filters -->
      <div class="filter-section">
        <h4>Активность</h4>
        <div class="form-group">
          <label>Минимальное количество входов:</label>
          <input
            type="number"
            v-model.number="filters.activity.minLogins"
            @input="updateFilters"
            min="0"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Минимальное время в системе (часы):</label>
          <input
            type="number"
            v-model.number="filters.activity.minHours"
            @input="updateFilters"
            min="0"
            class="form-input"
          />
        </div>
      </div>
    </div>

    <!-- Active Filters Display -->
    <div v-if="activeFiltersCount > 0" class="active-filters">
      <h4>Активные фильтры ({{ activeFiltersCount }}):</h4>
      <div class="active-filters-list">
        <span
          v-for="filter in activeFilters"
          :key="filter.key"
          class="active-filter-tag"
        >
          {{ filter.label }}
          <button @click="removeFilter(filter.key)" class="remove-filter">
            ×
          </button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'reset'])

// Local filters state
const filters = ref({
  search: {
    username: '',
    email: ''
  },
  status: {
    online: true,
    offline: true
  },
  roles: {
    admin: true,
    moderator: true,
    user: true
  },
  dateRange: {
    from: '',
    to: ''
  },
  lastLogin: {
    from: '',
    to: ''
  },
  activity: {
    minLogins: null,
    minHours: null
  }
})

// Computed
const activeFiltersCount = computed(() => {
  return activeFilters.value.length
})

const activeFilters = computed(() => {
  const active = []

  if (filters.value.search.username) {
    active.push({ key: 'search.username', label: `Имя: ${filters.value.search.username}` })
  }
  if (filters.value.search.email) {
    active.push({ key: 'search.email', label: `Email: ${filters.value.search.email}` })
  }
  if (!filters.value.status.online) {
    active.push({ key: 'status.online', label: 'Скрыть онлайн' })
  }
  if (!filters.value.status.offline) {
    active.push({ key: 'status.offline', label: 'Скрыть офлайн' })
  }
  if (!filters.value.roles.admin) {
    active.push({ key: 'roles.admin', label: 'Скрыть админов' })
  }
  if (!filters.value.roles.moderator) {
    active.push({ key: 'roles.moderator', label: 'Скрыть модераторов' })
  }
  if (!filters.value.roles.user) {
    active.push({ key: 'roles.user', label: 'Скрыть пользователей' })
  }
  if (filters.value.dateRange.from) {
    active.push({ key: 'dateRange.from', label: `От: ${filters.value.dateRange.from}` })
  }
  if (filters.value.dateRange.to) {
    active.push({ key: 'dateRange.to', label: `До: ${filters.value.dateRange.to}` })
  }
  if (filters.value.lastLogin.from) {
    active.push({ key: 'lastLogin.from', label: `Вход от: ${filters.value.lastLogin.from}` })
  }
  if (filters.value.lastLogin.to) {
    active.push({ key: 'lastLogin.to', label: `Вход до: ${filters.value.lastLogin.to}` })
  }
  if (filters.value.activity.minLogins) {
    active.push({ key: 'activity.minLogins', label: `Мин. входов: ${filters.value.activity.minLogins}` })
  }
  if (filters.value.activity.minHours) {
    active.push({ key: 'activity.minHours', label: `Мин. часов: ${filters.value.activity.minHours}` })
  }

  return active
})

// Methods
const updateFilters = () => {
  emit('update:modelValue', { ...filters.value })
}

const resetFilters = () => {
  filters.value = {
    search: {
      username: '',
      email: ''
    },
    status: {
      online: true,
      offline: true
    },
    roles: {
      admin: true,
      moderator: true,
      user: true
    },
    dateRange: {
      from: '',
      to: ''
    },
    lastLogin: {
      from: '',
      to: ''
    },
    activity: {
      minLogins: null,
      minHours: null
    }
  }
  emit('update:modelValue', { ...filters.value })
  emit('reset')
}

const removeFilter = (key) => {
  const keys = key.split('.')
  let target = filters.value

  for (let i = 0; i < keys.length - 1; i++) {
    target = target[keys[i]]
  }

  if (keys.length === 1) {
    target[keys[0]] = keys[0] === 'minLogins' || keys[0] === 'minHours' ? null : ''
  } else {
    target[keys[keys.length - 1]] = keys[keys.length - 1] === 'minLogins' || keys[keys.length - 1] === 'minHours' ? null : ''
  }

  emit('update:modelValue', { ...filters.value })
}

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    filters.value = { ...filters.value, ...newValue }
  }
}, { deep: true })
</script>

<style scoped>
.user-filters {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.filters-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.filters-content {
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.filter-section {
  background: #f9fafb;
  padding: 16px;
  border-radius: 8px;
}

.filter-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.form-group {
  margin-bottom: 12px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
}

.active-filters {
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.active-filters h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.active-filters-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.active-filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #e5e7eb;
  color: #374151;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.remove-filter {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  margin-left: 4px;
  transition: color 0.2s;
}

.remove-filter:hover {
  color: #374151;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}
</style>