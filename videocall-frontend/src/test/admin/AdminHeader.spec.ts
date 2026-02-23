import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminHeader from '@/admin/components/admin-layout/AdminHeader.vue'
import { useGlobalStore } from '@/stores/global'

describe('AdminHeader', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const globalStore = useGlobalStore()
    globalStore.user = { email: 'administrator@example.com' } as any
  })

  it('эмитит toggle-sidebar при клике по кнопке меню', async () => {
    vi.stubGlobal('$t', (key: string) => key)
    const wrapper = shallowMount(AdminHeader, {
      props: { title: 'Admin', sidebarOpen: false },
      global: {
        plugins: [pinia],
        stubs: { LanguageSwitcher: true },
        mocks: { $t: (key: string) => key },
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)

    await buttons[0].trigger('click')

    const emitted = wrapper.emitted('toggle-sidebar')
    expect(emitted).toBeTruthy()
    expect(emitted?.length).toBe(1)
  })

  it('эмитит logout при выборе пункта выхода из меню пользователя', async () => {
    vi.stubGlobal('$t', (key: string) => key)
    const wrapper = shallowMount(AdminHeader, {
      props: { title: 'Admin', sidebarOpen: false },
      global: {
        plugins: [pinia],
        stubs: { LanguageSwitcher: true },
        mocks: { $t: (key: string) => key },
      },
    })

    const buttons = wrapper.findAll('button')
    const userMenuButton =
      buttons.find((btn) => btn.text().includes('admin.common.administrator')) ||
      buttons[buttons.length - 1]
    expect(userMenuButton).toBeTruthy()
    await userMenuButton.trigger('click')

    const logoutButton = wrapper.findAll('button').find((b) => b.text().includes('admin.common.logout'))
    expect(logoutButton).toBeTruthy()
    await logoutButton!.trigger('click')

    const emitted = wrapper.emitted('logout')
    expect(emitted).toBeTruthy()
    expect(emitted?.length).toBe(1)
  })
})
