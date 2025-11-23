import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AdminHeader from '@/admin/components/admin-layout/AdminHeader.vue'

describe('AdminHeader', () => {
  it('эмитит toggle-sidebar при клике по кнопке меню', async () => {
    vi.stubGlobal('$t', (key: string) => key)
    const wrapper = shallowMount(AdminHeader, {
      props: { title: 'Admin', sidebarOpen: false },
      global: {
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
        stubs: { LanguageSwitcher: true },
        mocks: { $t: (key: string) => key },
      },
    })

    // Открыть меню пользователя (кнопка после поиска и уведомлений)
    const buttons = wrapper.findAll('button')
    // Ищем кнопку открытия меню пользователя по порядку и наличию аватара внутри
    const userMenuButton = buttons.find(btn => btn.html().includes('administrator')) || buttons[2]
    await userMenuButton.trigger('click')

    // Найти кнопку logout по тексту (мок $t возвращает ключ)
    const logoutButton = wrapper.findAll('button').find(b => b.text() === 'admin.common.logout')
    expect(logoutButton).toBeTruthy()
    await logoutButton!.trigger('click')

    const emitted = wrapper.emitted('logout')
    expect(emitted).toBeTruthy()
    expect(emitted?.length).toBe(1)
  })
})
