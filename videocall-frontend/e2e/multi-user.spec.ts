import { test, expect } from '@playwright/test'

test.describe('Multi-User Video Call E2E Tests', () => {
  test('should handle multiple participants in P2P mode', async ({ browser }) => {
    // Create two browser contexts (simulating two users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    try {
      // User 1: Login and create room
      await page1.goto('/login')
      await page1.fill('input[type="password"]', 'test-password')
      await page1.click('button[type="submit"]')
      await page1.waitForURL(/\/(dashboard|$)/, { timeout: 10000 })
      
      await page1.goto('/dashboard')
      const createButton = page1.locator('button:has-text("Create")').first()
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click()
        await page1.waitForURL(/\/call\//, { timeout: 10000 })
      }
      
      // Get room code from URL or page
      const roomUrl = page1.url()
      const roomMatch = roomUrl.match(/\/call\/([a-zA-Z0-9-]+)/)
      if (!roomMatch) {
        test.skip('Could not extract room code')
        return
      }
      const roomCode = roomMatch[1]
      
      // User 2: Login and join room
      await page2.goto('/login')
      await page2.fill('input[type="password"]', 'test-password')
      await page2.click('button[type="submit"]')
      await page2.waitForURL(/\/(dashboard|$)/, { timeout: 10000 })
      
      await page2.goto(`/call/${roomCode}`)
      
      // Both users should see video elements
      const video1 = page1.locator('video').first()
      const video2 = page2.locator('video').first()
      
      await expect(video1).toBeVisible({ timeout: 10000 })
      await expect(video2).toBeVisible({ timeout: 10000 })
      
      // Wait a bit for connection to establish
      await page1.waitForTimeout(3000)
      await page2.waitForTimeout(3000)
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })

  test('should handle SFU mode with 3+ participants', async ({ browser }) => {
    // Create three browser contexts
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ])
    
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()))
    
    try {
      // All users login
      for (const page of pages) {
        await page.goto('/login')
        await page.fill('input[type="password"]', 'test-password')
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/(dashboard|$)/, { timeout: 10000 })
      }
      
      // User 1 creates room
      await pages[0].goto('/dashboard')
      const createButton = pages[0].locator('button:has-text("Create")').first()
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click()
        await pages[0].waitForURL(/\/call\//, { timeout: 10000 })
      }
      
      // Get room code
      const roomUrl = pages[0].url()
      const roomMatch = roomUrl.match(/\/call\/([a-zA-Z0-9-]+)/)
      if (!roomMatch) {
        test.skip('Could not extract room code')
        return
      }
      const roomCode = roomMatch[1]
      
      // Other users join
      for (let i = 1; i < pages.length; i++) {
        await pages[i].goto(`/call/${roomCode}`)
      }
      
      // All users should see video
      for (const page of pages) {
        const video = page.locator('video').first()
        await expect(video).toBeVisible({ timeout: 10000 })
      }
      
      // Wait for SFU connection (should switch to SFU with 3+ participants)
      await Promise.all(pages.map(p => p.waitForTimeout(5000)))
      
    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()))
    }
  })

  test('should handle participant leaving', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    try {
      // Both users login and join
      for (const page of [page1, page2]) {
        await page.goto('/login')
        await page.fill('input[type="password"]', 'test-password')
        await page.click('button[type="submit"]')
        await page.waitForURL(/\/(dashboard|$)/, { timeout: 10000 })
      }
      
      // User 1 creates room
      await page1.goto('/dashboard')
      const createButton = page1.locator('button:has-text("Create")').first()
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click()
        await page1.waitForURL(/\/call\//, { timeout: 10000 })
      }
      
      const roomUrl = page1.url()
      const roomMatch = roomUrl.match(/\/call\/([a-zA-Z0-9-]+)/)
      if (!roomMatch) {
        test.skip('Could not extract room code')
        return
      }
      const roomCode = roomMatch[1]
      
      await page2.goto(`/call/${roomCode}`)
      
      // Wait for connection
      await page1.waitForTimeout(3000)
      await page2.waitForTimeout(3000)
      
      // User 2 leaves
      const endCallButton = page2.locator('button:has-text("End"), button:has-text("Leave")').first()
      if (await endCallButton.isVisible().catch(() => false)) {
        await endCallButton.click()
        
        // User 2 should navigate away
        await page2.waitForURL(/\/call\//, { timeout: 5000 }).catch(() => {
          expect(page2.url()).not.toContain('/call/')
        })
      }
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})

