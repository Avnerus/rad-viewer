## Summary

Fixed a runtime crash caused by the dual-`SparkRenderer` routing strategy. The previous approach (commit `b645578`/`805e6cb`) overrode `WebGLRenderer.render` to set `SparkRenderer.sparkOverride` for the entire render call. This broke Three.js's internal render pipeline because:

1. The override was active during the full scene traversal, affecting all nested render calls (including Studio's DefaultCamera pane which calls `renderer.render()` directly).
2. When `sparkOverride` pointed to a SparkRenderer not in the scene, Spark's `onBeforeRender` (firing on the scene-attached `editorRenderer`) would use the override's internal state (`display`, `orderingTexture`, accumulators) that was not initialized for that rendering context, causing `TypeError: Cannot read properties of undefined (reading 'localClippingEnabled')` deep in Three.js's shadow-map render path.

**Fix**: Replaced the `WebGLRenderer.render` override with a surgical `editorRenderer.onBeforeRender` wrap. The wrap detects `camera.userData.editorCamera` and routes accordingly:

- **Editor camera**: Share `lodInstances` from real renderer, then call original `onBeforeRender` directly (no `sparkOverride` — Spark uses `this` = `editorRenderer` naturally).
- **Real/default camera**: Set `sparkOverride = realRenderer`, call original `onBeforeRender` (Spark's `const spark = sparkOverride ?? this` picks up `realRenderer`, which drives LOD), restore override in `try/finally`, then share `lodInstances` for the next editor frame.

This matches Spark's own portal pattern: the scene-attached renderer handles rendering via `onBeforeRender`, while the off-scene renderer drives LOD through `sparkOverride` only during the specific `onBeforeRender` call that needs it.

## Files changed

| File | Purpose |
|------|---------|
| `src/lib/spark/createSparkStudioRenderer.ts` | Replaced `WebGLRenderer.render` override with `editorRenderer.onBeforeRender` wrap. Removed `attachedRenderer` tracking and `restoreOriginalRender`. Removed `renderer` param from `attach()`. |
| `src/lib/components/SparkStudioBridge.svelte` | Removed `renderer` from `attach()` call. |
| `tests/unit/createSparkStudioRenderer.test.ts` | Rewrote all routing/override tests to use prototype mocking (set before attach so bound original captures the mock). Tests now verify `sparkOverride` identity inside the mocked `onBeforeRender` for both camera paths, including error-path restoration. |
| `AGENTS.md` | Updated render routing description to reflect `onBeforeRender` wrap approach. |

## Acceptance criteria

- **[x]** Editor camera renders through `editorRenderer` (`enableDriveLod: false`). Verified: `sparkOverride` is undefined during editor camera `onBeforeRender` (Spark uses `this`).
- **[x]** Real/default camera renders with `sparkOverride = realRenderer` (`enableDriveLod: true`). Verified: `sparkOverride` is `realRenderer` inside `onBeforeRender` for real camera.
- **[x]** Editor-camera rendering cannot drive Spark LOD — `enableDriveLod: false` on editorRenderer, no override set.
- **[x]** Real/default-camera rendering is the sole LOD driver — `sparkOverride = realRenderer` during its `onBeforeRender`.
- **[x]** Editor rendering consumes real renderer's `lodInstances` (shared before editor `onBeforeRender`).
- **[x]** Both camera paths restore prior override after success and after exception (4 tests).
- **[x]** Studio Editor Camera button works without crash — verified in browser via playwright-cli. Splats render correctly from editor camera view with grid, gizmo, and Default Camera preview pane visible.
- **[x]** Zero console errors during Studio editor camera activation.
- **[x]** `npm run test:unit` passes (89/89).
- **[x]** `npm run check` passes (0 errors, 0 warnings).
- **[x]** `npm run lint` passes (0 errors, 0 warnings).
- **[x]** `npm run build` passes.
- **[x]** No end-to-end test created, modified, or run.

## Unit tests

File: `tests/unit/createSparkStudioRenderer.test.ts` (23 tests)

**Renderer creation/options** (6): two instances, correct `enableDriveLod`/`enableLod` flags, profile options passthrough
**Attach idempotence** (2): editor added once, real never added
**onBeforeRender wrapping** (5): wrap applied, editor shares lodInstances before call, real sets `sparkOverride = realRenderer` inside call, editor does not set override, real shares lodInstances after call
**Override restoration** (4): preserves pre-existing value for both camera types, restores on throw for both camera types
**Disposal** (5): both disposed, editor removed from scene, multiple dispose safe, references nulled, attach-after-dispose no-op
**Type contract** (1): handle shape

All routing tests use `SparkRenderer.prototype.onBeforeRender` mocking set **before** `attach()` so the bound original inside the wrap captures the mock, enabling in-call observation of `sparkOverride`.

## Verification

Commands run and results:

```
npm run test:unit   → 89 passed (5 test files)
npm run check       → 0 errors, 0 warnings
npm run lint        → 0 errors, 0 warnings
npm run build       → success
```

Browser verification via playwright-cli: Studio Editor Camera activated, splats rendering correctly, zero console errors.

E2E tests were **not** run per mission instructions.

## Risks or follow-ups

- **None identified.** The `onBeforeRender` wrap approach is stable and matches Spark's own multi-view pattern. Browser verification confirms the Studio editor camera works without crashes.

## Commit

`f9640c4` pushed to `main`.
