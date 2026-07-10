# Status Report

## Summary
Follow-up mission completed. Fixed three bugs in free navigation and added scroll-to-zoom:

1. **Keyboard navigation broken in browser** — `shouldHandleKeyEvent` blocked all `<input>` elements, including the free-nav checkbox itself. After clicking the checkbox, it retained focus and all WASD keys were silently ignored. Fixed by filtering only text-input types (`text`, `password`, `search`, `email`, `url`, `tel`, `number`) while allowing `checkbox` and `radio`. Also added `tabindex="-1"` and `onblur` on the checkbox to return focus to `<body>`.

2. **Mouse-look yaw not accumulating** — `applyLookAt()` created a fresh `Euler(0,0,0)` each call and applied only the current `deltaYaw`, ignoring cumulative yaw. Replaced with two clean functions: `updateLookAngles()` (pure math returning cumulative `[yaw, pitch]` with clamped pitch) and `applyLook()` (applies absolute yaw/pitch to camera quaternion via YXZ Euler).

3. **Scroll-to-zoom** — Added `applyZoom()` helper and `wheel` event listener. Positive `deltaY` (scroll down) decreases FOV (zoom in), negative increases FOV (zoom out). Clamped to `minFov`/`maxFov` (10°–90°). FOV resets to 60° on free nav exit.

## Files Changed
- `src/lib/spark/freeNavigation.ts` — Fixed `shouldHandleKeyEvent` for checkbox/radio; replaced `applyLookAt` with `updateLookAngles` + `applyLook`; added `applyZoom`; added `zoomSensitivity`, `minFov`, `maxFov` to config
- `src/lib/components/RadViewerScene.svelte` — Uses new `updateLookAngles`/`applyLook` API; added `handleWheel` for zoom; added `data-yaw`, `data-pitch`, `data-zoom` debug attributes; FOV reset on exit
- `src/App.svelte` — Added `tabindex="-1"` and `onblur` to checkbox; updated hint text
- `tests/unit/freeNavigation.test.ts` — 37 tests: checkbox/radio filtering, yaw accumulation, pitch clamping, zoom clamping, identity quaternion
- `tests/e2e/rad-viewer.spec.ts` — 15 tests: mouse yaw/pitch verification, zoom in/out, zoom disabled when free nav off
- `AGENTS.md` — Updated free navigation section with zoom, new function signatures, checkbox focus handling
- `README.md` — Updated feature list and usage instructions

## Implementation Notes
- The `updateLookAngles`/`applyLook` split follows the pattern suggested in the mission brief: pure math for angle updates, separate function for camera application. This keeps yaw/pitch fully cumulative and testable.
- The `applyZoom` formula is `newFov = camera.fov - scrollDelta * sensitivity`. Positive `deltaY` (scroll down toward bottom of page) decreases FOV (zoom in). Negative `deltaY` (scroll up) increases FOV (zoom out). This matches the convention where scrolling "toward" content zooms in.
- The `pressedKeys` Set is no longer wrapped in `$state()` — it's a plain Set mutated directly, which avoids any Svelte proxy overhead in the hot rAF path.

## Acceptance Criteria
- [x] Mouse-look yaw accumulates correctly across repeated mouse movement
- [x] Pitch remains clamped
- [x] Keyboard movement uses the same yaw orientation that mouse look applies
- [x] E2E verifies mouse movement changes orientation state (yaw/pitch), not only that free nav remains enabled
- [x] Existing e2e still verifies keyboard movement changes camera position when free nav is enabled
- [x] Existing e2e still verifies scroll-driven camera tween works when free nav is disabled
- [x] Tests cover the updated free-navigation math (37 unit tests, 15 e2e tests)
- [x] Scroll-to-zoom added and tested
- [x] Status report metadata is accurate

## Tests Run
- `npm run check` - 0 errors, 0 warnings
- `npm run lint` - clean (0 errors, 0 warnings)
- `npm run test:unit` - 64 tests passed (4 test files)
- `npm run test:e2e` - 15 tests passed
- `npm run build` - built successfully

## Known Issues / Follow-ups
- The `state_referenced_locally` Svelte compiler warnings in `SparkSplats.svelte` (about `profile.sparkRenderer.*` references) are pre-existing and suppressed in the `svelte-check` config. They are harmless because the SparkRenderer options are built once in `onMount` and never change.
- No transform-prop e2e test was added. The Spark stub `SplatMesh` extends `THREE.Object3D` but Threlte's `<T>` component internals are not easily accessible from e2e without brittle DOM probing. The declarative transform API is verified through TypeScript type checking (`npm run check`) and the unit test coverage of the component's prop defaults.

## Commit / Push
- Branch: main
- Verified prior implementation commit: 22a0f84
- Follow-up commit: 5b33240
- Pushed: no (pending)
