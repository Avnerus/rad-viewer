import { test, expect } from '@playwright/test'

const SAMPLE_URL =
  'https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad'

/** Read camera debug attributes from the hidden debug element */
async function getCameraState(page: import('@playwright/test').Page) {
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
 * extension pane.
 *
 * The pane toggle button is rendered inside the WebGL canvas where pointer
 * interactions trigger GPU stalls that cause Playwright actionability timeouts.
 * We use evaluate() for the toggle click only; all other interactions use
 * normal Playwright locators.
 */
async function selectAnimatorAndOpenPane(
  page: import('@playwright/test').Page,
  animatorName: string,
) {
  await page.waitForTimeout(2000)

  // Click the animator in the Studio scene hierarchy (normal click works)
  const hierarchyItem = page.getByText(animatorName)
  await expect(hierarchyItem).toBeVisible({ timeout: 10_000 })
  await hierarchyItem.click()
  await page.waitForTimeout(500)

  // Open the extension pane. The toggle button is inside the canvas overlay
  // where GPU stalls prevent Playwright actionability checks from completing.
  // Using evaluate() to click the DOM element directly avoids the stall.
  await page.evaluate(() => {
    const wrapper = document.querySelector('.scroll-animator-extension')
    const btn = wrapper?.querySelector('button[aria-label="Toggle Pane"]')
    btn?.click()
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
    expect(await input.inputValue()).toBe(SAMPLE_URL)
  })

  test('start button validates URL and enters viewer', async ({ page }) => {
    await page.goto('/')
    const input = page.getByLabel('RAD file URL')
    await input.fill('not-a-valid-url')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible({ timeout: 15_000 })
  })

  test('viewer shows canvas', async ({ page }) => {
    await page.goto('/')
    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('#app canvas')).toBeVisible({ timeout: 15_000 })
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
    const initialState = await getCameraState(page)
    expect(initialState.progress).toBeCloseTo(0, 1)
    expect(initialState.x).toBeCloseTo(0, 0)
    expect(initialState.y).toBeCloseTo(0, 0)
    expect(initialState.z).toBeCloseTo(-1, 0)
    expect(initialState.targetX).toBeCloseTo(0, 0)
    expect(initialState.targetY).toBeCloseTo(0, 0)
    expect(initialState.targetZ).toBeCloseTo(0, 0)

    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight) })
    await page.waitForTimeout(800)

    const scrolledState = await getCameraState(page)
    expect(scrolledState.progress).toBeGreaterThan(0.5)
    expect(scrolledState.y).toBeGreaterThan(initialState.y)
    expect(scrolledState.targetX).toBeCloseTo(0, 0)
    expect(scrolledState.targetY).toBeCloseTo(0, 0)
    expect(scrolledState.targetZ).toBeCloseTo(0, 0)
  })

  test('URL in query string pre-fills the input', async ({ page }) => {
    const encodedUrl = encodeURIComponent(SAMPLE_URL)
    await page.goto(`/?url=${encodedUrl}`)
    expect(await page.getByLabel('RAD file URL').inputValue()).toBe(SAMPLE_URL)
  })

  test('free navigation controls are absent', async ({ page }) => {
    await startViewer(page)
    await expect(page.getByLabel('Free navigation')).not.toBeVisible()
    await expect(page.getByText(/WASD|Arrows/i)).not.toBeVisible()
  })

  test('camera debug state does not expose free-nav attributes', async ({ page }) => {
    await startViewer(page)
    const el = page.getByTestId('camera-state')
    expect(await el.getAttribute('data-freenav')).toBeNull()
    expect(await el.getAttribute('data-yaw')).toBeNull()
    expect(await el.getAttribute('data-pitch')).toBeNull()
    expect(await el.getAttribute('data-zoom')).toBeNull()
  })

  test('extension pane opens through toggle and shows keyframes', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    const animatorName = page.locator('.sa-animator-name')
    await expect(animatorName).toBeVisible({ timeout: 10_000 })
    await expect(animatorName).toContainText('Camera ScrollAnimator')

    const keyframeRows = page.locator('.sa-kf-row')
    expect(await keyframeRows.count()).toBe(2)
    await expect(keyframeRows.nth(0)).toContainText('0.00%')
    await expect(keyframeRows.nth(1)).toContainText('100.00%')

    // Verify pane can be closed
    await page.evaluate(() => {
      const wrapper = document.querySelector('.scroll-animator-extension')
      wrapper?.querySelector('button[aria-label="Toggle Pane"]')?.click()
    })
    expect(await animatorName.isVisible()).toBe(false)
  })

  test('source-sync-unavailable state shows percentage input and warning', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    // Warning message visible
    const warning = page.locator('.sa-warning')
    await expect(warning).toBeVisible({ timeout: 10_000 })
    await expect(warning).toContainText('Studio source sync unavailable')

    // Insert and delete controls not present
    await expect(page.locator('.sa-insert-btn')).not.toBeVisible()
    expect(await page.locator('.sa-kf-delete').count()).toBe(0)

    // But percentage input and display are available
    await expect(page.locator('#sa-percent-input')).toBeVisible()
    await expect(page.locator('.sa-percent-display')).toBeVisible()
  })

  test('clicking a keyframe percentage jumps scroll and updates camera', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    const initial = await getCameraState(page)
    expect(initial.y).toBeCloseTo(0, 0)

    // Click the last keyframe button (100%) via evaluate (canvas overlay)
    await page.evaluate(() => {
      const rows = document.querySelectorAll('.sa-kf-row')
      const lastRow = rows[rows.length - 1]
      lastRow?.querySelector('.sa-kf-pct')?.click()
    })
    await page.waitForTimeout(800)

    const afterJump = await getCameraState(page)
    expect(afterJump.y).toBeGreaterThan(25)
    expect(afterJump.progress).toBeGreaterThan(95)
  })

  test('percentage display updates when scrolling', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight) })
    await page.waitForTimeout(1500)

    const pctDisplay = page.locator('.sa-percent-display')
    await expect(pctDisplay).toBeVisible({ timeout: 10_000 })
    const pctText = await pctDisplay.textContent()
    expect(pctText).toBeTruthy()
    expect(parseFloat(pctText!)).toBeGreaterThan(50)
  })

  test('selecting non-ScrollAnimator shows disabled state', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(1000)

    // Clear selection by clicking empty canvas area
    await page.locator('#app canvas').click()
    await page.waitForTimeout(300)

    // Open the extension pane
    await page.evaluate(() => {
      document.querySelector('.scroll-animator-extension')
        ?.querySelector('button[aria-label="Toggle Pane"]')?.click()
    })
    await page.waitForTimeout(500)

    const noSelection = page.locator('.sa-no-selection')
    await expect(noSelection).toBeVisible({ timeout: 10_000 })
    await expect(noSelection).toContainText('Select one ScrollAnimator')
  })

  test('viewer remount does not stack look-at callbacks', async ({ page }) => {
    await startViewer(page)
    const state1 = await getCameraState(page)
    expect(state1.y).toBeCloseTo(0, 0)

    await page.getByRole('button', { name: 'Go back' }).click()
    await page.waitForTimeout(1000)
    await expect(page.getByRole('heading', { name: 'RAD Viewer' })).toBeVisible()

    const input = page.getByLabel('RAD file URL')
    await input.fill(SAMPLE_URL)
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('#app canvas')).toBeVisible({ timeout: 15_000 })

    const state2 = await getCameraState(page)
    expect(state2.y).toBeCloseTo(0, 0)
    expect(state2.z).toBeCloseTo(-1, 0)
  })

  // ---------------------------------------------------------------------------
  // Regression tests for Studio camera ownership
  // ---------------------------------------------------------------------------

  test('camera debug element has data-active attribute', async ({ page }) => {
    await startViewer(page)
    const el = page.getByTestId('camera-state')
    // Element is visually hidden (clip: rect), so check existence via evaluate
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="camera-state"]')
      return el && el.getAttribute('data-active') !== null
    }, { timeout: 10_000 })
    const activeAttr = await el.getAttribute('data-active')
    expect(activeAttr).toBeTruthy()
    // With editor camera off (default), the app camera should be active
    expect(activeAttr).toBe('true')
  })

  // ---------------------------------------------------------------------------
  // Regression tests for Studio overlay scroll-safety
  // ---------------------------------------------------------------------------

  test('Studio toolbar remains at stable viewport coordinates during scroll', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    // Get initial toolbar bounding rect
    const initialRect = await page.evaluate(() => {
      const toolbar = document.querySelector('.tp-dfwv')
      if (!toolbar) return null
      const r = toolbar.getBoundingClientRect()
      return { top: r.top, left: r.left, bottom: r.bottom, right: r.right }
    })
    expect(initialRect).not.toBeNull()

    // Scroll to 50% of document
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 0.5)
    })
    await page.waitForTimeout(500)

    // Get scrolled toolbar bounding rect
    const scrolledRect = await page.evaluate(() => {
      const toolbar = document.querySelector('.tp-dfwv')
      if (!toolbar) return null
      const r = toolbar.getBoundingClientRect()
      return { top: r.top, left: r.left, bottom: r.bottom, right: r.right }
    })
    expect(scrolledRect).not.toBeNull()

    // Coordinates should be stable within a small tolerance (5px)
    const tolerance = 5
    const init = initialRect as { top: number; left: number }
    const scrolled = scrolledRect as { top: number; left: number }
    expect(Math.abs(scrolled.top - init.top)).toBeLessThan(tolerance)
    expect(Math.abs(scrolled.left - init.left)).toBeLessThan(tolerance)
  })

  // ---------------------------------------------------------------------------
  // Regression tests for Scroll Animator extension UI
  // ---------------------------------------------------------------------------

  test('Scroll Animator toolbar button has icon and accessible label', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    // The toolbar button should have an aria-label for "Toggle Pane"
    const toggleBtn = await page.evaluate(() => {
      const wrapper = document.querySelector('.scroll-animator-extension')
      const btn = wrapper?.querySelector('button[aria-label="Toggle Pane"]')
      return btn ? {
        ariaLabel: btn.getAttribute('aria-label'),
        hasIcon: !!btn.querySelector('svg'),
      } : null
    })
    expect(toggleBtn).not.toBeNull()
    expect(toggleBtn!.ariaLabel).toBe('Toggle Pane')
    expect(toggleBtn!.hasIcon).toBe(true)
  })

  test('open Scroll Animator pane has no inert title button', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    // Check that the title bar (.tp-rotv_b) inside the tooltip has pointer-events: none
    const titleBarStyle = await page.evaluate(() => {
      const tooltip = document.querySelector('.scroll-animator-extension .tooltip')
      const titleBar = tooltip?.querySelector('.tp-rotv_b')
      if (!titleBar) return null
      const computed = window.getComputedStyle(titleBar)
      return {
        pointerEvents: computed.pointerEvents,
        cursor: computed.cursor,
        hasExpandArrow: !!tooltip.querySelector('.tp-rotv_m'),
      }
    })
    expect(titleBarStyle).not.toBeNull()
    // Title bar should not be interactive
    expect(titleBarStyle!.pointerEvents).toBe('none')
  })
})
