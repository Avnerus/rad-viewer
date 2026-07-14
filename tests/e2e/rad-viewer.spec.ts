import { test, expect } from '@playwright/test'

const SAMPLE_URL =
  'https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad'

/** Read camera debug attributes from the hidden debug element */
async function getCameraState(page: import('@playwright/test').Page) {
  // Use evaluate to read all attributes at once, avoiding per-attribute timeouts
  // that can occur for elements rendered inside a WebGL canvas overlay.
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="camera-state"]')
    if (!el) return null
    const get = (name: string) => parseFloat(el.getAttribute(name) ?? '0')
    return {
      progress: get('data-progress'),
      x: get('data-x'),
      y: get('data-y'),
      z: get('data-z'),
      targetX: get('data-target-x'),
      targetY: get('data-target-y'),
      targetZ: get('data-target-z'),
    }
  })
}

/** Helper: start the viewer and wait for canvas */
async function startViewer(page: import('@playwright/test').Page) {
  await page.goto('/')
  const input = page.getByLabel('RAD file URL')
  await input.fill(SAMPLE_URL)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('#app canvas')).toBeVisible({ timeout: 15_000 })
}

/**
 * Helper: select a ScrollAnimator in the Studio hierarchy and open the
 * extension pane. The pane toggle button is rendered inside the fixed canvas
 * where Playwright actionability checks are unreliable, so we use a targeted
 * click approach.
 */
async function selectAnimatorAndOpenPane(
  page: import('@playwright/test').Page,
  animatorName: string,
) {
  // Wait for Studio to fully initialize
  await page.waitForTimeout(2000)

  // Click the animator in the Studio scene hierarchy
  const hierarchyItem = page.getByText(animatorName)
  await expect(hierarchyItem).toBeVisible({ timeout: 10_000 })
  await hierarchyItem.click()
  await page.waitForTimeout(500)

  // Open the extension pane by clicking the Toggle Pane button.
  // The button is inside .scroll-animator-extension > DropDownPane.
  // We locate and click it via evaluate because Playwright actionability
  // checks fail for elements rendered inside a WebGL canvas overlay.
  await page.evaluate(() => {
    const wrapper = document.querySelector('.scroll-animator-extension')
    if (wrapper) {
      const btn = wrapper.querySelector('button[aria-label="Toggle Pane"]')
      if (btn) btn.click()
    }
  })
  await page.waitForTimeout(500)
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

  test('extension pane opens through real toggle and shows keyframes', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    // The extension should show the animator name
    const animatorName = page.locator('.sa-animator-name')
    await expect(animatorName).toBeVisible({ timeout: 5000 })
    await expect(animatorName).toContainText('Camera ScrollAnimator')

    // The keyframe list should show the 2 default keyframes (0% and 100%)
    const keyframeRows = page.locator('.sa-kf-row')
    const rowCount = await keyframeRows.count()
    expect(rowCount).toBe(2)

    // First keyframe should be at 0%
    await expect(keyframeRows.nth(0)).toContainText('0.00%')

    // Second keyframe should be at 100%
    await expect(keyframeRows.nth(1)).toContainText('100.00%')

    // Verify the pane can be closed
    await page.evaluate(() => {
      const wrapper = document.querySelector('.scroll-animator-extension')
      if (wrapper) {
        const btn = wrapper.querySelector('button[aria-label="Toggle Pane"]')
        if (btn) btn.click()
      }
    })
    const isVisible = await animatorName.isVisible()
    expect(isVisible).toBe(false)
  })

  test('extension shows source-sync-unavailable state in production preview', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    // In preview mode the Vite plugin is not active, so source sync is unavailable.
    // The extension should show a warning message.
    const warning = page.locator('.sa-warning')
    await expect(warning).toBeVisible({ timeout: 5000 })
    await expect(warning).toContainText('Studio source sync unavailable')

    // Insert and delete controls should not be present
    const insertBtn = page.locator('.sa-insert-btn')
    await expect(insertBtn).not.toBeVisible()

    const deleteBtns = page.locator('.sa-kf-delete')
    expect(await deleteBtns.count()).toBe(0)

    // But percentage display and keyframe jump buttons should still be available
    const pctDisplay = page.locator('.sa-percent-display')
    await expect(pctDisplay).toBeVisible()
  })

  test('clicking a keyframe percentage jumps scroll and updates camera', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    // Camera should start near perspective pose (y ≈ 0)
    const initial = await getCameraState(page)
    expect(initial.y).toBeCloseTo(0, 0)

    // Click the 100% keyframe button (last row) to jump to top-down.
    // Use evaluate because the button is rendered inside a canvas overlay.
    await page.evaluate(() => {
      const rows = document.querySelectorAll('.sa-kf-row')
      const lastRow = rows[rows.length - 1]
      const pctBtn = lastRow?.querySelector('.sa-kf-pct')
      if (pctBtn) pctBtn.click()
    })
    await page.waitForTimeout(800)

    // Camera should have moved toward top-down pose (y ≈ 30)
    const afterJump = await getCameraState(page)
    expect(afterJump.y).toBeGreaterThan(25)
    expect(afterJump.progress).toBeGreaterThan(95)
  })

  test('percentage display updates when scrolling', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(1500)

    // The percentage display should reflect the scrolled position
    const pctDisplay = page.locator('.sa-percent-display')
    await expect(pctDisplay).toBeVisible({ timeout: 10000 })
    const pctText = await pctDisplay.textContent()
    expect(pctText).toBeTruthy()
    const pctValue = parseFloat(pctText!)
    expect(pctValue).toBeGreaterThan(50)
  })

  test('selecting non-ScrollAnimator shows disabled state', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(1000)

    // Click on the SplatMesh icon (📐) in the hierarchy — it's not a ScrollAnimator
    // First clear any selection by clicking on empty canvas area
    await page.locator('#app canvas').click()
    await page.waitForTimeout(300)

    // Open the extension pane
    await page.evaluate(() => {
      const wrapper = document.querySelector('.scroll-animator-extension')
      if (wrapper) {
        const btn = wrapper.querySelector('button[aria-label="Toggle Pane"]')
        if (btn) btn.click()
      }
    })
    await page.waitForTimeout(500)

    // The extension should show the "Select one ScrollAnimator" message
    const noSelection = page.locator('.sa-no-selection')
    await expect(noSelection).toBeVisible({ timeout: 5000 })
    await expect(noSelection).toContainText('Select one ScrollAnimator')
  })

  test('viewer remount does not stack look-at callbacks', async ({ page }) => {
    // Navigate viewer → landing → viewer and verify no regression
    await startViewer(page)

    // Verify camera state is correct
    const state1 = await getCameraState(page)
    expect(state1.y).toBeCloseTo(0, 0)

    // Go back to landing
    await page.getByRole('button', { name: 'Go back' }).click()
    await page.waitForTimeout(1000)
    await expect(page.getByRole('heading', { name: 'RAD Viewer' })).toBeVisible()

    // Re-enter viewer
    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('#app canvas')).toBeVisible({ timeout: 15_000 })

    // Camera state should still be correct after remount
    const state2 = await getCameraState(page)
    expect(state2.y).toBeCloseTo(0, 0)
    expect(state2.z).toBeCloseTo(-1, 0)
  })
})
