import { test, expect } from '@playwright/test'

test.describe('Public Access E2E Tests', () => {
  test('renders call actions page for guests', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Видеозвонки в реальном времени' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Создать новый звонок' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Присоединиться к звонку' })).toBeVisible()
  })

  test('redirects /login to public flow when guest access is enabled', async ({ page }) => {
    await page.goto('/login')

    await page.waitForURL(/\/$/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Создать новый звонок' })).toBeVisible()
  })

  test('shows admin login form on /admin/login', async ({ page }) => {
    await page.goto('/admin/login')

    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })
})
