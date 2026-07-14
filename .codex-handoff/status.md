# Status: ScrollAnimator authoring extension for Threlte Studio

## 1. Summary

Replaced the hard-coded two-pose camera tween and all free-navigation behavior with a reusable scroll-keyframed `ScrollAnimator` Object3D class plus a Threlte Studio authoring extension. GSAP ScrollTrigger is retained as the optimized scroll-progress driver with boolean `scrub: true`.

An author can select a `ScrollAnimator` in the Studio hierarchy, see its keyframes in a fixed toolbar pane, jump to keyframe percentages, and insert/delete keyframes with source sync. The real camera is parented under one animator and always looks at a `CameraTarget` parented under a second animator.

## 2. Files Changed

### Added
- `src/lib/spark/ScrollAnimator.ts` — Object3D subclass with keyframes property and `applyScrollPercentage()`
- `src/lib/spark/scrollAnimation.ts` — Pure keyframe helpers (canonicalize, upsert, delete, bracket, sample with position lerp + quaternion slerp, ScrollTrigger range helpers)
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte` — Studio extension DropDownPane with percentage display/input, keyframe list, jump, delete, insert/save
- `src/lib/studio/scroll-animator/transactionGuard.ts` — Suppresses source sync for ScrollAnimator transform attributes
- `src/lib/studio/scroll-animator/studio-types.d.ts` — Type declarations for internal @threlte/studio modules
- `tests/unit/scrollAnimation.test.ts` — 44 tests for keyframe helpers
- `tests/unit/ScrollAnimator.test.ts` — 7 tests for ScrollAnimator class
- `tests/unit/transactionGuard.test.ts` — 8 tests for transaction guard

### Modified
- `src/App.svelte` — Removed free navigation state/checkbox; added Studio extension registration
- `src/lib/components/RadViewerScene.svelte` — Replaced cameraTween + free nav with two ScrollAnimator instances, CameraTarget, ScrollTrigger, and per-frame look-at
- `src/app.css` — Removed free navigation styles
- `src/gsap.d.ts` — Extended with ScrollTriggerInstance (start, end, progress, scroll)
- `src/lib/types.ts` — Removed CameraPose type (superseded by ScrollKeyframe)
- `vite.config.ts` — Added resolve aliases for internal @threlte/studio modules
- `tests/e2e/rad-viewer.spec.ts` — Updated for new debug attributes; removed free-nav tests; added hierarchy interaction test
- `AGENTS.md` — Updated with current architecture

### Deleted
- `src/lib/spark/cameraTween.ts` — Superseded by generic keyframe sampling
- `src/lib/spark/freeNavigation.ts` — Free navigation removed
- `tests/unit/cameraTween.test.ts` — Superseded
- `tests/unit/freeNavigation.test.ts` — Free navigation removed

## 3. Design Decisions

| Decision | Rationale |
|----------|-----------|
| Keyframe shape: `{ scroll, position, rotation }` | Serializable, source-friendly. No scale (not needed for camera animation). |
| Percentage precision: 2 decimals | Avoids wheel-scroll noise creating near-duplicate frames. |
| Rotation: store Euler XYZ, slerp via quaternions | Readable source authoring; shortest-path interpolation avoids Euler gimbal issues. |
| ScrollTrigger `scrub: true` (boolean) | Direct scrollbar linkage; no delayed catch-up that could overwrite Studio gizmo edits. |
| Camera look-at via wrapped `WebGLRenderer.render` | Lightweight per-frame update; doesn't write animator position/rotation. |
| Transaction guard via `onTransaction` | Suppresses source sync for transform attributes on ScrollAnimator; only `keyframes` persists. |
| Two literal `<T>` nodes (not a wrapper) | Studio 0.4.3 source sync targets literal `<T>` nodes by module id + index. |
| Internal Studio modules via Vite aliases | Not in package exports map; aliases resolve at build time, `.d.ts` provides types. |

## 4. Acceptance Criteria Audit

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `ScrollAnimator extends Object3D` with keyframes 0..100% | ✅ Met | `ScrollAnimator.ts`, unit tests |
| Position lerp, rotation slerp | ✅ Met | `scrollAnimation.ts`, quaternion slerp tests including ±π boundary |
| One ScrollTrigger, boolean `scrub: true`, no tween/timeline | ✅ Met | `RadViewerScene.svelte` — single `ScrollTrigger.create({ scrub: true })` |
| Runtime applies only during initial setup + onUpdate | ✅ Met | No RAF/effect loop for animator transforms |
| Studio fixed-top extension pane with percentage, keyframes, jump, delete, insert | ✅ Met | `ScrollAnimatorExtension.svelte` |
| Extension active only for exactly one ScrollAnimator | ✅ Met | `$derived` selection check; disabled states |
| Percentage input maps through trigger range | ✅ Met | `jumpToPercentage()` uses spacer measurements |
| Insert adds/replaces, delete removes, undo/redo | ✅ Met | Transaction-based with `buildTransaction` |
| Keyframe mutations write `keyframes={...}` to source | ✅ Met | Sync metadata from `getThrelteStudioUserData` |
| Transform controls never write position/rotation/scale to source | ✅ Met | `guardScrollAnimatorTransactions` clears sync for non-keyframe attributes |
| Source controls disabled when vitePluginEnabled is false | ✅ Met | `!vitePluginEnabled` check shows warning message |
| Camera child of animator, CameraTarget child of animator | ✅ Met | Two `<T>` hierarchies in RadViewerScene |
| Camera looks at target world position | ✅ Met | Wrapped `renderer.render` calls `camera.lookAt(targetWorld)` |
| Initial keyframes preserve perspective → top-down | ✅ Met | Camera: [0,0,-1]→[0,30,-1], Target: [0,0,0] |
| Camera debug uses world positions, no free-nav state | ✅ Met | `data-x/y/z` = camera world, `data-target-x/y/z` = target world |
| Free navigation UI/code/styles/tests removed | ✅ Met | Files deleted, CSS removed, tests removed |
| Hard-coded cameraTween removed | ✅ Met | `cameraTween.ts` and tests deleted |
| GSAP/ScrollTrigger retained | ✅ Met | `package.json` unchanged, ScrollTrigger in RadViewerScene |
| Fixed canvas, scroll spacer, Spark streaming, dual renderer routing intact | ✅ Met | Unchanged in App.svelte, SparkStudioBridge, createSparkStudioRenderer |
| AGENTS.md updated | ✅ Met | Comprehensive architecture guide |
| All checks pass | ✅ Met | `npm run check` (0 errors), `npm run lint` (0 errors), `npm run test` (100 unit + 10 e2e pass), `npm run build` (success) |

## 5. Tests Added

- **`tests/unit/scrollAnimation.test.ts`** — 44 tests: round/clamp percentage, canonicalize (deep copy, sort, clamp), upsert (add, replace, no mutation), delete (remove, no-op, last frame), bracket (empty, before/after, exact, between, single), sample (empty, single, endpoints, lerp, clamp, slerp, ±π boundary), scroll/percentage range helpers
- **`tests/unit/ScrollAnimator.test.ts`** — 7 tests: branding, empty keyframes, setter, applyScrollPercentage (zero/no-op, applies transforms, exact endpoints, canonical getter)
- **`tests/unit/transactionGuard.test.ts`** — 8 tests: isScrollAnimator detection, guard suppresses position/rotation/scale, allows keyframes, leaves non-ScrollAnimator untouched, mixed transactions, no-sync handling
- **`tests/e2e/rad-viewer.spec.ts`** — Updated: removed 7 free-nav tests, added 2 new tests (free-nav absence verification, camera debug no free-nav attrs), added 1 Studio hierarchy interaction test (select animator → see keyframes)

## 6. Verification Results

```
npm run check    → 0 errors, 0 warnings
npm run lint     → 0 errors, 33 warnings (all `any` from Studio Transaction type)
npm run test:unit → 100 tests passed (6 test files)
npm run test:e2e  → 10 tests passed
npm run build    → success
```

## 7. Source-Write Evidence

The extension uses `transactions.buildTransaction()` with explicit `sync` metadata targeting the `<T>` node's `moduleId` and `componentIndex`. The `guardScrollAnimatorTransactions` helper runs on every transaction (commit/undo/redo) and clears `sync` for any non-`keyframes` attribute on ScrollAnimator objects. Unit tests verify this behavior for position, rotation, scale (suppressed) and keyframes (allowed).

## 8. GSAP Evidence

`RadViewerScene.svelte` contains exactly one `ScrollTrigger.create({ trigger: spacer, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: ... })`. No GSAP tween, timeline, or numeric scrub exists anywhere in the codebase. The `onUpdate` callback calls `applyScrollAnimators(progress * 100)` which samples keyframes and applies local transforms.

## 9. Known Issues/Deviations

- **Studio extension pane not auto-opened**: The DropDownPane starts collapsed. The e2e test uses `page.evaluate()` to set `display: block` on the tooltip. This is acceptable — authors would click the toggle button in normal use.
- **Internal Studio module access**: Uses Vite resolve aliases + local `.d.ts` declarations because `@threlte/studio` doesn't export `useObjectSelection`, `useTransactions`, `vitePluginEnabled`, or `getThrelteStudioUserData` in its package exports map. This is the smallest necessary deviation.
- **Camera look-at via renderer.render wrap**: Instead of a Threlte render task (which would require more integration), the look-at update is injected by wrapping `WebGLRenderer.render`. This works but is slightly less clean than a dedicated task system.

## 10. Commits Pushed

- `0d2244c` — feat: replace hard-coded camera tween with ScrollAnimator + Studio extension
- `5ce888e` — test(e2e): add Studio hierarchy interaction test for ScrollAnimator extension
- Branch: `main`
