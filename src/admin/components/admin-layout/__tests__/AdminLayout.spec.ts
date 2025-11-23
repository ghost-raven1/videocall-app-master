import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AdminLayout from '../AdminLayout.vue'

// Mock router composables used by the component
const push = vi.fn()
vi.mock('vue-router', () => {
  return {
    useRouter: () => ({ push }),
    useRoute: () => ({ name: 'AdminDashboard' }),
  }
})

// Mock global store used for logout
const logout = vi.fn(async () => {})
vi.mock('@/stores/global', () => {
  return { useGlobalStore: () => ({ logout }) }
})

describe('AdminLayout.vue', () => {
  it('рендерит и переключает сайдбар по событию toggle', async () => {
    const wrapper = shallowMount(AdminLayout, {
      global: {
        mocks: { $t: (k: string) => k },
      },
    })

    // Initially overlay not visible
    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)

    // Emit toggle from sidebar stub
    wrapper.findComponent({ name: 'AdminSidebar' }).vm.$emit('toggle')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.mobile-overlay').exists()).toBe(true)

    // Click overlay closes sidebar
    await wrapper.find('.mobile-overlay').trigger('click')
    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)
  })

  it('навигирует по событию navigate и закрывает сайдбар', async () => {
    push.mockReset()
    const wrapper = shallowMount(AdminLayout, {
      global: {
        mocks: { $t: (k: string) => k },
      },
    })

    // Open sidebar first
    wrapper.findComponent({ name: 'AdminSidebar' }).vm.$emit('toggle')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.mobile-overlay').exists()).toBe(true)

    // Navigate to AdminRooms
    wrapper.findComponent({ name: 'AdminSidebar' }).vm.$emit('navigate', 'AdminRooms')
    await wrapper.vm.$nextTick()

    expect(push).toHaveBeenCalledWith({ name: 'AdminRooms' })
    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)
  })

  it('выполняет logout и редиректит на /login по событию от хедера', async () => {
    push.mockReset()
    logout.mockReset()

    const wrapper = shallowMount(AdminLayout, {
      global: {
        mocks: { $t: (k: string) => k },
      },
    })

    // Emit logout from header stub
    wrapper.findComponent({ name: 'AdminHeader' }).vm.$emit('logout')
    await wrapper.vm.$nextTick()

    expect(logout).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/login')
  })
})

