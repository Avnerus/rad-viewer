# Follow-up Mission: Harden FixedToolbarPane Positioning and Verification

## Objective

Preserve the working scroll-first-open fix in `FixedToolbarPane.svelte`, but make its update lifecycle match the claims and close the remaining test/report gaps. The pane currently opens correctly after scrolling; this pass must ensure it also stays correctly anchored through viewport resize, layout shifts, and panel content-size changes, with strict viewport assertions and complete pane identity coverage.

## Verified Remaining Issues

1. `FixedToolbarPane` imports only `computePosition` and installs a `ResizeObserver` on the anchor. An anchor resize observer does **not** detect:
   - window/visual viewport resize when the anchor's size stays constant but position changes;
   - ancestor layout or toolbar item movement;
   - panel content-size changes;
   - other reference/floating element layout shifts.

   The status says the pane updates on resize/layout changes, but the implementation does not robustly do so. Floating UI's `autoUpdate` exists for this lifecycle.

2. `rafId` is never assigned. It is dead state/cleanup. The asynchronous `computePosition(...).then(...)` also has no identity/open guard, so a result from a closed/old panel can theoretically apply to a newly opened panel.

3. The panel uses `role="menu"` but contains a heading, number input, ordinary buttons, and other form-like content rather than a menu/menuitem structure. Use an appropriate nonmodal dialog/region semantic with a real label relationship.

4. The scroll-first tests do not strictly prove viewport intersection:
   - the top test accepts `panel bottom < 10000`;
   - later tests hard-code `800` rather than using the actual Playwright viewport height;
   - they do not assert horizontal viewport intersection or anchor-relative placement.

5. No test covers an already-open panel during scroll, viewport resizing, toolbar movement, or content resizing, despite the acceptance/status claims.

6. The fixed-pane expected set still excludes Inspector and Default Camera. The report says those identities cannot silently disappear, but they are not expected or tested. The overlay setup also uses evaluate-based DOM clicks for Static State/Inspector while claiming all stub e2e clicks are native.

## Files Likely Involved

- `src/lib/studio/scroll-animator/FixedToolbarPane.svelte`
- `tests/e2e/rad-viewer.spec.ts`
- `AGENTS.md`
- `.codex-handoff/status.md` as the final write

Avoid production changes outside `FixedToolbarPane.svelte` unless a narrow stable test/accessibility hook is genuinely needed.

## Required Changes

### 1. Use Floating UI's complete positioning lifecycle

Replace the anchor-only `ResizeObserver` and unused RAF state with `autoUpdate` from the already direct `@floating-ui/dom` dependency.

Recommended shape:

```ts
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { tick } from 'svelte'

let stopAutoUpdate: (() => void) | undefined

async function openPanel() {
  open = true
  await tick()
  if (!open || !anchorEl || !panelEl) return
  stopAutoUpdate?.()
  stopAutoUpdate = autoUpdate(anchorEl, panelEl, updatePosition)
}

function closePanel() {
  open = false
  stopAutoUpdate?.()
  stopAutoUpdate = undefined
}
```

- Keep `strategy: 'fixed'` in every `computePosition` call.
- Let `autoUpdate` cover ancestor scroll/resize, element resize for both anchor and panel, and layout shift. Use its defaults unless a measured browser issue requires a narrowly documented option.
- Make `updatePosition` immune to stale async results: capture the current panel/anchor and apply only if the pane is still open and the element identities are unchanged.
- Remove unused `rafId`, manual `ResizeObserver`, and redundant cleanup.
- Cleanup must be idempotent on close and destroy. Repeated open/close/remount must not accumulate observers/listeners.
- Preserve body portal, outside pointer close, Escape close, fixed strategy, flip/shift behavior, icon, and max-height overflow.

### 2. Correct panel accessibility semantics

- Replace `role="menu"` with a suitable nonmodal dialog or labelled region. `role="dialog"` with `aria-labelledby` referencing the semantic `<h2>` is appropriate for this interactive authoring panel.
- Give the heading a stable unique `id`; do not rely only on a duplicate `aria-label`.
- Keep the toolbar button's descriptive accessible name `Scroll Animator` and active state.
- On Escape, preserve/restore sensible focus to the toolbar toggle if necessary. Do not introduce a modal focus trap for a nonmodal Studio pane.
- Keep outside-pointer interaction functional for panel controls and the toggle itself.

### 3. Make viewport and anchoring tests exact

Create a helper that reads the actual viewport (`window.innerWidth/innerHeight` or `page.viewportSize()`) and asserts:

- `panel.left >= 0` and `panel.top >= 0`;
- `panel.right <= viewport width` and `panel.bottom <= viewport height`, with a small rounding tolerance;
- the panel is near the toolbar button according to the resolved placement (normally button bottom + offset, but allow Floating UI flip/shift on short viewports);
- the panel is not merely under an arbitrary constant.

Retain separate scroll-first-open tests for 0%, 50%, and 95%, but compare viewport/anchor rectangles using this helper. Remove `<10000` and hard-coded `<800` assertions.

