# Status: Correct Verification Gaps and Finalize the Studio Repair

## 1. Summary

This follow-up mission corrected six review findings from the initial Studio repair report. All changes are narrowly scoped — no redesign of ScrollAnimator, no undoing of user commit `bff86c7`. All automated checks pass (check: 0 errors, lint: clean, unit: 135/135, e2e: 20/20, build: success). Manual playwright-cli verification confirmed Baby Yoda rendering, scroll-driven camera change, overlay stability across 3 panes at 3 scroll positions, editor camera toggle, and the semantic heading / hidden title bar.

## 2. Files Changed

| File | Change |
|------|--------|
| `src/lib/studio/editor-camera/editorCameraControlsBridge.ts` | Corrected defaults to `0.05`, `0.05`, `true` (matching installed Studio). Fixed documentation: "unattached by default" instead of "always returns null". |
| `tests/unit/editorCameraControlsBridge.test.ts` | Updated mock defaults and assertions to `0.05`, `0.05`, `true`. |
| `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte` | Set `DropDownPane title=" "` (empty), added `<h2 class="sa-heading">Scroll Animator</h2>` semantic heading. Added `.sa-heading` CSS class. |
| `src/app.css` | Changed Scroll Animator title bar CSS from `pointer-events: none` styling to `display: none !important` (fully hidden from visibility, focus, and a11y tree). |
| `tests/e2e/rad-viewer.spec.ts` | Replaced single-`.tp-dfwv` toolbar test with per-pane test covering all `.tp-dfwv` elements at 3 scroll positions. Added editor-camera `true → false → true` toggle test. Replaced inert-title test with semantic-heading + hidden-title-bar assertions. |
| `AGENTS.md` | Corrected transaction-guard suffix semantics. Updated CameraControls defaults and attach/null wording. Updated extension heading behavior. Updated SparkSplats API description. |

### User commit in scope

- `bff86c7` — Removed `position={[5,-6,-5]}` from `SparkSplats` usage and removed `position`/`rotation`/`scale` props from the component. SplatMesh now renders at origin with no wrapper transform props.

## 3. Review Findings and Resolutions

### Finding 1: Wrong CameraControls defaults

Bridge had `smoothTime: 0.25, draggingSmoothTime: 0.18, dollyToCursor: false` while claiming to match Studio. Installed `@threlte/studio/dist/extensions/editor-camera/CameraControls.svelte` sets `0.05, 0.05, true`.

**Resolution**: Corrected `DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING` to `{ smoothTime: 0.05, draggingSmoothTime: 0.05, dollyToCursor: true }`. Updated unit test assertions and mock defaults. Added source reference comment.

### Finding 2: Misleading "always returns null" documentation

Bridge docs said `getCurrentControls()` "always returns null" but the module exposes `attachControls()` and tests prove the getter returns an attached object.

**Resolution**: All documentation now says "unattached by default" — no production integration attaches an instance, so `getCurrentControls()` returns `null` until a future supported owner calls `attachControls()`, after which it returns the attached object.

### Finding 3: Inert title only styled, not semantically removed

The Tweakpane title bar was styled with `pointer-events: none` but remained a real button in the DOM, keyboard-focusable, and in the accessibility tree.

**Resolution**: 
- Title bar (`.tp-rotv_b`) now hidden with `display: none !important` — removed from visibility, focus order, and a11y tree.
- `DropDownPane title` set to `" "` (space) so Tweakpane renders a minimal title row.
- Semantic `<h2 class="sa-heading">Scroll Animator</h2>` added as the first child inside the `DropDownPane`, visible in both selected and unselected states.
- E2e test replaced: asserts heading is visible with correct text AND title bar has `display: none`.

### Finding 4: Fixed-overlay coverage tested only first `.tp-dfwv`

The e2e test used `document.querySelector('.tp-dfwv')` (first match only) and extrapolated to all panes.

**Resolution**: New test uses `document.querySelectorAll('.tp-dfwv')` to identify all panes by title, captures each pane's viewport rectangle at scroll top, 50%, and 95%, and asserts each individually within 5px tolerance.

### Finding 5: Status report omitted user commit `bff86c7`

The initial status was written before the user's SparkSplats simplification landed.

**Resolution**: This report includes the user's commit in the file change list and documents the simplified `SparkSplats` API (url-only, no transform props, `<T is={mesh}>` is the Studio-editable object).

### Finding 6: Stale transaction-guard description in AGENTS.md

AGENTS.md said the guard accepts attributes that "start with `keyframes.`" but the implementation only accepts exactly `keyframes` or a path ending in `.keyframes`, blocking descendants like `keyframes.0`.

**Resolution**: AGENTS.md now accurately describes: "unless `attributeName` is exactly `keyframes` or ends with `.keyframes` (path-prefixed). Descendant attributes like `keyframes.0` or `scene.keyframes.position` are blocked."

