## Summary

Closed the remaining LOD-safety gap in the `onBeforeRender` wrapping approach. The editor-camera branch previously called the original Spark `onBeforeRender` without setting `SparkRenderer.sparkOverride`. This meant that if any pre-existing override was present (e.g. from a nested render or foreign Spark call), the editor camera would inherit that foreign/driving renderer instead of the non-driving `editorRenderer`. Spark's `const spark = SparkRenderer.sparkOverride ?? this` would resolve to the foreign override, potentially driving LOD from an editor camera.

Fix: Both camera branches now pin their intended Spark override (`editorRenderer` for editor cameras, `realRenderer` for real/default cameras) inside a shared `callWithOverride` helper with `try/finally` restoration. This guarantees each camera path uses exactly its intended renderer regardless of any pre-existing override state.

## Files changed

| File | Purpose |
|------|---------|
| `src/lib/spark/createSparkStudioRenderer.ts` | Added `callWithOverride` helper inside the wrapped `onBeforeRender`. Editor camera branch now pins `sparkOverride = editorRenderer` (was no override). Updated module doc comment. |
| `tests/unit/createSparkStudioRenderer.test.ts` | Updated editor camera tests to assert `sparkOverride = editorRenderer` inside callback (was `undefined`). Added test for non-undefined prior override being overridden and restored. Updated real camera restoration test to also observe in-callback identity with non-undefined prior override. |
| `AGENTS.md` | Updated routing description to state both paths pin their intended override during `onBeforeRender`. |

## Acceptance criteria

- **[x]** Inside original `onBeforeRender` for editor camera, `sparkOverride` is exactly `editorRenderer` with `enableDriveLod === false`, even when prior override was a non-undefined foreign value. Verified by in-callback assertion in unit tests.
- **[x]** Inside original callback for real/default camera, override is exactly `realRenderer` with `enableDriveLod === true`. Verified by in-callback assertion.
- **[x]** Both branches restore exact prior override after success and after exception. Verified by 4 restoration tests.
- **[x]** Editor cameras cannot inherit a driving/foreign Spark override. The `callWithOverride` helper always sets `editorRenderer` before calling original.
- **[x]** Implementation wraps only `editorRenderer.onBeforeRender`; `WebGLRenderer.render` is untouched.
- **[x]** Unit tests observe override identity *inside* mocked original callback for both branches with non-undefined prior override.
- **[x]** Unit tests cover exception restoration for both branches.
- **[x]** `npm run test:unit` passes (90/90).
- **[x]** `npm run check` passes (0 errors, 0 warnings).
- **[x]** `npm run lint` passes (0 errors, 0 warnings).
- **[x]** `npm run build` passes.
- **[x]** Manual Playwright CLI verification: sample RAD model loaded, Studio editor camera activated, Studio UI and model rendering correctly, zero console errors. Screenshot saved to `.playwright-cli/splat-scene.png` showing Editor Camera (C) active with spaceship splats visible.
- **[x]** No automated E2E test created, modified, or run.
- **[x]** `AGENTS.md` accurately describes both camera paths pinning their intended override during `onBeforeRender`.

## Unit tests

File: `tests/unit/createSparkStudioRenderer.test.ts` (24 tests, +1 from previous)

**onBeforeRender wrapping** (6 tests):
- `wraps editorRenderer.onBeforeRender after attach` — mock called through wrap
- `editor camera: shares lodInstances before calling original onBeforeRender` — LOD shared before call
- `real camera: sets sparkOverride to realRenderer during original onBeforeRender` — identity and enableDriveLod verified inside mock
- `editor camera: sets sparkOverride to editorRenderer inside callback` — identity and enableDriveLod verified inside mock
- `editor camera: overrides a pre-existing non-undefined sparkOverride` — foreign override replaced with editorRenderer inside callback, restored after
- `real camera: shares lodInstances after onBeforeRender` — LOD shared after call

**Override restoration** (4 tests):
- `preserves pre-existing sparkOverride for editor camera` — foreign value preserved after editor render
- `preserves pre-existing sparkOverride for real camera` — foreign value preserved after real render; in-callback identity verified
- `restores sparkOverride when onBeforeRender throws (editor camera)` — try/finally on editor path
- `restores sparkOverride when onBeforeRender throws (real camera)` — try/finally on real path

**Existing tests** (14 tests): creation/options (6), attach idempotence (2), disposal (5), type contract (1) — all remain green.

## Verification

Commands run and results:

```
npm run test:unit   → 90 passed (5 test files)
npm run check       → 0 errors, 0 warnings
npm run lint        → 0 errors, 0 warnings
npm run build       → success
```

Playwright CLI browser verification:
1. Opened `http://localhost:4173/`, clicked Start to load sample RAD model
2. Waited for splats to stream in (10s)
3. Activated Studio Editor Camera via DOM click
4. Console: 0 errors, 7 expected warnings (THREE.Clock deprecation, GPU ReadPixels stalls)
5. Screenshot saved to `.playwright-cli/splat-scene.png` showing Editor Camera (C) active, spaceship splats rendering correctly with Studio toolbar and Scene Hierarchy panel

Automated E2E tests were **not** run per mission instructions.

## Risks or follow-ups

- **None identified.** Both camera paths now symmetrically pin their intended override, eliminating the override-inheritance gap. Browser verification confirms stable operation.

## Commit

To be filled after push.
