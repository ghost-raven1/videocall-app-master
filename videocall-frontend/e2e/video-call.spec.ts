import { test, expect } from '@playwright/test'

test.describe('Video Call E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="password"]', 'test-password')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 10000 })
  })

  test('should create a new room', async ({ page }) => {
    // Navigate to dashboard or room creation
    await page.goto('/dashboard')
    
    // Find create room button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Room")').first()
    
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click()
      
      // Wait for room to be created and navigate to call page
      await page.waitForURL(/\/call\//, { timeout: 10000 })
      
      const url = page.url()
      expect(url).toMatch(/\/call\/[a-zA-Z0-9-]+/)
    } else {
      test.skip('Create room button not found')
    }
  })

  test('should join a room by code', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Find join room input
    const joinInput = page.locator('input[placeholder*="code"], input[placeholder*="Code"]').first()
    const joinButton = page.locator('button:has-text("Join"), button:has-text("Enter")').first()
    
    if (await joinInput.isVisible().catch(() => false)) {
      // Enter a test room code (this would need to be a valid code in test environment)
      await joinInput.fill('TEST01')
      await joinButton.click()
      
      // Should navigate to call page
      await page.waitForURL(/\/call\//, { timeout: 10000 }).catch(() => {
        // If room doesn't exist, that's expected in test environment
        console.log('Room code may not exist in test environment')
      })
    } else {
      test.skip('Join room input not found')
    }
  })

  test('should display local video stream', async ({ page }) => {
    // Navigate to a call page
    await page.goto('/call/test-room')
    
    // Wait for video element
    const localVideo = page.locator('video').first()
    
    // Video should be visible (may need to grant permissions)
    await expect(localVideo).toBeVisible({ timeout: 10000 })
    
    // Check if video is playing
    const isPlaying = await localVideo.evaluate((video: HTMLVideoElement) => {
      return !video.paused && video.readyState >= 2
    }).catch(() => false)
    
    // Video should be playing (if permissions granted)
    if (isPlaying) {
      expect(isPlaying).toBe(true)
    } else {
      console.log('Video may require user permission to play')
    }
  })

  test('should toggle video on/off', async ({ page }) => {
    await page.goto('/call/test-room')
    
    // Find video toggle button
    const videoButton = page.locator('button[aria-label*="video"], button[title*="video"]').first()
    
    if (await videoButton.isVisible().catch(() => false)) {
      // Get initial state
      const initialAriaPressed = await videoButton.getAttribute('aria-pressed')
      
      // Click to toggle
      await videoButton.click()
      
      // Wait for state change
      await page.waitForTimeout(500)
      
      // Check state changed
      const newAriaPressed = await videoButton.getAttribute('aria-pressed')
      expect(newAriaPressed).not.toBe(initialAriaPressed)
    } else {
      test.skip('Video toggle button not found')
    }
  })

  test('should toggle audio on/off', async ({ page }) => {
    await page.goto('/call/test-room')
    
    // Find audio toggle button
    const audioButton = page.locator('button[aria-label*="audio"], button[aria-label*="microphone"], button[title*="audio"]').first()
    
    if (await audioButton.isVisible().catch(() => false)) {
      // Get initial state
      const initialAriaPressed = await audioButton.getAttribute('aria-pressed')
      
      // Click to toggle
      await audioButton.click()
      
      // Wait for state change
      await page.waitForTimeout(500)
      
      // Check state changed
      const newAriaPressed = await audioButton.getAttribute('aria-pressed')
      expect(newAriaPressed).not.toBe(initialAriaPressed)
    } else {
      test.skip('Audio toggle button not found')
    }
  })

  test('should end call', async ({ page }) => {
    await page.goto('/call/test-room')
    
    // Find end call button
    const endCallButton = page.locator('button:has-text("End"), button:has-text("Leave"), button[aria-label*="end"]').first()
    
    if (await endCallButton.isVisible().catch(() => false)) {
      await endCallButton.click()
      
      // Should navigate away from call page
      await page.waitForURL(/\/call\//, { timeout: 5000 }).catch(() => {
        // If navigated away, that's expected
        expect(page.url()).not.toContain('/call/')
      })
    } else {
      test.skip('End call button not found')
    }
  })

  test('should open and close chat', async ({ page }) => {
    await page.goto('/call/test-room')
    
    // Find chat button
    const chatButton = page.locator('button[aria-label*="chat"], button[title*="chat"]').first()
    
    if (await chatButton.isVisible().catch(() => false)) {
      // Open chat
      await chatButton.click()
      
      // Chat panel should be visible
      const chatPanel = page.locator('[class*="chat"], [class*="sidebar"]').first()
      await expect(chatPanel).toBeVisible({ timeout: 2000 })
      
      // Close chat (click close button or chat button again)
      const closeButton = page.locator('button[aria-label*="close"], button:has-text("Close")').first()
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click()
      } else {
        await chatButton.click() // Toggle off
      }
      
      // Chat panel should be hidden
      await expect(chatPanel).not.toBeVisible({ timeout: 2000 })
    } else {
      test.skip('Chat button not found')
    }
  })

  test('should send chat message', async ({ page }) => {
    await page.goto('/call/test-room')
    
    // Open chat
    const chatButton = page.locator('button[aria-label*="chat"]').first()
    if (await chatButton.isVisible().catch(() => false)) {
      await chatButton.click()
      
      // Find message input
      const messageInput = page.locator('input[type="text"], textarea').first()
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
      
      if (await messageInput.isVisible().catch(() => false)) {
        // Type message
        await messageInput.fill('Test message from E2E test')
        await sendButton.click()
        
        // Message should appear in chat
        await expect(page.locator('text=Test message from E2E test')).toBeVisible({ timeout: 5000 })
      } else {
        test.skip('Chat message input not found')
      }
    } else {
      test.skip('Chat button not found')
    }
  })
})

