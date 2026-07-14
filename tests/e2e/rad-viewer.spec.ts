import { test, expect } from '@playwright/test'

const SAMPLE_URL =
  'https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad'

/** Read camera debug attributes from the hidden debug element */
async function getCameraState(page: import('@playwright/test').Page) {
  const el = page.getByTestId('camera-state')
  return {
    progress: parseFloat(await el.getAttribute('data-progress') ?? '0'),
    x: parseFloat(await el.getAttribute('data-x') ?? '0'),
    y: parseFloat(await el.getAttribute('data-y') ?? '0'),
    z: parseFloat(await el.getAttribute('data-z') ?? '0'),
    targetX: parseFloat(await el.getAttribute('data-target-x') ?? '0'),
    targetY: parseFloat(await el.getAttribute('data-target-y') ?? '0'),
    targetZ: parseFloat(await el.getAttribute('data-target-z') ?? '0'),
  }
}

/** Helper: start the viewer and wait for canvas */
async function startViewer(page: import('@playwright/test').Page) {
  await page.goto('/')
  const input = page.getByLabel('RAD file URL')
  await input.fill(SAMPLE_URL)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('#app canvas')).toBeVisible({ timeout: 15_000 })
}

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

    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()

    const canvas = page.locator('#app canvas')
    await expect(canvas).toBeVisible({ timeout: 15_000 })
  })

  test('back button returns to landing screen', async ({ page }) => {
    await page.goto('/')

    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Go back' }).click()
    await page.waitForTimeout(1000)

    await expect(page.getByRole('heading', { name: 'RAD Viewer' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('RAD file URL')).toBeVisible({ timeout: 10_000 })
  })

  test('scrolling drives camera from perspective to top-down', async ({ page }) => {
    await startViewer(page)

    // Capture initial camera state
    const initialState = await getCameraState(page)
    expect(initialState.progress).toBeCloseTo(0, 1)

    // Initial camera should be near the perspective pose
    expect(initialState.x).toBeCloseTo(0, 0)
    expect(initialState.y).toBeCloseTo(0, 0)
    expect(initialState.z).toBeCloseTo(-1, 0)

    // Target should be at origin
    expect(initialState.targetX).toBeCloseTo(0, 0)
    expect(initialState.targetY).toBeCloseTo(0, 0)
    expect(initialState.targetZ).toBeCloseTo(0, 0)

    // Scroll to bottom to drive the ScrollTrigger
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })

    // Wait for ScrollTrigger scrub to propagate
    await page.waitForTimeout(800)

    // Assert camera state changed toward top-down
    const scrolledState = await getCameraState(page)
    expect(scrolledState.progress).toBeGreaterThan(0.5)
    expect(scrolledState.y).toBeGreaterThan(initialState.y) // camera moved upward

    // Target from CameraTarget (still at origin with default keyframes)
    expect(scrolledState.targetX).toBeCloseTo(0, 0)
    expect(scrolledState.targetY).toBeCloseTo(0, 0)
    expect(scrolledState.targetZ).toBeCloseTo(0, 0)
  })

  test('URL in query string pre-fills the input', async ({ page }) => {
    const encodedUrl = encodeURIComponent(SAMPLE_URL)
    await page.goto(`/?url=${encodedUrl}`)

    const input = page.getByLabel('RAD file URL')
    const value = await input.inputValue()
    expect(value).toBe(SAMPLE_URL)
  })

  test('free navigation controls are absent', async ({ page }) => {
    await startViewer(page)

    // Free navigation checkbox should not exist
    const checkbox = page.getByLabel('Free navigation')
    await expect(checkbox).not.toBeVisible()

    // Free navigation hint should not exist
    const hint = page.getByText(/WASD|Arrows/i)
    await expect(hint).not.toBeVisible()
  })

  test('camera debug state does not expose free-nav attributes', async ({ page }) => {
    await startViewer(page)

    const el = page.getByTestId('camera-state')
    const freeNav = await el.getAttribute('data-freenav')
    const yaw = await el.getAttribute('data-yaw')
    const pitch = await el.getAttribute('data-pitch')
    const zoom = await el.getAttribute('data-zoom')

    expect(freeNav).toBeNull()
    expect(yaw).toBeNull()
    expect(pitch).toBeNull()
    expect(zoom).toBeNull()
  })
})
