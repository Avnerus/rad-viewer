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
 * extension pane. Uses native Playwright click for the hierarchy item
 * and the toolbar button.
 */
async function selectAnimatorAndOpenPane(
  page: import('@playwright/test').Page,
  animatorName: string,
) {
  await page.waitForTimeout(2000)

  // Click the animator in the Studio scene hierarchy
  const hierarchyItem = page.getByText(animatorName)
  await expect(hierarchyItem).toBeVisible({ timeout: 10_000 })
  await hierarchyItem.click()
  await page.waitForTimeout(500)

  // Open the extension pane via native click
  await page.getByRole('button', { name: 'Scroll Animator' }).click()
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
    await page.getByRole('button', { name: 'Scroll Animator' }).click()
    await page.waitForTimeout(300)
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
    await page.getByRole('button', { name: 'Scroll Animator' }).click()
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

  test('editor camera toggle transitions data-active true → false → true', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    // 1. Editor camera off — app camera active
    let active = await page.evaluate(() => document.querySelector('[data-testid="camera-state"]')?.getAttribute('data-active'))
    expect(active).toBe('true')

    // 2. Toggle editor camera on
    await page.getByRole('button', { name: 'Editor Camera' }).click()
    await page.waitForTimeout(500)
    active = await page.evaluate(() => document.querySelector('[data-testid="camera-state"]')?.getAttribute('data-active'))
    expect(active).toBe('false')

    // 3. Toggle editor camera off
    await page.getByRole('button', { name: 'Editor Camera' }).click()
    await page.waitForTimeout(500)
    active = await page.evaluate(() => document.querySelector('[data-testid="camera-state"]')?.getAttribute('data-active'))
    expect(active).toBe('true')
  })

  // ---------------------------------------------------------------------------
  // Regression tests for Studio overlay scroll-safety
  // ---------------------------------------------------------------------------

  /**
   * Helper: capture viewport rects of all opened Studio overlay panes,
   * keyed by a unique identifier (title or aria-label).
   * Returns a Map<id, { top, left, width }>. Panes with zero width are
   * excluded (closed/hidden).
   */
  async function captureOverlayRects(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const results: Record<string, { top: number; left: number; width: number }> = {}

      // All .tp-dfwv panes (toolbar, Scene Hierarchy, Inspector, Static State)
      const dfwvPanes = document.querySelectorAll('.tp-dfwv')
      dfwvPanes.forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0) return // skip hidden
        const titleEl = el.querySelector('.tp-rotv_t')
        const id = titleEl?.textContent?.trim() || 'unknown-tp-dfwv'
        results[id] = { top: r.top, left: r.left, width: r.width }
      })

      // Scroll Animator panel (not .tp-dfwv, uses .sa-panel-tooltip)
      const saPanel = document.querySelector('.sa-panel-tooltip')
      if (saPanel) {
        const r = saPanel.getBoundingClientRect()
        const display = window.getComputedStyle(saPanel).display
        if (display !== 'none' && r.width > 0) {
          results['Scroll Animator'] = { top: r.top, left: r.left, width: r.width }
        }
      }

      return results
    })
  }

  test('Studio overlay panes remain at stable viewport coordinates during scroll', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    // Open the panes we want to test:
    // 1. Static State — click its toolbar button
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Static State"]')
      btn?.click()
    })
    await page.waitForTimeout(300)

    // 2. Scroll Animator extension — open its panel via native click
    await page.getByRole('button', { name: 'Scroll Animator' }).click()
    await page.waitForTimeout(300)

    // 3. Inspector — select a scene object (Camera ScrollAnimator in hierarchy)
    //    The Inspector renders when something is selected.
    await page.evaluate(() => {
      const rows = document.querySelectorAll('.tv-row')
      for (const row of rows) {
        if (row.textContent?.includes('Camera ScrollAnimator')) {
          ;(row as HTMLElement).click()
          break
        }
      }
    })
    await page.waitForTimeout(500)

    // Capture baseline at scroll top
    const atTop = await captureOverlayRects(page)
    // Explicit expected set — prevents false passes if a pane fails to open
    const expectedKeys = ['Threlte Studio', 'Scene Hierarchy', 'Static State', 'Scroll Animator']
    for (const key of expectedKeys) {
      expect(atTop[key], `${key} not open at baseline`).toBeDefined()
    }

    // Scroll to 50%
    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.5) })
    await page.waitForTimeout(1000)

    const at50 = await captureOverlayRects(page)

    // Scroll to 95%
    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.95) })
    await page.waitForTimeout(1000)

    const at95 = await captureOverlayRects(page)

    // Assert every expected pane is present at all scroll positions
    // and coordinates are stable within tolerance
    for (const key of expectedKeys) {
      const baseline = atTop[key]
      const middle = at50[key]
      const bottom = at95[key]

      expect(middle, `${key} disappeared at 50% scroll`).toBeDefined()
      expect(bottom, `${key} disappeared at 95% scroll`).toBeDefined()

      // Scroll Animator panel uses Floating UI autoUpdate which is async;
      // allow slightly more tolerance for its repositioning after scroll
      const tolerance = key === 'Scroll Animator' ? 20 : 5

      expect(Math.abs(middle.top - baseline.top), `${key} top at 50%`).toBeLessThan(tolerance)
      expect(Math.abs(middle.left - baseline.left), `${key} left at 50%`).toBeLessThan(tolerance)

      expect(Math.abs(bottom.top - baseline.top), `${key} top at 95%`).toBeLessThan(tolerance)
      expect(Math.abs(bottom.left - baseline.left), `${key} left at 95%`).toBeLessThan(tolerance)
    }
  })

  // ---------------------------------------------------------------------------
  // Regression tests for Scroll Animator extension UI
  // ---------------------------------------------------------------------------

  test('Scroll Animator toolbar button has icon and accessible label', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    // The toolbar button should have aria-label "Scroll Animator" and an icon
    const toggleBtn = await page.evaluate(() => {
      const wrapper = document.querySelector('.scroll-animator-extension')
      const btn = wrapper?.querySelector('button[aria-label="Scroll Animator"]')
      return btn ? {
        ariaLabel: btn.getAttribute('aria-label'),
        hasIcon: !!btn.querySelector('svg'),
      } : null
    })
    expect(toggleBtn).not.toBeNull()
    expect(toggleBtn!.ariaLabel).toBe('Scroll Animator')
    expect(toggleBtn!.hasIcon).toBe(true)
  })

  test('open Scroll Animator pane has semantic heading and no inert title button', async ({ page }) => {
    await startViewer(page)
    await selectAnimatorAndOpenPane(page, 'Camera ScrollAnimator')

    // Check: semantic <h2> heading is visible
    const heading = page.locator('.sa-heading')
    await expect(heading).toBeVisible({ timeout: 10_000 })
    await expect(heading).toContainText('Scroll Animator')

    // Check: no DropDownPane .tooltip element exists (replaced by FixedToolbarPane)
    const hasOldTooltip = await page.evaluate(() => {
      return !!document.querySelector('.scroll-animator-extension .tooltip')
    })
    expect(hasOldTooltip).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Scroll-first-then-open regression: panel must be visible after scrolling
  // ---------------------------------------------------------------------------

  test('Scroll Animator panel opens in viewport at scroll 0%', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    await page.getByRole('button', { name: 'Scroll Animator' }).click()
    await page.waitForTimeout(500)

    const panel = page.locator('.sa-panel-tooltip')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Panel should intersect the viewport
    const rect = await panel.boundingBox()
    expect(rect).not.toBeNull()
    expect(rect!.y).toBeGreaterThanOrEqual(0)
    expect(rect!.y + rect!.height).toBeLessThan(10000) // well within viewport
  })

  test('Scroll Animator panel opens in viewport after scrolling to 50%', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    // Scroll first, then open
    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.5) })
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'Scroll Animator' }).click()
    await page.waitForTimeout(500)

    const panel = page.locator('.sa-panel-tooltip')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const rect = await panel.boundingBox()
    expect(rect).not.toBeNull()
    // Panel should be within the viewport (not pushed below by scroll offset)
    expect(rect!.y).toBeGreaterThanOrEqual(0)
    expect(rect!.y + rect!.height).toBeLessThan(800) // within viewport height
  })

  test('Scroll Animator panel opens in viewport after scrolling to 95%', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.95) })
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'Scroll Animator' }).click()
    await page.waitForTimeout(500)

    const panel = page.locator('.sa-panel-tooltip')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const rect = await panel.boundingBox()
    expect(rect).not.toBeNull()
    expect(rect!.y).toBeGreaterThanOrEqual(0)
    expect(rect!.y + rect!.height).toBeLessThan(800)
  })

  test('Scroll Animator panel closes on Escape', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    await page.getByRole('button', { name: 'Scroll Animator' }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('.sa-panel-tooltip')).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(page.locator('.sa-panel-tooltip')).not.toBeVisible()
  })

  test('Scroll Animator panel closes on outside click', async ({ page }) => {
    await startViewer(page)
    await page.waitForTimeout(2000)

    await page.getByRole('button', { name: 'Scroll Animator' }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('.sa-panel-tooltip')).toBeVisible()

    // Click on the canvas area (outside the panel)
    await page.locator('#app canvas').click({ position: { x: 400, y: 300 } })
    await page.waitForTimeout(300)
    await expect(page.locator('.sa-panel-tooltip')).not.toBeVisible()
  })
})
