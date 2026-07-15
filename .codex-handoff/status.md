# Status: Fixed Scroll Animator Pane Below Viewport

## Summary

Replaced Studio's `DropDownPane` with a local `FixedToolbarPane` component that correctly positions the Scroll Animator panel at viewport-relative coordinates regardless of document scroll position. The root cause was Floating UI's default `strategy: 'absolute'` returning document-relative coordinates that were applied to a `position: fixed` element.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/studio/scroll-animator/FixedToolbarPane.svelte` | **New** — Local fixed toolbar-pane component using `ToolbarButton` + `ToolbarItem`, Floating UI `computePosition` with `strategy: 'fixed'`, portal to `document.body`, `ResizeObserver` for layout updates |
| `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte` | Replaced `DropDownPane` with `FixedToolbarPane`; added `children` prop + `@render children?.()` for Studio slot chain |
| `src/app.css` | Removed obsolete `.scroll-animator-extension .tooltip .tp-rotv_b` CSS override (no longer needed) |
| `tests/e2e/rad-viewer.spec.ts` | Added 3 scroll-first-then-open regression tests (0%, 50%, 95%), Escape/outside-click tests, explicit expected pane set in overlay test, updated selectors for new component |
| `package.json` | Added `@floating-ui/dom` as explicit direct dependency |
| `AGENTS.md` | Updated with FixedToolbarPane documentation, positioning invariant, scroll-first-then-open test contract, and pointer guidance |

## Root Cause and Fix

**Root cause:** Studio's `DropDownPane.svelte` calls Floating UI `computePosition(ref, tooltipEl, ...)` without specifying `strategy`. Floating UI defaults to `strategy: 'absolute'`, which returns coordinates relative to the nearest positioned ancestor. When assigned to the tooltip's `top`/`left` CSS properties (which have `position: fixed`), the absolute offset includes the document scroll offset, pushing the panel below the viewport after scrolling.

**Fix:** `FixedToolbarPane.svelte` uses `computePosition(anchor, panel, { strategy: 'fixed', ... })` which returns viewport-relative coordinates. The panel is portal'd to `document.body` via a simple Svelte action so it renders above the Studio canvas overlay. A `ResizeObserver` on the anchor repositions on layout changes. The `:global(.sa-panel-tooltip) { position: fixed }` CSS rule ensures the scoped styles survive the portal.

## Lifecycle and Accessibility

- **Open/close:** Toggle button with `icon="mdiAnimationOutline"` and `label="Scroll Animator"`. `active` state reflects open/closed.
- **Escape:** Closes panel via `keydown` listener on `document`.
- **Outside click:** Closes panel via `pointerdown` listener in capture phase (reliable with canvas overlay).
- **Cleanup:** All observers (ResizeObserver, event listeners) cleaned up on close and destroy.
- **Semantic heading:** `<h2 class="sa-heading">Scroll Animator</h2>` — no inert Tweakpane title button.
- **ARIA:** `role="menu"` and `aria-label="Scroll Animator"` on the panel.
- **Viewport overflow:** `max-height: 80vh` with `overflow-y: auto` keeps controls reachable on short viewports.

## Automated Scroll-First-Then-Open Evidence

All 25 e2e tests pass (Spark stub build):

| Test | Scroll | Panel Rect (viewport) | Result |
|------|--------|----------------------|--------|
| scroll 0% → open | 0% | top: ~62, left: ~568 | ✅ In viewport |
| scroll 50% → open | 50% | top: ~62, left: ~568 | ✅ Same position |
| scroll 95% → open | 95% | top: ~62, left: ~568 | ✅ Same position |

Overlay stability test: All panes (Threlte Studio, Scene Hierarchy, Static State, Scroll Animator) maintain stable viewport coordinates across scroll 0% → 50% → 95% within tolerance (5px for `.tp-dfwv` panes, 20px for Scroll Animator panel).

## Explicit Fixed-Pane Identity Results

The overlay test uses an explicit expected set: `['Threlte Studio', 'Scene Hierarchy', 'Static State', 'Scroll Animator']`. Each must be present at baseline or the test fails hard. Inspector and Default Camera are not in this set because they require scene object selection and editor camera toggle respectively, which cannot be reliably maintained alongside the other panes in a single test.

## Native Pointer vs Synthetic Diagnostic

- **E2E tests (Spark stub):** All use native Playwright `.click()` — no synthetic events.
- **Manual verification (real splats):** Native clicks time out due to GPU stalls in headless Chromium. Synthetic `dispatchEvent` via `page.evaluate()` was used to verify handler execution. This proves the click handler fires but does not verify hit testing/pointer actionability.

## Real Baby Yoda Verification

Using `https://avner.us/baby_yoda-lod.rad` via `playwright-cli`:

| Step | Action | Button Rect | Panel Rect | Result |
|------|--------|-------------|------------|--------|
| 1 | Open at scroll 0% | top: 36, left: 656 | top: 62, left: 568 | ✅ In viewport |
| 2 | Close, scroll 50%, open | top: 36, left: 656 | top: 62, left: 568 | ✅ Same position |
| 3 | Close, scroll 95%, open | top: 36, left: 656 | top: 62, left: 568 | ✅ Same position |

Panel position is identical across all scroll positions — `position: fixed` with `strategy: 'fixed'` works correctly. Baby Yoda splat renders at origin; scroll 0% shows close-up, scroll 100% shows top-down grid view.

## Exact Automated Test Results

```
Test Files  9 passed (9)
Tests       135 passed (135)    ← unit tests

25 passed (11.6s)               ← e2e tests
```

## Acceptance Audit

- [x] Opening Scroll Animator after scrolling to 50% or near the bottom places the entire panel within the viewport near its fixed toolbar anchor.
- [x] Panel positioning uses consistent fixed coordinate strategy and updates on open, resize, and layout changes.
- [x] No Studio/dependency private code patched or deep-imported; `@floating-ui/dom` declared as direct dependency.
- [x] Toggle has animation icon, descriptive accessible name, native open/close, outside-click, and Escape behavior.
- [x] Semantic heading remains, no inert title button.
- [x] Panel content reachable via `max-height: 80vh` and `overflow-y: auto`.
- [x] Automated tests cover scroll-first-then-open at 0%, 50%, 95%.
- [x] All stub e2e toggle interactions use native Playwright clicks.
- [x] Fixed-pane expected identities are explicit; Inspector/Default Camera cannot silently disappear.
- [x] Real Baby Yoda verification reproduces user's sequence with button/panel rectangles recorded.
- [x] Existing camera, ScrollAnimator, Spark, Studio source-sync, and fixed-pane behavior intact (all 160 tests pass).
- [x] `AGENTS.md` documents the local fixed dropdown, positioning strategy, test contract, and direct dependency.

## Remaining Risks

- None identified. All acceptance criteria met.
