import { test, expect, type Page } from '@playwright/test'

async function isBackendReachable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/api/rooms/history/', { timeout: 5000 })
    return !!response && response.status() < 500
  } catch {
    return false
  }
}

async function createRoomAndGetRoomId(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: /создать звонок/i }).click()
  await page.waitForURL(/\/call\/[0-9a-f-]+$/i, { timeout: 30000 })

  const callUrl = page.url()
  const match = callUrl.match(/\/call\/([0-9a-f-]+)$/i)
  if (!match) {
    throw new Error(`Failed to extract room ID from URL: ${callUrl}`)
  }

  return match[1]
}

async function joinCallByRoomId(page: Page, roomId: string): Promise<void> {
  await page.goto(`/call/${roomId}`)
  await page.waitForURL(/\/call\/[0-9a-f-]+$/i, { timeout: 30000 })
}

test.describe('Multi-User Video Call E2E Tests', () => {
  test('should allow two participants to join the same room', async ({ browser }) => {
    const probeContext = await browser.newContext()
    const probePage = await probeContext.newPage()
    const backendReady = await isBackendReachable(probePage)
    await probeContext.close()
    test.skip(!backendReady, 'Backend API unavailable for multi-user E2E tests')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      const roomId = await createRoomAndGetRoomId(page1)

      await joinCallByRoomId(page1, roomId)
      await joinCallByRoomId(page2, roomId)

      await expect(page1.locator('[data-test="participants-button"]')).toBeVisible({ timeout: 10000 })
      await expect(page2.locator('[data-test="participants-button"]')).toBeVisible({ timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('should handle participant leaving the call', async ({ browser }) => {
    const probeContext = await browser.newContext()
    const probePage = await probeContext.newPage()
    const backendReady = await isBackendReachable(probePage)
    await probeContext.close()
    test.skip(!backendReady, 'Backend API unavailable for multi-user E2E tests')

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      const roomId = await createRoomAndGetRoomId(page1)

      await joinCallByRoomId(page1, roomId)
      await joinCallByRoomId(page2, roomId)

      page2.on('dialog', async dialog => {
        await dialog.accept()
      })

      await page2.locator('[data-test="end-call-button"]').first().click()
      await page2.waitForURL(/\/$/, { timeout: 15000 })
      expect(page2.url().endsWith('/')).toBe(true)

      await expect(page1.locator('[data-test="participants-button"]')).toBeVisible({ timeout: 10000 })
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})
