import { test, expect } from '@playwright/test'

const SAMPLE_URL =
  'https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad'

test.describe('RAD Viewer', () => {
  test('landing screen shows URL input and start button', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'RAD Viewer' })).toBeVisible()
    await expect(page.getByLabel('RAD file URL')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  })

  test('URL input has sample URL as initial value', async ({ page }) => {
    await page.goto('/')

    const input = page.getByLabel('RAD file URL')
    const value = await input.inputValue()
    expect(value).toBe(SAMPLE_URL)
  })

  test('start button validates URL and enters viewer', async ({ page }) => {
    await page.goto('/')

    // Clear and enter invalid URL
    const input = page.getByLabel('RAD file URL')
    await input.fill('not-a-valid-url')
    await page.getByRole('button', { name: 'Start' }).click()

    // Should show error
    await expect(page.getByRole('alert')).toBeVisible()

    // Enter valid URL
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()

    // Should transition to viewer
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible({ timeout: 15_000 })
  })

  test('viewer shows canvas', async ({ page }) => {
    await page.goto('/')

    // Start the viewer
    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()

    // Wait for canvas to appear
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 15_000 })
  })

  test('back button returns to landing screen', async ({ page }) => {
    await page.goto('/')

    // Enter viewer
    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible({ timeout: 15_000 })

    // Click the back button
    await page.getByRole('button', { name: 'Go back' }).click()

    // Allow time for Svelte state update
    await page.waitForTimeout(1000)

    // Should be back on landing
    await expect(page.getByRole('heading', { name: 'RAD Viewer' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('RAD file URL')).toBeVisible({ timeout: 10_000 })
  })

  test('scrolling drives camera from perspective to top-down', async ({ page }) => {
    await page.goto('/')

    // Start viewer
    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })

    // Small wait for ScrollTrigger scrub to update
    await page.waitForTimeout(500)

    // The canvas should still be visible after scrolling
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('URL in query string pre-fills the input', async ({ page }) => {
    const encodedUrl = encodeURIComponent(SAMPLE_URL)
    await page.goto(`/?url=${encodedUrl}`)

    const input = page.getByLabel('RAD file URL')
    const value = await input.inputValue()
    expect(value).toBe(SAMPLE_URL)
  })
})
