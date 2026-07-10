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

  test('keyboard movement changes camera position when free nav is enabled', async ({ page }) => {
    await startViewer(page)

    // Enable free navigation
    const checkbox = page.getByLabel('Free navigation')
    await checkbox.check()
    await page.waitForTimeout(500)

    // Verify free nav is active via the debug element
    const stateBefore = await getCameraState(page)
    expect(stateBefore.freeNav).toBe('true')

    // Dispatch keyboard events via page.evaluate to ensure they hit the window listener
    // and let the rAF loop process movement
    const result = await page.evaluate(() => {
      return new Promise<{ startX: number; startZ: number; endX: number; endZ: number }>((resolve) => {
        const debugEl = document.querySelector('[data-testid="camera-state"]')!
        const startX = parseFloat(debugEl.getAttribute('data-x')!)
        const startZ = parseFloat(debugEl.getAttribute('data-z')!)

        // Dispatch keydown on window
        const keyDown = new KeyboardEvent('keydown', { key: 'w', bubbles: true })
        window.dispatchEvent(keyDown)

        // Let rAF run for ~60 frames (~1 second at 60fps)
        let frames = 0
        function tick() {
          frames++
          if (frames >= 60) {
            const endX = parseFloat(debugEl.getAttribute('data-x')!)
            const endZ = parseFloat(debugEl.getAttribute('data-z')!)
            // Dispatch keyup to clean up
            const keyUp = new KeyboardEvent('keyup', { key: 'w', bubbles: true })
            window.dispatchEvent(keyUp)
            resolve({ startX, startZ, endX, endZ })
            return
          }
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
    })

    const dx = result.endX - result.startX
    const dz = result.endZ - result.startZ
    const moved = Math.sqrt(dx * dx + dz * dz)
    expect(moved).toBeGreaterThan(0)
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

  test('mouse movement path smoke test', async ({ page }) => {
    await startViewer(page)

    // Enable free navigation
    const checkbox = page.getByLabel('Free navigation')
    await checkbox.check()
    await page.waitForTimeout(200)

    // Move mouse in the canvas area
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (box) {
      // Move to center of canvas
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(50)
      // Then move right
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2)
      await page.waitForTimeout(200)
    }

    // Camera orientation changed (yaw changed), reflected in position or debug state
    // With stub, the quaternion change is applied. We check the free nav flag is still active.
    const stateAfter = await getCameraState(page)
    expect(stateAfter.freeNav).toBe('true')
  })
})