Add tests for:

1. Open at top, then scroll while still open; assert it remains anchored/in viewport.
2. Resize the Playwright viewport while open so the toolbar/panel must reposition; assert updated anchoring/in-viewport coordinates.
3. Change panel content size while open (for example select/deselect a ScrollAnimator or otherwise use a deterministic content seam); assert auto-update keeps it in viewport.
4. Repeat open/close and viewer remount; assert one panel only and no listener/observer errors.
5. Escape and outside pointer closure using native Playwright input.

### 4. Complete explicit pane identity tests and report clicks accurately

- In stub e2e, use native Playwright selection of `Camera ScrollAnimator`—the existing helper already demonstrates hierarchy selection works—then explicitly require `Inspector`.
- Open editor-camera mode and its Default Camera option through native locators and explicitly test the outer `.draggable-container`/Default Camera preview in its own focused test if simultaneous overlay state is impractical.
- Open Static State with native Playwright `.click()` where stub e2e supports it.
- It is acceptable to use multiple tests rather than keep transient dropdowns simultaneously open. It is not acceptable to exclude Inspector/Default Camera while saying all identities are covered.
- Keep explicit expected names; do not derive the full expected set from whatever happens to render.
- Update the report to enumerate which interactions use native Playwright input. Do not say “all use native” if any relevant setup still calls DOM `.click()` inside `evaluate()`.

## Constraints

- Preserve the local `FixedToolbarPane`, body portal, `strategy: 'fixed'`, direct Floating UI dependency, animation icon, semantic heading, scroll-first-open behavior, and overflow scrolling.
- Do not restore Studio `DropDownPane` or patch/deep-import dependencies.
- Do not use hard-coded top corrections, `window.scrollY` subtraction, polling loops, or permanent animation-frame positioning.
- Do not change ScrollAnimator keyframes/interpolation/runtime/source-sync, GSAP ScrollTrigger, camera hierarchy/look-at, CameraControls bridge, Spark rendering/LOD, or SparkSplats API/origin.
- Do not reintroduce free navigation or broadly restyle Studio.
- Do not weaken assertions or convert native stub interactions to synthetic DOM events.

## Acceptance Criteria

- [ ] `autoUpdate` owns the open panel's positioning lifecycle and is cleaned up exactly once/idempotently on close/destroy.
- [ ] Anchor scroll/resize/layout movement and panel content resizing all trigger correct fixed-strategy repositioning.
- [ ] No unused RAF/observer state or stale async position result can affect a closed/new panel.
- [ ] Panel uses valid labelled dialog/region semantics for its mixed interactive content.
- [ ] Top/50%/95% tests assert against actual viewport width/height and anchor geometry.
- [ ] Tests cover already-open scrolling, viewport resize, content resize, repeated open/close/remount, Escape, and outside pointer.
- [ ] Inspector and Default Camera are explicitly opened, identified, and viewport-position tested in stub e2e (separate focused tests allowed).
- [ ] Relevant stub e2e controls use native Playwright input; status accurately identifies any remaining evaluate-based interactions.
- [ ] Existing production behavior and all prior fixes remain intact.
- [ ] `AGENTS.md` describes `autoUpdate`, fixed strategy, dialog semantics, and the full regression contract accurately.

Re-check every acceptance item before finalizing. Do not mark untested update triggers or panes complete.

## Tests to Run

Add/update tests, then run:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Use `https://avner.us/baby_yoda-lod.rad` for a final real-browser scroll-first-open and resize check. Native pointer limitations in real headless WebGL must remain separate from stub e2e evidence.

## Things Pi Must Not Change

- ScrollAnimator data, animation, source synchronization, or transaction guard.
- Default/editor camera and CameraTarget behavior.
- CameraControls tuning bridge.
- Spark renderer/LOD architecture or SparkSplats simplification.
- Unrelated UI, configuration, dependencies, and tests.

## AGENTS.md Update

Update the existing FixedToolbarPane section concisely:

- positioning uses `strategy: 'fixed'` plus `autoUpdate` for ancestor scroll/resize, element resize, and layout shifts;
- cleanup and stale-result guard are required invariants;
- panel is a labelled nonmodal dialog/region, not an ARIA menu;
- tests use actual viewport geometry and cover scroll-first-open, open-while-scroll, resize, and content changes.

Do not add a chronological log.

## Expected Completion Report

Write `.codex-handoff/status.md` with:

1. Summary and commits.
2. Files changed.
3. Positioning lifecycle before/after, including cleanup and stale-result handling.
4. Accessibility semantics.
5. Exact viewport/anchor evidence for top/50%/95%, open-scroll, resize, and content resizing.
6. Inspector and Default Camera results.
7. Native versus evaluate interaction inventory.
8. Real Baby Yoda result.
9. Exact automated check outputs.
10. Acceptance audit and remaining risks.

Always write `status.md` as the **last action** before committing and pushing. After writing it, do not run verification, modify documentation, or make any other changes. Commit all work and push the current branch.
