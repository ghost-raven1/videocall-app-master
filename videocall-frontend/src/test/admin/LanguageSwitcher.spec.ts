import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LanguageSwitcher from '@/admin/components/admin-layout/LanguageSwitcher.vue'

describe('LanguageSwitcher.vue', () => {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {}, ru: {} } })

  it('открывает и закрывает меню языков', async () => {
    const wrapper = mount(LanguageSwitcher, {
      global: { plugins: [i18n], mocks: { $t: (k: string) => k } },
    })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)

    await wrapper.find('.fixed.inset-0').trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('переключает язык, диспатчит событие и сохраняет в localStorage', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')

    const wrapper = mount(LanguageSwitcher, {
      global: { plugins: [i18n], mocks: { $t: (k: string) => k } },
    })

    await wrapper.find('button').trigger('click')
    const ruOption = wrapper.findAll('[role="menuitem"]').find(el => el.text().includes('Русский'))
    expect(ruOption).toBeTruthy()
    await ruOption!.trigger('click')

    const globalAny: any = i18n.global
    const localeValue = typeof globalAny.locale === 'string' ? globalAny.locale : globalAny.locale?.value
    expect(localeValue).toBe('ru')

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    expect(dispatchSpy).toHaveBeenCalled()
    const evt = dispatchSpy.mock.calls.find(call => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === 'language-changed')
    expect(evt).toBeTruthy()
    const custom = evt![0] as CustomEvent
    expect((custom.detail as any).language).toBe('ru')

    expect(setItemSpy).toHaveBeenCalledWith('preferred-language', 'ru')

    dispatchSpy.mockRestore()
    setItemSpy.mockRestore()
  })
})

