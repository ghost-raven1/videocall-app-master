import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AdminLayout from '@/admin/components/admin-layout/AdminLayout.vue'

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
// Cast to any to satisfy TS in test context
;(vi as unknown as any).mock('@/stores/global', () => ({
  useGlobalStore: () => ({ logout }),
}))

// Provide global $t for script-setup direct usage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).$t = (k: string) => k

describe('AdminLayout.vue', () => {
  it('переключает сайдбар и закрывает по overlay', async () => {
    const originalWidth = window.innerWidth
    // Ensure mobile viewport so sidebar is closed initially
    ;(window as any).innerWidth = 800
    const wrapper = shallowMount(AdminLayout, {
      global: {
        stubs: { LanguageSwitcher: true, RouterView: true },
        mocks: { $t: (k: string) => k },
      },
    })

    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)
    // Открываем сайдбар через событие от заголовка
    const header = wrapper.findComponent({ name: 'AdminHeader' })
    header.vm.$emit('toggle-sidebar')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.mobile-overlay').exists()).toBe(true)

    await wrapper.find('.mobile-overlay').trigger('click')
    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)

    // Restore viewport
    ;(window as any).innerWidth = originalWidth
  })

  it('навигирует и закрывает сайдбар', async () => {
    push.mockReset()
    const originalWidth = window.innerWidth
    ;(window as any).innerWidth = 800
    const wrapper = shallowMount(AdminLayout, {
      global: {
        stubs: { LanguageSwitcher: true, RouterView: true },
        mocks: { $t: (k: string) => k },
      },
    })

    // Открываем сайдбар через событие заголовка
    wrapper.findComponent({ name: 'AdminHeader' }).vm.$emit('toggle-sidebar')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.mobile-overlay').exists()).toBe(true)

    // Эмитим событие навигации от сайдбара
    const sidebar = wrapper.findComponent({ name: 'AdminSidebar' })
    sidebar.vm.$emit('navigate', 'AdminRooms')
    await wrapper.vm.$nextTick()

    expect(push).toHaveBeenCalledWith({ name: 'AdminRooms' })
    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)

    ;(window as any).innerWidth = originalWidth
  })

  it('выполняет logout и редиректит на /login', async () => {
    push.mockReset()
    logout.mockReset()

    const originalWidth = window.innerWidth
    ;(window as any).innerWidth = 800
    const wrapper = shallowMount(AdminLayout, {
      global: {
        stubs: { LanguageSwitcher: true, RouterView: true },
        mocks: { $t: (k: string) => k },
      },
    })

    // Эмитим logout от заголовка
    const header = wrapper.findComponent({ name: 'AdminHeader' })
    header.vm.$emit('logout')
    await wrapper.vm.$nextTick()

    expect(logout).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/login')

    ;(window as any).innerWidth = originalWidth
  })
})
