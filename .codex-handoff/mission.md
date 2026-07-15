# Follow-up Mission: Fix Scroll Animator Opening Below the Viewport

## Objective

Fix the newly reproduced Scroll Animator dropdown-positioning bug: if the document is already scrolled, opening the Scroll Animator pane places it below the viewport instead of beneath the fixed toolbar. Preserve all completed camera, animation, Studio, Spark, and accessibility work. Add the missing open-after-scroll regression coverage and keep the final verification report precise about which interactions and panes were actually tested.

## Confirmed Root Cause

Installed Studio `DropDownPane.svelte` has an internal coordinate-strategy mismatch:

- its `.tooltip` element is CSS `position: fixed`;
- it calls Floating UI `computePosition(ref, tooltipEl, ...)` without a `strategy`;
- Floating UI therefore uses its default `strategy: 'absolute'` and returns document/absolute coordinates;
- after the page has scrolled, the returned `y` includes the document scroll offset;
- that document Y is assigned as `top` on a fixed-position element, pushing it below the viewport.

The previous test missed this because it opened the tooltip at scroll 0 and then scrolled while the already-positioned fixed tooltip remained open. The failure requires this sequence: **scroll first, then open**.

The `.tp-dfwv { position: fixed }` rule cannot fix this: the Scroll Animator tooltip is an inline `DropDownPane` tooltip, not a `.tp-dfwv` root.

## Files Likely Involved

- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte`
- A new local public-API component such as `src/lib/studio/scroll-animator/FixedToolbarPane.svelte`
- `src/app.css` for removal of obsolete DropDownPane-specific overrides
- `tests/e2e/rad-viewer.spec.ts`
- `package.json` and `package-lock.json` only if the app imports `@floating-ui/dom` directly
- `AGENTS.md`
- `.codex-handoff/status.md` as the final write

## Detailed Design

### 1. Replace the unconfigurable Studio dropdown locally

Studio's public `DropDownPane` does not expose Floating UI's `strategy`, so do not patch `node_modules`, deep-import its internals, or compensate with a hard-coded `top` value.

Preferred solution: create a small local fixed toolbar-pane component using only public Studio UI exports plus Floating UI:

- Use public `ToolbarButton` (inside the existing `ToolbarItem`) for the animation icon and toggle.
- Give the toggle a descriptive accessible label such as `Scroll Animator`, not the generic `Toggle Pane`; expose its open state when the public component API permits.
- Render the panel as `position: fixed` with a stable class/test marker and an appropriate accessible role/name.
- Position it with the matching fixed strategy:

```ts
computePosition(anchor, panel, {
  strategy: 'fixed',
  placement: 'bottom',
  middleware: [offset(2), flip(), shift({ padding: 6 })],
})
```

- Use `autoUpdate(anchor, panel, updatePosition)` while open, or equivalently install and clean up scroll/resize/layout observers. Position must update after opening, viewport resizing, toolbar movement, and content-size changes.
- Clean up every observer/listener when closed and on destroy.
- Close on outside pointer interaction and Escape. Keep toggle open/close behavior deterministic.
- Preserve the semantic `<h2>Scroll Animator</h2>`; do not recreate a generated inert title button.
- Keep the panel within the viewport. If content can exceed viewport height, give the panel a viewport-relative `max-height` and internal overflow scrolling rather than allowing controls to become unreachable.
- Preserve the `mdiAnimationOutline` icon and current panel contents/behavior.

If importing `@floating-ui/dom` directly in application code, add it as an explicit direct dependency at the installed compatible version and update the lockfile. Do not rely on Studio's transitive dependency.

An alternative local implementation is acceptable only if it uses viewport coordinates consistently, responds to resize/layout changes, is accessible, and does not depend on Studio private DOM internals. Do not use `top: 62px !important`, subtract `window.scrollY` after Studio positions the panel, or mutate the dependency-owned tooltip from outside.

### 2. Remove obsolete CSS and selectors

- Once the Studio `DropDownPane` is no longer used for Scroll Animator, remove the `.scroll-animator-extension .tooltip .tp-rotv_b/.tp-rotv_m` workaround if it is obsolete.
- Keep the global `.tp-dfwv` fixed-root rule for Studio's actual fixed panes.
- Use owned semantic class/data selectors for the new panel and tests. Avoid selectors coupled to private Tweakpane classes for the Scroll Animator panel.

### 3. Add the regression that reproduces the real bug

Add native Playwright tests with the Spark stub for all of these sequences:

1. At scroll 0, open the pane; assert it is visible, intersects the viewport, and is anchored beneath/near the toolbar button.
2. Close it, scroll to 50%, then open it; assert its viewport `top` is near the same anchor-relative location—not offset by `scrollY` and not below the viewport.
3. Close it, scroll near 95%, then open it; assert the same.
4. While it is open, scroll and resize; assert it stays anchored and visible.
5. Verify Escape and outside click close it and cleanup does not cause errors on remount.

Use native Playwright `.click()` in these stub e2e tests. Do not invoke the toggle via `page.evaluate(...element.click())`, `dispatchEvent`, `{ force: true }`, or optional fallbacks. The test must exercise hit testing/actionability.

The critical assertion is opening **after** scrolling. A test that only opens at the top and then scrolls is insufficient.

### 4. Retain strict fixed-pane coverage without overclaiming

Preserve the prior hard presence checks, but use an explicit expected set rather than deriving expectations solely from whatever happens to be open at baseline. A failed attempt to open Inspector must not remove Inspector from the expected list and let the test pass.

- In automated stub e2e, explicitly open and test toolbar, Scene Hierarchy, Inspector, Static State, Scroll Animator, and Default Camera where the installed build exposes them.
- If overlapping/transient dropdowns cannot remain open together, use separate focused tests rather than weakening identity checks.
- Keep required `.find()`/map lookups non-optional.
- Accurately distinguish native `.click()` calls from DOM clicks in evaluation. The current status says all automated controls use native clicks even though the overlay setup uses `btn?.click()` in `page.evaluate()`; correct either the tests or the claim.

### 5. Real Baby Yoda verification

Use `https://avner.us/baby_yoda-lod.rad` and reproduce the user's exact sequence:

