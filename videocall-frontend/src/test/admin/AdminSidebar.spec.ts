import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminSidebar from '@/admin/components/admin-layout/AdminSidebar.vue'
import { useGlobalStore } from '@/stores/global'

describe('AdminSidebar', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const globalStore = useGlobalStore()
    globalStore.user = { email: 'administrator@example.com' } as any
  })

  it('рендерит 5 пунктов навигации и SVG-иконки', () => {
    vi.stubGlobal('$t', (key: string) => key)
    const wrapper = shallowMount(AdminSidebar, {
      props: { isOpen: true, currentRoute: '' },
      global: {
        plugins: [pinia],
        mocks: { $t: (key: string) => key },
      },
    })

    const items = wrapper.findAll('.nav-item')
    expect(items.length).toBe(5)

    // Иконки рендерятся как динамический компонент с классами .w-5.h-5
    const icons = wrapper.findAll('.nav-item .w-5.h-5')
    expect(icons.length).toBe(5)
  })

  it('эмитит navigate при клике по пункту', async () => {
    vi.stubGlobal('$t', (key: string) => key)
    const wrapper = shallowMount(AdminSidebar, {
      props: { isOpen: true, currentRoute: '' },
      global: {
        plugins: [pinia],
        mocks: { $t: (key: string) => key },
      },
    })

    const items = wrapper.findAll('.nav-item')
    expect(items.length).toBe(5)

    await items[1].trigger('click') // AdminRooms

    const emitted = wrapper.emitted('navigate')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]).toEqual(['AdminRooms'])
  })
})
