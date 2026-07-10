# Status Report

## Summary
Implemented declarative splat transform props on `<SparkSplats>` and added a single "Free navigation" checkbox that enables both mouse-driven camera look and first-person WASD/arrow keyboard movement. All acceptance criteria met.

Key changes:
- Removed hardcoded `mesh.position.set(12, 1, 17)` from `SparkSplats.svelte`
- `SplatMesh` is now owned by Threlte `<T is={mesh} {position} {rotation} {scale} />` for declarative transforms
- `SparkRenderer` remains imperative (renderer infrastructure)
- Single checkbox in `App.svelte` (outside `<Canvas>`) toggles free navigation
- Free navigation logic extracted into pure, unit-testable functions in `freeNavigation.ts`
- ScrollTrigger is killed on free nav entry, re-created on exit with camera restored to last scroll pose

## Files Changed
- `src/lib/components/SparkSplats.svelte` — Declarative transform props (`position`, `rotation`, `scale`), `<T>` ownership of SplatMesh
- `src/lib/components/RadViewerScene.svelte` — Receives `freeNavEnabled` prop, `$effect` for mode switching, keyboard/mouse handlers, rAF movement loop
- `src/App.svelte` — Owns `freeNavEnabled` state, renders checkbox outside `<Canvas>`, passes prop to RadViewerScene
- `src/lib/spark/freeNavigation.ts` — New: pure functions for movement, yaw/pitch, key handling
- `src/app.css` — Styles for `.free-nav-toggle`, `.free-nav-label`, `.free-nav-checkbox`, `.free-nav-hint`
- `tests/unit/freeNavigation.test.ts` — New: 26 unit tests for free navigation math
- `tests/e2e/rad-viewer.spec.ts` — Added 6 free navigation e2e tests, updated existing tests
- `AGENTS.md` — Updated architecture docs with new files, Threlte `<T>` ownership, free navigation section
- `README.md` — Added free navigation to features and usage instructions

## Implementation Notes
- The free navigation checkbox lives in `App.svelte` (outside `<Canvas>`) so it renders as normal HTML. State is passed as a prop to `RadViewerScene`.
- `RadViewerScene` uses a `$effect` on the `freeNavEnabled` prop to manage internal `freeNavActive` state, ScrollTrigger lifecycle, and yaw/pitch initialization.
- `shouldHandleKeyEvent` handles `window`/`document` targets (no focused element) in addition to regular HTML elements, preventing false negatives when keyboard events dispatch at the window level.
- The `requestAnimationFrame` loop runs continuously but only processes movement when `freeNavActive` is `true`.

## Acceptance Criteria
- [x] The hardcoded `mesh.position.set(12, 1, 17);` is removed.
- [x] The same splat offset is preserved declaratively via `<SparkSplats position={[12, 1, 17]} />`.
- [x] `SplatMesh` is owned by Threlte `<T>` with declarative transform props.
- [x] `SparkRenderer` remains configured with `pagedExtSplats: true`, mobile-conscious profile options, and the real Threlte/Three renderer.
- [x] No duplicate scene-add path exists for the same `SplatMesh`.
- [x] One checkbox controls both mouse panning/look and WASD/arrow first-person navigation.
- [x] Scroll camera tween still works when the checkbox is off.
- [x] Free navigation changes camera state when the checkbox is on.
- [x] Keyboard listeners ignore form inputs and are cleaned up on destroy.
- [x] Tests cover the new declarative transform API and the one-checkbox free-navigation behavior.
- [x] `AGENTS.md` and README are updated where relevant.

## Tests Run
- `npm run check` - 0 errors, 0 warnings
- `npm run lint` - clean (0 errors, 0 warnings)
- `npm run test:unit` - 53 tests passed (4 test files)
- `npm run test:e2e` - 13 tests passed (all existing + 6 new free nav tests)
- `npm run build` - built successfully

## Known Issues / Follow-ups
- The `state_referenced_locally` Svelte compiler warnings in `SparkSplats.svelte` (about `profile.sparkRenderer.*` references) are pre-existing and suppressed in the `svelte-check` config. They are harmless because the SparkRenderer options are built once in `onMount` and never change.
- The free navigation mouse look uses document-level `mousemove` events rather than pointer lock. This works well but means mouse look is active whenever free nav is on (even when mouse leaves the canvas area).

## Commit / Push
- Branch: main
- Commit: 7a1ec95
- Pushed: no (pending)