1. Start at scroll top and confirm the panel opens in view.
2. Close it.
3. Scroll to 50%, open it, and record button/panel viewport rectangles.
4. Close it, scroll near the bottom, open it, and record again.
5. Confirm percentage input, keyframes, save/delete controls, and panel scrolling remain reachable.

Attempt normal pointer interaction first. If real WebGL automation stalls, report that separately; synthetic dispatch may diagnose handler execution but is not pointer evidence.

## Constraints

- Do not patch or deep-import `@threlte/studio`, `svelte-tweakpane-ui`, or their built files.
- Do not use a hard-coded viewport top/left correction or manual `scrollY` subtraction against dependency-owned DOM.
- Do not change ScrollAnimator interpolation, keyframes, runtime bridge, source synchronization, or transaction guard.
- Do not change GSAP/ScrollTrigger or its on-scroll-only transform updates.
- Do not change declarative camera ownership, CameraTarget look-at, CameraControls defaults/bridge, Spark renderers/LOD, or the user's URL-only origin `SparkSplats` API.
- Do not reintroduce free navigation.
- Do not broadly restyle unrelated Studio/Tweakpane UI.
- Do not weaken tests or infer untested panes from a shared CSS class.

## Acceptance Criteria

- [ ] Opening Scroll Animator after scrolling to 50% or near the bottom places the entire panel within the viewport near its fixed toolbar anchor.
- [ ] Panel positioning uses a consistent fixed coordinate strategy and updates on open, scroll, resize, and layout/content changes.
- [ ] No Studio/dependency private code is patched or deep-imported; any direct Floating UI use is declared as a direct dependency.
- [ ] Toggle has the animation icon, descriptive accessible name, native open/close behavior, outside-click behavior, and Escape behavior.
- [ ] The semantic heading remains and no inert title button returns.
- [ ] Panel content remains reachable on short viewports through max-height/overflow handling.
- [ ] Automated tests explicitly cover scroll-first-then-open at top/50%/95%, plus open-while-scroll/resize.
- [ ] Related stub e2e toggle interactions use native Playwright clicks.
- [ ] Fixed-pane expected identities are explicit; Inspector/Default Camera cannot silently disappear from expectations.
- [ ] Real Baby Yoda verification reproduces the user's sequence and records button/panel rectangles.
- [ ] Existing camera, ScrollAnimator, Spark, Studio source-sync, and fixed-pane behavior remains intact.
- [ ] `AGENTS.md` documents the local fixed dropdown, positioning strategy, test contract, and direct dependency if added.

Re-check every acceptance item before finalizing. Do not mark handler-level synthetic events as native pointer success and do not mark inferred panes as verified.

## Tests to Run

Add the new regression tests and run:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Also perform the real-browser scroll-first-then-open sequence with the lightweight Baby Yoda RAD.

## Things Pi Must Not Change

- The working declarative default camera and editor-camera switching.
- CameraTarget hierarchy/look-at behavior.
- ScrollAnimator schema, interpolation, playback, authoring, and source-write guard.
- CameraControls bridge values or attachment semantics.
- Spark dual-renderer/LOD routing and SparkSplats origin/API simplification.
- Unrelated application UI, dependencies, configuration, and tests.

## AGENTS.md Update

Update `AGENTS.md` concisely with:

- why Studio's `DropDownPane` was unsuitable on a scrollable document (absolute calculation applied to fixed tooltip);
- the local component/source reference and `strategy: 'fixed'`/auto-update invariant;
- the required scroll-first-then-open regression sequence;
- accurate native-versus-synthetic pointer guidance.

Do not add a chronological implementation log.

## Expected Completion Report

Write `.codex-handoff/status.md` with:

1. Summary and commits.
2. Files changed and dependency changes.
3. Root cause and chosen public/local implementation.
4. Lifecycle/accessibility/viewport-overflow behavior.
5. Automated scroll-first-open evidence with button/panel rectangles at top/50%/95% and resize.
6. Explicit fixed-pane identity results, including Inspector and Default Camera.
7. Native pointer versus synthetic diagnostic results stated accurately.
8. Real Baby Yoda reproduction results.
9. Exact automated test results.
10. Acceptance audit and remaining risks.

Always write `status.md` as the **last action** before committing and pushing. After writing it, do not run verification, modify documentation, or make any other changes. Commit all work and push the current branch.
