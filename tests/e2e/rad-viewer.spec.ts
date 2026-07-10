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
    target: await el.getAttribute('data-target'),
    freeNav: await el.getAttribute('data-freenav'),
    yaw: parseFloat(await el.getAttribute('data-yaw') ?? '0'),
    pitch: parseFloat(await el.getAttribute('data-pitch') ?? '0'),
    zoom: parseFloat(await el.getAttribute('data-zoom') ?? '60'),
  }
}

/** Helper: start the viewer and wait for canvas */
async function startViewer(page: import('@playwright/test').Page) {
  await page.goto('/')
  const input = page.getByLabel('RAD file URL')
  await input.fill(SAMPLE_URL)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
}

/** Helper: enable free navigation and wait for it to activate */
async function enableFreeNav(page: import('@playwright/test').Page) {
  const checkbox = page.getByLabel('Free navigation')
  await checkbox.check()
  await page.waitForTimeout(500)
  const state = await getCameraState(page)
  expect(state.freeNav).toBe('true')
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

    const canvas = page.locator('canvas')
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
    expect(initialState.target).toBe('0,0,0')

    // Scroll to bottom to drive the ScrollTrigger tween
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })

    // Wait for ScrollTrigger scrub to propagate
    await page.waitForTimeout(800)

    // Assert camera state changed toward top-down
    const scrolledState = await getCameraState(page)
    expect(scrolledState.progress).toBeGreaterThan(0.5)
    expect(scrolledState.y).toBeGreaterThan(initialState.y) // camera moved upward
    expect(scrolledState.target).toBe('0,0,0') // target remains fixed
  })

  test('URL in query string pre-fills the input', async ({ page }) => {
    const encodedUrl = encodeURIComponent(SAMPLE_URL)
    await page.goto(`/?url=${encodedUrl}`)

    const input = page.getByLabel('RAD file URL')
    const value = await input.inputValue()
    expect(value).toBe(SAMPLE_URL)
  })
})

