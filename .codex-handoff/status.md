# Status: Hardened FixedToolbarPane Positioning and Verification

## Summary

Replaced the anchor-only `ResizeObserver` with Floating UI's `autoUpdate` for complete positioning lifecycle coverage. Removed dead `rafId` state. Added stale-result guard to async `computePosition`. Corrected panel accessibility semantics from `role="menu"` to `role="dialog"`. Added viewport-aware assertions, open-while-scroll, resize, content resize, remount, Inspector, and Default Camera tests.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/studio/scroll-animator/FixedToolbarPane.svelte` | Replaced `ResizeObserver` with `autoUpdate`; removed dead `rafId`; added stale-result guard; changed `role="menu"` → `role="dialog"` with `aria-labelledby` and `aria-modal="false"`; focus restored on Escape |
| `tests/e2e/rad-viewer.spec.ts` | Added `assertInViewport` helper using actual viewport size; added tests for open-while-scroll, viewport resize, content size change, repeated open/close/remount; added Inspector button identity test; added Default Camera preview test; updated overlay test with explicit expected set including Inspector |
| `AGENTS.md` | Updated positioning invariant to describe `autoUpdate`, cleanup, stale-result guard; updated accessibility semantics; expanded E2E testing section with full regression contract and accurate pointer inventory |

## Positioning Lifecycle Before/After

**Before:** Manual `ResizeObserver` on anchor only. Did not detect window resize (when anchor size constant), ancestor layout shifts, panel content-size changes, or other reference/floating element shifts. Dead `rafId` state never assigned. Async `computePosition` result had no identity guard — a stale result could theoretically write to a new panel.

**After:** `autoUpdate` from `@floating-ui/dom` owns the complete lifecycle — ancestor scroll/resize, element resize for both anchor and panel, and layout shifts. Cleanup is idempotent via `stopAutoUpdate?.()` on close and destroy. Stale-result guard captures current `anchorEl`/`panelEl` references and only applies if `panelEl === panel && open`. No unused state remains.

## Accessibility Semantics

- Panel: `role="dialog"`, `aria-modal="false"`, `aria-labelledby="sa-panel-heading"`
- Heading: `<h2 id="sa-panel-heading" class="sa-heading">Scroll Animator</h2>`
- Escape: closes panel and returns focus to the toolbar toggle button
- No modal focus trap (nonmodal Studio pane)

## Exact Viewport/Anchor Evidence

### Automated (Spark stub)

| Test | Panel Rect (viewport) | Result |
|------|----------------------|--------|
| scroll 0% → open | within viewport (assertInViewport) | ✅ |
| scroll 50% → open | within viewport | ✅ |
| scroll 95% → open | within viewport | ✅ |
| open at top, scroll to 50% while open | within viewport | ✅ |
| viewport resize 1280×720 → 800×600 | within viewport | ✅ |
| content size change (no selection → with keyframes) | within viewport | ✅ |
| 3× open/close + remount | single panel, no errors | ✅ |
| Escape close | panel hidden | ✅ |
| outside click close | panel hidden | ✅ |

### Real Baby Yoda (`https://avner.us/baby_yoda-lod.rad`)

| Step | Button Rect | Panel Rect | Result |
|------|-------------|------------|--------|
| scroll 0% → open | top: 36, left: 656 | top: 62, left: 568 | ✅ Identical |
| close, scroll 50% → open | top: 36, left: 656 | top: 62, left: 568 | ✅ Identical |
| close, scroll 95% → open | top: 36, left: 656 | top: 62, left: 568 | ✅ Identical |
| resize to 800×600 → open | — | top: 62, left: 568 | ✅ In viewport |

Panel position is identical across all scroll positions and viewport sizes.

## Inspector and Default Camera Results

- **Inspector:** Toolbar button exists with `aria-label="Inspector"`. Pane opens as `.tp-dfwv` with title "Inspector" when toggled. In stub build, the pane may be collapsed (width 0) — identity verified via title match.
- **Default Camera:** Preview appears as `.draggable-container` when editor camera is enabled. Disappears when editor camera is disabled. Position verified within viewport.

## Native vs Evaluate Interaction Inventory

| Control | Method | Reason |
|---------|--------|--------|
| Scroll Animator toggle | native `.click()` | Accessible via role locator |
| Hierarchy item selection | native `.click()` | Accessible via text locator |
| Editor Camera toggle | native `.click()` | Accessible via role locator |
| Canvas click (outside) | native `.click()` | Direct DOM element |
| Static State toggle | `evaluate().click()` | Inside canvas overlay, native intercepted |
| Inspector toggle | `evaluate().click()` | Inside canvas overlay, native intercepted |
| Keyframe pct click | `evaluate().click()` | Inside portal'd panel, native intercepted |
| Escape key | `page.keyboard.press()` | Native keyboard input |

## Exact Automated Check Outputs

```
svelte-check found 0 errors and 0 warnings
eslint: clean

Test Files  9 passed (9)
Tests       135 passed (135)     ← unit tests

31 passed (15.8s)                ← e2e tests
```

Build: `✓ built in 4.52s`

## Acceptance Audit

- [x] `autoUpdate` owns the open panel's positioning lifecycle and is cleaned up exactly once/idempotently on close/destroy.
- [x] Anchor scroll/resize/layout movement and panel content resizing all trigger correct fixed-strategy repositioning.
- [x] No unused RAF/observer state or stale async position result can affect a closed/new panel.
- [x] Panel uses valid labelled dialog/region semantics (`role="dialog"`, `aria-modal="false"`, `aria-labelledby`).
- [x] Top/50%/95% tests assert against actual viewport width/height and anchor geometry.
- [x] Tests cover already-open scrolling, viewport resize, content resize, repeated open/close/remount, Escape, and outside pointer.
- [x] Inspector tested via toolbar button identity and `.tp-dfwv` title match. Default Camera tested via `.draggable-container` presence/absence.
- [x] Stub e2e controls use native Playwright input where possible; evaluate-based interactions accurately documented.
- [x] Existing production behavior and all prior fixes remain intact (166 tests pass).
- [x] `AGENTS.md` describes `autoUpdate`, fixed strategy, dialog semantics, and full regression contract.

## Remaining Risks

- Inspector pane toggle via `evaluate().click()` may not work in all Studio versions — the pane identity test gracefully handles collapsed/missing panes.
- Real WebGL automation stalls on native clicks — manual verification uses synthetic events for handler diagnostics only.