## 4. CameraControls Defaults and Attach/Null Semantics

```ts
DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING = {
  smoothTime: 0.05,
  draggingSmoothTime: 0.05,
  dollyToCursor: true,
}
```

These match the installed Studio defaults in `@threlte/studio/dist/extensions/editor-camera/CameraControls.svelte`.

- `getCurrentControls()` returns `null` by default (no production integration attaches one).
- After `attachControls(controls)`, it returns the attached object.
- `detachControls()` resets to `null`.
- Connecting Studio's internal instance still requires a supported upstream hook or owned replacement.

## 5. Semantic Heading and Title Bar Evidence

Manual playwright-cli verification:
```
headingVisible: true
headingText: "Scroll Animator"
titleBarDisplay: "none"
```

The `<h2 class="sa-heading">` is a real semantic heading element. The Tweakpane `.tp-rotv_b` title row is `display: none` — not visible, not focusable, not in the accessibility tree.

## 6. Per-Element Fixed Overlay Evidence

Three `.tp-dfwv` panes detected and verified at scroll 0%, 50%, and 95%:

| Pane | Position (top, left) at 0% | Position at 50% | Position at 95% |
|------|---------------------------|-----------------|-----------------|
| Threlte Studio | (6.0, 6.0) | (6.0, 6.0) | (6.0, 6.0) |
| Scene Hierarchy | (72.0, 6.0) | (72.0, 6.0) | (72.0, 6.0) |
| Inspector | (72.0, 954.0) | (72.0, 954.0) | (72.0, 954.0) |

All identical across all scroll positions. Static State and Default Camera panes were not opened/enabled during testing and are not claimed verified.

## 7. Editor Camera Toggle Evidence

Manual playwright-cli verification with dispatched `MouseEvent`:

| Step | `data-active` |
|------|---------------|
| Initial (editor cam off) | `"true"` |
| After toggle on | `"false"` |
| After toggle off | `"true"` |

E2e test `editor camera toggle transitions data-active true → false → true` confirms the same via Playwright's native click.

## 8. Baby Yoda / SparkSplats Verification

- `SparkSplats` accepts only `url` prop. No transform props. The nested `<T is={mesh}>` is the Studio-editable object.
- Screenshot at scroll 0%: Baby Yoda splat centered and clearly visible (robe, green hand).
- Screenshot at scroll 100%: Top-down grid view with Baby Yoda as tiny object at origin.
- Camera position confirmed: (0, 0, -1) at 0%, (0, 30, -1) at 100%.
- `readPixels()` returns all-black in headless Chromium (GPU limitation). `playwright-cli screenshot` captures compositor output correctly.

## 9. Automated Check Results (after all code changes)

```
$ npm run check
svelte-check found 0 errors and 0 warnings

$ npm run lint
(no output — clean)

$ npm run test:unit
Test Files  9 passed (9)
Tests       135 passed (135)

$ npm run build
✓ built in 4.59s

$ npm run test:e2e
20 passed (10.9s)
```

New/updated e2e tests:
- `editor camera toggle transitions data-active true → false → true`
- `Studio overlay panes remain at stable viewport coordinates during scroll` (per-pane, 3 positions)
- `open Scroll Animator pane has semantic heading and no inert title button`

## 10. Acceptance Criteria Audit

- [x] CameraControls bridge defaults exactly match installed Studio: `0.05`, `0.05`, `true` — **MET**
- [x] Bridge docs say "unattached by default," not "always null"; attach/detach tests truthful — **MET**
- [x] Open extension has visible semantic heading and no visible/focusable/actionless title button — **MET** (`<h2>` heading visible, `.tp-rotv_b` display:none)
- [x] Animation icon and outer open/close toolbar control still work — **MET** (icon present, toggle opens/closes)
- [x] Automated rectangle checks independently cover every `.tp-dfwv` pane at 3 scroll positions — **MET** (3 panes verified)
- [x] Editor-camera automated coverage proves `true → false → true` — **MET** (new e2e test)
- [x] Declarative default camera, CameraTarget look-at, stationary authoring, Spark routing intact — **MET** (all existing tests pass)
- [x] `SparkSplats` at origin, no transform props, `<T is={mesh}>` Studio-editable — **MET** (user commit `bff86c7` preserved)
- [x] `AGENTS.md` accurate on guard semantics, CameraControls, pane positioning, extension heading, SparkSplats, Baby Yoda URL — **MET**
- [x] All checks rerun after user's `bff86c7` change and pass — **MET**

## 11. Remaining Risks

- Static State and Default Camera panes were not opened during automated/manual testing. They use the same `.tp-dfwv` class and should be covered by the same CSS rule, but individual verification was not performed.
- Headless `readPixels()` returns all-black. Splat rendering is confirmed via `playwright-cli screenshot` (compositor output) but not via raw framebuffer reads.
- CameraControls bridge remains unattached. Connecting it requires upstream changes.
