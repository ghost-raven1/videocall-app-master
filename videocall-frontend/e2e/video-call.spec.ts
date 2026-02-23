import { test, expect, type Page } from '@playwright/test'

async function isBackendReachable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/api/rooms/history/', { timeout: 5000 })
    return !!response && response.status() < 500
  } catch {
    return false
  }
}

async function createRoomAndEnterCall(page: Page): Promise<{ roomId: string }> {
  await page.goto('/')

  await page.getByRole('button', { name: /создать звонок/i }).click()
  await page.waitForURL(/\/call\/[0-9a-f-]+$/i, { timeout: 30000 })

  const callUrl = page.url()
  const roomMatch = callUrl.match(/\/call\/([0-9a-f-]+)$/i)
  if (!roomMatch) {
    throw new Error(`Failed to extract roomId from URL: ${callUrl}`)
  }

  return { roomId: roomMatch[1] }
}

test.describe('Video Call E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await isBackendReachable(page)), 'Backend API unavailable for E2E video call tests')
  })

  test('should create a new room and navigate to call page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /создать звонок/i }).click()
    await page.waitForURL(/\/call\/[0-9a-f-]+$/i, { timeout: 30000 })
  })

  test('should open and close chat panel in call', async ({ page }) => {
    await createRoomAndEnterCall(page)

    const chatButton = page.locator('[data-test="toggle-chat-button"]')
    await expect(chatButton).toBeVisible({ timeout: 15000 })

    await chatButton.click()
    const chatHeader = page.getByRole('heading', { name: /chat/i }).first()
    await expect(chatHeader).toBeVisible({ timeout: 5000 })

    await page.locator('button[aria-label="Close chat"]').click()
    await expect(chatHeader).not.toBeVisible({ timeout: 5000 })
  })

  test('should send chat message from call chat', async ({ page }) => {
    await createRoomAndEnterCall(page)

    await page.locator('[data-test="toggle-chat-button"]').click()

    const textarea = page.locator('textarea[placeholder*="Type a message"]').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('E2E message')

    const sendButton = page.locator('button[aria-label="Send message"]').first()
    await sendButton.click()

    await expect(page.getByText('E2E message')).toBeVisible({ timeout: 10000 })
  })

  test('should select file in chat composer', async ({ page }) => {
    await createRoomAndEnterCall(page)

    await page.locator('[data-test="toggle-chat-button"]').click()

    const fileInput = page.locator('input[type="file"][aria-label="Attach file"]').first()
    await fileInput.setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    })

    await expect
      .poll(async () => fileInput.evaluate((el: HTMLInputElement) => el.files?.[0]?.name || ''))
      .toBe('note.txt')

    await page.locator('button[aria-label="Send message"]').first().click()
    await expect(page.getByText('note.txt')).toBeVisible({ timeout: 10000 })
  })

  test('should toggle microphone and camera buttons in call controls', async ({ page }) => {
    await createRoomAndEnterCall(page)

    const audioButton = page.locator('[data-test="toggle-audio-button"]').first()
    const videoButton = page.locator('[data-test="toggle-video-button"]').first()

    await expect(audioButton).toBeVisible({ timeout: 10000 })
    await expect(videoButton).toBeVisible({ timeout: 10000 })

    const audioBefore = await audioButton.getAttribute('aria-pressed')
    await audioButton.click()
    const audioUnavailableBanner = page.getByText(/audio and video unavailable/i)
    const mediaUnavailable = await audioUnavailableBanner.isVisible().catch(() => false)

    const videoBefore = await videoButton.getAttribute('aria-pressed')
    await videoButton.click()

    if (mediaUnavailable) {
      await expect(audioUnavailableBanner).toBeVisible()
      await expect(audioButton).toHaveAttribute('aria-pressed', /^(true|false)$/)
      await expect(videoButton).toHaveAttribute('aria-pressed', /^(true|false)$/)
      return
    }

    await expect(audioButton).toHaveAttribute('aria-pressed', audioBefore === 'true' ? 'false' : 'true')
    await expect(videoButton).toHaveAttribute('aria-pressed', videoBefore === 'true' ? 'false' : 'true')
  })
})