test.describe('Free Navigation', () => {
  test('free navigation checkbox exists', async ({ page }) => {
    await startViewer(page)

    const checkbox = page.getByLabel('Free navigation')
    await expect(checkbox).toBeVisible()
    await expect(checkbox).not.toBeChecked()
  })

  test('enabling free navigation shows hint text', async ({ page }) => {
    await startViewer(page)

    const checkbox = page.getByLabel('Free navigation')
    await checkbox.check()
    await page.waitForTimeout(200)

    await expect(page.getByText(/WASD|Arrows/i)).toBeVisible()
  })

  test('keyboard W moves forward using real Playwright input', async ({ page }) => {
    await startViewer(page)
    await enableFreeNav(page)

    const stateBefore = await getCameraState(page)

    // Use real Playwright keyboard input
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(800)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(100)

    const stateAfter = await getCameraState(page)
    const dx = stateAfter.x - stateBefore.x
    const dz = stateAfter.z - stateBefore.z
    const moved = Math.sqrt(dx * dx + dz * dz)
    expect(moved).toBeGreaterThan(0)
  })

  test('keyboard W and S move in opposite directions', async ({ page }) => {
    await startViewer(page)
    await enableFreeNav(page)

    const startState = await getCameraState(page)

    // Press W (forward)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(400)
    await page.keyboard.up('KeyW')
    const afterW = await getCameraState(page)

    // Press S (backward) from the new position
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(400)
    await page.keyboard.up('KeyS')
    const afterS = await getCameraState(page)

    // W moved camera one way, S should have moved it back toward start
    // The z deltas should have opposite signs (W goes one way, S goes the other)
    const wDeltaZ = afterW.z - startState.z
    const sDeltaZ = afterS.z - afterW.z
    expect(wDeltaZ * sDeltaZ).toBeLessThan(0)
  })

  test('keyboard movement does not affect camera when free nav is disabled', async ({ page }) => {
    await startViewer(page)

    // Ensure free nav is off
    const checkbox = page.getByLabel('Free navigation')
    await expect(checkbox).not.toBeChecked()

    const stateBefore = await getCameraState(page)

    // Press W — should have no effect
    await page.keyboard.press('KeyW')
    await page.waitForTimeout(200)

    const stateAfter = await getCameraState(page)
    expect(stateAfter.freeNav).toBe('false')
    // Position should remain the same (within floating point tolerance)
    expect(stateAfter.x).toBeCloseTo(stateBefore.x, 2)
    expect(stateAfter.z).toBeCloseTo(stateBefore.z, 2)
  })

  test('disabling free navigation restores scroll-driven behavior', async ({ page }) => {
    await startViewer(page)

    // Enable free navigation
    const checkbox = page.getByLabel('Free navigation')
    await checkbox.check()
    await page.waitForTimeout(200)

    // Move camera with keyboard
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyW')

    // Disable free navigation
    await checkbox.uncheck()
    await page.waitForTimeout(200)

    // Scroll should now drive the camera again
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(800)

    const scrolledState = await getCameraState(page)
    expect(scrolledState.freeNav).toBe('false')
    expect(scrolledState.progress).toBeGreaterThan(0.5)
  })

  test('mouse movement changes camera yaw and pitch', async ({ page }) => {
    await startViewer(page)
    await enableFreeNav(page)

    // Capture initial orientation
    const stateBefore = await getCameraState(page)

    // Move mouse in the canvas area — right then down
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (box) {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      // Move to center first
      await page.mouse.move(cx, cy)
      await page.waitForTimeout(50)
      // Then move right (should change yaw)
      await page.mouse.move(cx + 150, cy)
      await page.waitForTimeout(100)
      // Then move down (should change pitch)
      await page.mouse.move(cx + 150, cy + 100)
      await page.waitForTimeout(100)
    }

    const stateAfter = await getCameraState(page)
    expect(stateAfter.freeNav).toBe('true')

    // Yaw should have changed from the horizontal mouse movement
    const yawChanged = Math.abs(stateAfter.yaw - stateBefore.yaw) > 0.01
    // Pitch should have changed from the vertical mouse movement
    const pitchChanged = Math.abs(stateAfter.pitch - stateBefore.pitch) > 0.01
    expect(yawChanged || pitchChanged).toBe(true)
  })

  test('scroll wheel zoom-in decreases FOV using real Playwright wheel', async ({ page }) => {
    await startViewer(page)
    await enableFreeNav(page)

    const stateBefore = await getCameraState(page)
    expect(stateBefore.zoom).toBeCloseTo(60, 0)

    // Scroll up (negative deltaY) to zoom in
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(200)

    const stateAfter = await getCameraState(page)
    // Zoom (FOV) should have decreased (zoomed in)
    expect(stateAfter.zoom).toBeLessThan(stateBefore.zoom)
    expect(stateAfter.zoom).toBeGreaterThanOrEqual(10)
  })

  test('scroll wheel zoom-out increases FOV beyond initial view', async ({ page }) => {
    await startViewer(page)
    await enableFreeNav(page)

    const stateBefore = await getCameraState(page)
    expect(stateBefore.zoom).toBeCloseTo(60, 0)

    // Scroll down (positive deltaY) to zoom out
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(200)

    const stateAfter = await getCameraState(page)
    // Zoom (FOV) should have increased (zoomed out), beyond initial 60
    expect(stateAfter.zoom).toBeGreaterThan(stateBefore.zoom)
    expect(stateAfter.zoom).toBeLessThanOrEqual(90)
  })

  test('scroll wheel does not zoom when free nav is disabled', async ({ page }) => {
    await startViewer(page)

    // Free nav is off by default
    const stateBefore = await getCameraState(page)
    expect(stateBefore.freeNav).toBe('false')

    // Wheel should not zoom when free nav is off
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(200)

    const stateAfter = await getCameraState(page)
    // Zoom should remain at default (60)
    expect(stateAfter.zoom).toBeCloseTo(60, 0)
  })
})
