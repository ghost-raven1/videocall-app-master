import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AdminSidebar from '@/admin/components/admin-layout/AdminSidebar.vue'

describe('AdminSidebar', () => {
  it('рендерит 5 пунктов навигации и SVG-иконки', () => {
    vi.stubGlobal('$t', (key: string) => key)
    const wrapper = shallowMount(AdminSidebar, {
      props: { isOpen: true, currentRoute: '' },
      global: {
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
