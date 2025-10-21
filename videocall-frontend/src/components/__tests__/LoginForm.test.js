/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import LoginForm from '../LoginForm.vue'

// Mock vue-router
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush
  })
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'app.name': 'VideoCall',
        'app.desc': 'Secure video calling platform',
        'login.desc': 'Enter your password to continue',
        'login.password': 'Password',
        'login.enterPassword': 'Enter your password',
        'login.signIn': 'Sign In',
        'login.signingIn': 'Signing In...'
      }
      return translations[key] || key
    }
  })
}))

describe('LoginForm.vue', () => {
  let wrapper
  let mockStore

  const createWrapper = (options = {}) => {
    const defaultOptions = {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              global: {
                isAuthenticated: false,
                user: null,
                error: null
              }
            }
          })
        ]
      },
      ...options
    }

    return mount(LoginForm, defaultOptions)
  }

  beforeEach(() => {
    mockRouterPush.mockClear()
    wrapper = createWrapper()
    mockStore = wrapper.vm.globalStore
  })

  describe('Component Rendering', () => {
    it('renders the login form correctly', () => {
      expect(wrapper.find('.card').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('VideoCall')
      expect(wrapper.find('p').text()).toBe('Enter your password to continue')
      expect(wrapper.find('form').exists()).toBe(true)
    })

    it('displays the password input field', () => {
      const passwordInput = wrapper.find('#password')
      expect(passwordInput.exists()).toBe(true)
      expect(passwordInput.attributes('type')).toBe('password')
      expect(passwordInput.attributes('placeholder')).toBe('Enter your password')
      expect(passwordInput.attributes('required')).toBeDefined()
    })

    it('displays the submit button', () => {
      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.exists()).toBe(true)
      expect(submitButton.text()).toBe('Sign In')
    })

    it('shows the app description', () => {
      const description = wrapper.find('.text-xs')
      expect(description.text()).toBe('Secure video calling platform')
    })
  })

  describe('Form Interactions', () => {
    it('enables password input by default', () => {
      const passwordInput = wrapper.find('#password')
      expect(passwordInput.attributes('disabled')).toBeUndefined()
    })

    it('binds password input to component data', async () => {
      const passwordInput = wrapper.find('#password')
      const testPassword = 'testpassword123'

      await passwordInput.setValue(testPassword)
      expect(wrapper.vm.password).toBe(testPassword)
    })

    it('disables form when loading', async () => {
      await wrapper.setData({ isLoading: true })

      const passwordInput = wrapper.find('#password')
      const submitButton = wrapper.find('button[type="submit"]')

      expect(passwordInput.attributes('disabled')).toBeDefined()
      expect(submitButton.attributes('disabled')).toBeDefined()
      expect(submitButton.text()).toContain('Signing In...')
    })
  })

  describe('Form Validation', () => {
    it('disables submit button when password is empty', async () => {
      const submitButton = wrapper.find('button[type="submit"]')
      await wrapper.setData({ password: '' })

      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('disables submit button when password has only whitespace', async () => {
      const submitButton = wrapper.find('button[type="submit"]')
      await wrapper.setData({ password: '   ' })

      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('enables submit button when password has content', async () => {
      const submitButton = wrapper.find('button[type="submit"]')
      await wrapper.setData({ password: 'validpassword' })

      expect(submitButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Login Functionality', () => {
    beforeEach(() => {
      // Mock successful login
      mockStore.login = vi.fn().mockResolvedValue({
        success: true,
        user: { id: '1', email: 'test@example.com' }
      })
    })

    it('calls store login method when form is submitted', async () => {
      await wrapper.setData({ password: 'testpassword' })

      await wrapper.find('form').trigger('submit.prevent')

      expect(mockStore.login).toHaveBeenCalledWith('testpassword')
      expect(mockStore.login).toHaveBeenCalledTimes(1)
    })

    it('redirects to home page after successful login', async () => {
      await wrapper.setData({ password: 'testpassword' })

      await wrapper.find('form').trigger('submit.prevent')

      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })

    it('redirects to specified redirect URL after successful login', async () => {
      // Mock window.location.search
      Object.defineProperty(window, 'location', {
        value: { search: '?redirect=/admin' },
        writable: true
      })

      await wrapper.setData({ password: 'testpassword' })

      await wrapper.find('form').trigger('submit.prevent')

      expect(mockRouterPush).toHaveBeenCalledWith('/admin')
    })

    it('handles login errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockStore.login = vi.fn().mockRejectedValue(new Error('Login failed'))

      await wrapper.setData({ password: 'wrongpassword' })

      await wrapper.find('form').trigger('submit.prevent')

      expect(consoleSpy).toHaveBeenCalledWith('Login failed:', expect.any(Error))
      expect(wrapper.vm.isLoading).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('Loading States', () => {
    it('shows loading spinner when submitting', async () => {
      // Mock a delayed login response
      mockStore.login = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      await wrapper.setData({ password: 'testpassword' })
      await wrapper.find('form').trigger('submit.prevent')

      // Check loading state is set
      expect(wrapper.vm.isLoading).toBe(true)

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(wrapper.vm.isLoading).toBe(false)
    })

    it('disables form elements during loading', async () => {
      await wrapper.setData({ isLoading: true })

      const passwordInput = wrapper.find('#password')
      const submitButton = wrapper.find('button[type="submit"]')

      expect(passwordInput.attributes('disabled')).toBeDefined()
      expect(submitButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      const label = wrapper.find('label')
      const input = wrapper.find('#password')

      expect(label.exists()).toBe(true)
      expect(label.attributes('for')).toBe('password')
      expect(input.attributes('id')).toBe('password')
    })

    it('has required attribute on password field', () => {
      const passwordInput = wrapper.find('#password')
      expect(passwordInput.attributes('required')).toBeDefined()
    })
  })

  describe('Styling and CSS Classes', () => {
    it('applies correct CSS classes', () => {
      expect(wrapper.classes()).toContain('min-h-screen')
      expect(wrapper.find('.card').exists()).toBe(true)
      expect(wrapper.find('.animate-fade-in').exists()).toBe(true)
    })

    it('has responsive design classes', () => {
      expect(wrapper.classes()).toContain('flex')
      expect(wrapper.classes()).toContain('items-center')
      expect(wrapper.classes()).toContain('justify-center')
    })
  })
})