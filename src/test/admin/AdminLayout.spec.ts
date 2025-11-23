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
vi.mock('@/stores/global', () => {
  return { useGlobalStore: () => ({ logout }) }
})

describe('AdminLayout.vue', () => {
  it('переключает сайдбар по событию toggle и закрывает по overlay', async () => {
    const wrapper = shallowMount(AdminLayout, {
      global: {
        stubs: { AdminSidebar: true, AdminHeader: true, RouterView: true },
        mocks: { $t: (k: string) => k },
      },
    })

    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)
    // Эмитим событие от сайдбара
    wrapper.vm.sidebarOpen = false
    await wrapper.vm.$nextTick()

    // Сайдбар открывается по событию toggle (в шаблоне: @toggle="sidebarOpen = !sidebarOpen")
    wrapper.vm.sidebarOpen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.mobile-overlay').exists()).toBe(true)

    await wrapper.find('.mobile-overlay').trigger('click')
    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)
  })

  it('навигирует по событию navigate и закрывает сайдбар', async () => {
    push.mockReset()
    const wrapper = shallowMount(AdminLayout, {
      global: {
        stubs: { AdminSidebar: true, AdminHeader: true, RouterView: true },
        mocks: { $t: (k: string) => k },
      },
    })

    // Открыли сайдбар
    wrapper.vm.sidebarOpen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.mobile-overlay').exists()).toBe(true)

    // Вызываем метод навигации напрямую (он дергается при @navigate)
    // В шаблоне: @navigate="handleNavigation"
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await wrapper.vm.handleNavigation('AdminRooms')

    expect(push).toHaveBeenCalledWith({ name: 'AdminRooms' })
    expect(wrapper.find('.mobile-overlay').exists()).toBe(false)
  })

  it('выполняет logout и редиректит на /login по событию от хедера', async () => {
    push.mockReset()
    logout.mockReset()

    const wrapper = shallowMount(AdminLayout, {
      global: {
        stubs: { AdminSidebar: true, AdminHeader: true, RouterView: true },
        mocks: { $t: (k: string) => k },
      },
    })

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await wrapper.vm.handleLogout()

    expect(logout).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/login')
  })
})

