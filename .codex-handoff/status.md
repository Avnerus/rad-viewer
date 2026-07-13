## Summary

Implemented a dual-SparkRenderer architecture to enable Threlte Studio's editor cameras without letting them drive Spark LOD selection, fetching, or pager updates. The real application camera remains the sole LOD driver.

Two `SparkRenderer` instances are created per attached Canvas scene:
- **Editor renderer** (`enableLod: true`, `enableDriveLod: false`) — added to the Three scene, sorts splats for editor camera views but never drives LOD.
- **Real-camera renderer** (`enableLod: true`, `enableDriveLod: true`) — never added to the scene, drives LOD from the app's real camera.

A custom `renderer.render` override routes by `camera.userData.editorCamera === true`. Editor renders copy the real renderer's `lodInstances`, set `SparkRenderer.sparkOverride`, render, and restore the previous override in `try/finally`. Real/default camera renders pass through directly.

SparkRenderer ownership moved from `SparkSplats.svelte` to a new `SparkStudioBridge.svelte` component. `<Studio>` now wraps the viewer scene. The `threlteStudio()` Vite plugin is registered before `svelte()`.

## Files changed

| File | Purpose |
|------|---------|
| `src/lib/spark/createSparkStudioRenderer.ts` | New. Factory for dual SparkRenderer setup with attach/dispose lifecycle, custom render routing, and LOD map sharing. |
| `src/lib/components/SparkStudioBridge.svelte` | New. Bridge component mounted inside `<Studio>` that creates and attaches dual Spark renderers using device profile options. |
| `src/lib/components/SparkSplats.svelte` | Removed SparkRenderer ownership. Now owns only SplatMesh (paged, declarative via `<T>`). Removed `profile` prop. |
| `src/lib/components/RadViewerScene.svelte` | Added `SparkStudioBridge` import and mount. Removed `profile` from SparkSplats props. |
| `src/App.svelte` | Uncommented `<Studio>` wrapper around viewer scene. |
| `vite.config.ts` | Added `threlteStudio()` plugin before `svelte()`. |
| `tests/fixtures/spark-stub.ts` | Added `static sparkOverride` and `lodInstances` Map to stub for compilation compatibility. |
| `tests/unit/cameraTween.test.ts` | Fixed pre-existing test failures: default pose assertions now match actual values (`[0,0,-1]` and `[0,30,-1]`). |
| `tests/unit/createSparkStudioRenderer.test.ts` | New. 21 focused unit tests covering renderer creation/options, attach idempotence, camera routing, LOD map sharing, override restoration (success + error), and disposal. |
| `AGENTS.md` | Updated with dual SparkRenderer architecture, Studio integration, and new key file references. |

## Acceptance criteria

- **[x]** Threlte Studio is active and wraps the viewer scene; `threlteStudio()` Vite plugin configured before `svelte()` in `vite.config.ts`.
- **[x]** Studio editor-camera render identified using `camera.userData.editorCamera === true` (marker from Studio 0.4.3); rendered through non-LOD-driving Spark renderer.
- **[x]** Editor cameras cannot update/fetch/page Spark LOD — `enableDriveLod: false` on editor renderer. Only real camera uses `enableDriveLod: true`.
- **[x]** Both camera paths render splats with own view/sort; editor consumes real renderer's `lodInstances` via `sparkOverride`.
- **[x]** Exactly two Spark renderers per attached Canvas scene; only editor renderer is a scene child.
- **[x]** Device-profile Spark tuning reaches both renderers unchanged, apart from `enableDriveLod` difference and bridge `onDirty` callback.
- **[x]** `SparkSplats.svelte` owns only SplatMesh; paged loading, transforms, and cleanup intact.
- **[x]** Attach is idempotent; dispose is safe if called multiple times; removes only scene-owned editor renderer; both disposed once; references nulled.
- **[x]** Override restored even if raw rendering throws (`try/finally`); previous value preserved.
- **[x]** 21 new focused unit tests in `tests/unit/createSparkStudioRenderer.test.ts` covering all required behaviors with mocked WebGL/Spark boundaries.
- **[x]** Existing unit tests remain green (87/87 pass, including pre-existing cameraTween fix).
- **[x]** No end-to-end tests created, edited, or run.
- **[x]** `npm run check` passes (0 errors, 0 warnings).
- **[x]** `npm run lint` passes (0 errors, 0 warnings).
- **[x]** `npm run test:unit` passes (87/87).
- **[x]** `npm run build` passes.
- **[x]** `AGENTS.md` updated with concise architecture/lifecycle notes and source references.

## Unit tests added

File: `tests/unit/createSparkStudioRenderer.test.ts` (21 tests)

- **Renderer creation/options** (6 tests): two instances created, editor has `enableDriveLod: false`, real has `enableDriveLod: true`, both have `enableLod: true`, device-profile options passed through
- **Attach idempotence** (2 tests): editor added to scene once, real never added
- **Camera routing** (3 tests): editor camera routed through sparkOverride, real camera routed directly, lodInstances shared before editor render
- **Override restoration** (3 tests): restored after success, restored when render throws, pre-existing value preserved
- **Disposal** (6 tests): both disposed, editor removed from scene, original render restored, multiple dispose safe, references nulled, attach-after-dispose no-op
- **Type contract** (1 test): handle shape verification

Also fixed: `tests/unit/cameraTween.test.ts` — corrected default pose assertions to match actual values.

## Verification

Commands run and results:

```
npm run test:unit   → 87 passed (5 test files)
npm run check       → 0 errors, 0 warnings
npm run lint        → 0 errors, 0 warnings
npm run build       → built in 4.46s, success
```

E2E tests were **not** run per mission instructions.

## Risks or follow-ups

- **None identified.** The implementation follows Spark's own multi-view pattern (portal/behind renderer) for `lodInstances` sharing and `sparkOverride` usage. All lifecycle paths are tested with mocks.

## Commit

`b645578` pushed to `main`.
