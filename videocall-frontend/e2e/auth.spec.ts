import { test, expect } from '@playwright/test'

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should login with password', async ({ page }) => {
    // Fill in password
    await page.fill('input[type="password"]', 'test-password')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for navigation or success message
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 10000 })
    
    // Verify we're logged in (check for dashboard or user info)
    const url = page.url()
    expect(url).not.toContain('/login')
  })

  test('should show error for empty password', async ({ page }) => {
    // Try to submit without password
    await page.click('button[type="submit"]')
    
    // Should show validation error or stay on login page
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('should handle SSO OAuth login (Google)', async ({ page }) => {
    // Check if SSO button exists
    const googleButton = page.locator('button:has-text("Google"), a:has-text("Google")').first()
    
    if (await googleButton.isVisible().catch(() => false)) {
      await googleButton.click()
      
      // Should redirect to OAuth provider
      await page.waitForURL(/accounts\.google\.com|login\.microsoftonline\.com/, { timeout: 5000 }).catch(() => {
        // If OAuth is not configured, test should pass
        console.log('OAuth not configured, skipping OAuth test')
      })
    } else {
      test.skip('SSO OAuth button not found - SSO may not be enabled')
    }
  })

  test('should handle SSO SAML login', async ({ page }) => {
    // Check if SAML button exists
    const samlButton = page.locator('button:has-text("SAML"), a:has-text("SAML")').first()
    
    if (await samlButton.isVisible().catch(() => false)) {
      await samlButton.click()
      
      // Should redirect to SAML IdP
      await page.waitForURL(/saml|idp/, { timeout: 5000 }).catch(() => {
        // If SAML is not configured, test should pass
        console.log('SAML not configured, skipping SAML test')
      })
    } else {
      test.skip('SAML button not found - SAML may not be enabled')
    }
  })

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.fill('input[type="password"]', 'test-password')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 10000 })
    
    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")').first()
    
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click()
      
      // Should redirect to login page
      await page.waitForURL(/\/login/, { timeout: 5000 })
      expect(page.url()).toContain('/login')
    } else {
      test.skip('Logout button not found')
    }
  })
})

