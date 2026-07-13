# Mission: Threlte Studio camera-safe Spark LOD rendering

## Objective

Enable the existing `@threlte/studio` editor in RAD Viewer while ensuring Studio's perspective and orthographic editor cameras never drive Spark LOD selection, fetching, or pager updates. The application's real/default camera must remain the sole LOD driver. Editor-camera renders must still use their own camera for splat sorting/view-dependent rendering and must display the LOD selection produced by the real camera.

Implement this using the installed Spark 2.1.0 multi-renderer facilities (`enableDriveLod`, `SparkRenderer.sparkOverride`, and shared `lodInstances`), refining the proposed solution as needed for this repository's lifecycle, device profiles, and types.

Primary references:

- SparkRenderer API: https://sparkjs.dev/docs/spark-renderer/
- Threlte Studio setup: https://threlte.xyz/docs/reference/studio/getting-started
- Threlte Canvas custom renderer: https://threlte.xyz/docs/reference/core/canvas
- Installed authoritative declarations/source: `node_modules/@sparkjsdev/spark/dist/types/SparkRenderer.d.ts`, `node_modules/@sparkjsdev/spark/dist/spark.module.js`, and `node_modules/@threlte/studio/dist/extensions/editor-camera/EditorCamera.svelte`

Verified facts for the locked dependencies:

- `@sparkjsdev/spark` is locked to 2.1.0. `enableDriveLod: false` is explicitly intended to consume LOD instances driven by another renderer. `SparkRenderer.sparkOverride` and public `lodInstances` exist.
- `@threlte/studio` is locked to 0.4.3. Both Studio editor cameras set `camera.userData.editorCamera = true`.
- Spark itself uses the same clear-and-copy `lodInstances` sharing pattern for multi-view rendering in its portal implementation.

## Files likely involved

- `src/lib/spark/createSparkStudioRenderer.ts` (new; name may vary only with good reason)
- `src/lib/components/SparkStudioBridge.svelte` (new)
- `src/lib/components/SparkSplats.svelte`
- `src/App.svelte`
- `vite.config.ts`
- `tests/unit/createSparkStudioRenderer.test.ts` (new; split tests only if clearer)
- `tests/fixtures/spark-stub.ts` only if the production build/check requires its API surface to match the new integration; do not make e2e-oriented behavioral additions
- `AGENTS.md`

## Constraints and implementation guidance

- Keep `Canvas` at `renderMode="always"` and preserve its existing `dpr={profile.dpr}` behavior.
- The custom renderer must preserve the app's intentional WebGL settings unless a change is justified: canvas supplied by Threlte, `antialias: false`, `alpha: false`, and `powerPreference: 'default'`. The proposal's `alpha: true` and `high-performance` values are illustrative, not a request to change current behavior.
- Define a precise exported renderer/bridge type. Avoid `any` for scene, invalidate callback, and Spark options when Three/Spark types are available.
- Create exactly two `SparkRenderer` instances per attached Canvas scene:
  - editor renderer: `enableLod: true` (unless a supplied explicit setting intentionally disables LOD) and `enableDriveLod: false`;
  - real-camera renderer: matching Spark/profile options, `enableLod: true` by default, and `enableDriveLod: true`.
- Add only the non-driving editor `SparkRenderer` to the Three scene. Use the real-camera renderer through `SparkRenderer.sparkOverride`; never add it to the scene.
- Route `renderer.render(scene, camera)` by `camera.userData.editorCamera === true`. Editor renders share the real renderer's current `lodInstances` before rendering, use the editor override, and never drive LOD. Real/default camera renders use the driving renderer and refresh the shared instances afterward.
- Always restore `SparkRenderer.sparkOverride` with `try/finally`, including when the underlying Three render throws. Prefer restoring the previous value rather than blindly assigning `undefined` if that is safer for nested/foreign Spark rendering.
- Preserve the original bound Three `render` method and avoid recursion through the overridden method.
- Make `attach` idempotent. Make `dispose` safe if called more than once and remove only the scene-owned editor renderer. Dispose both Spark renderers exactly once, clear exposed references, and audit shared `lodInstances` cleanup so shared texture/resource references are not incorrectly treated as independently owned or left stale.
- Pass `useThrelte()`'s `scene`, `renderer`, and `invalidate` through a bridge mounted inside `Canvas`. The bridge must receive/use the current device profile's existing Spark settings (`pagedExtSplats`, `lodSplatScale`, `lodRenderScale`, `maxStdDev`, `maxPagedSplats`, `coneFov0`, `coneFov`, `coneFoveate`, `behindFoveate`) rather than replacing them with hardcoded sample values.
- Move `SparkRenderer` ownership out of `SparkSplats.svelte`. That component must continue to create/dispose the paged, non-raycastable `SplatMesh`, and `<T is={mesh}>` must continue to own scene membership and transform props. Do not create a third Spark renderer.
- Enable the existing `<Studio>` wrapper around the full scene, including the bridge and `RadViewerScene`. Add `threlteStudio()` before `svelte()` in `vite.config.ts`, per official Studio setup. Do not add dependencies; Studio is already installed.
- Preserve the landing/viewer state machine, loading behavior, scroll camera, free navigation, fixed canvas layout, and camera debug contract.
- Keep the solution compatible with Svelte 5, Threlte 8, TypeScript strict checking, and the E2E Spark alias at build time. If `tests/fixtures/spark-stub.ts` must compile with the new code path, add only the minimal static/member/options surface required.
- Do not hide production bugs with broad casts or test-only branches.

Critical shape (adapt rather than copy blindly):

```ts
const renderWithSparkOverride = (
  spark: SparkRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) => {
  const previous = SparkRenderer.sparkOverride
  try {
    SparkRenderer.sparkOverride = spark
    rawRender(scene, camera)
  } finally {
    SparkRenderer.sparkOverride = previous
  }
}
```

## Acceptance criteria

- Threlte Studio is active and wraps the viewer scene; its documented Vite plugin is configured in the correct order.
- A Studio editor-camera render is identified using the marker actually supplied by installed Studio 0.4.3 and is rendered through a non-LOD-driving Spark renderer.
- Moving/rendering either Studio editor camera cannot update, fetch, or page Spark LOD. Only a render using the app's real/default camera uses `enableDriveLod: true`.
- Both camera paths render splats with their own view/sort while editor rendering consumes the real camera renderer's current LOD selection.
- Exactly two Spark renderers exist per attached Canvas scene, and only the editor/non-driving renderer is a scene child.
- Existing device-profile Spark tuning reaches both Spark renderers unchanged, apart from the deliberate `enableDriveLod` difference and bridge invalidation callback.
- `SparkSplats.svelte` owns only `SplatMesh`; its paged loading, transforms, and cleanup remain intact.
- Attach/destroy/remount behavior is deterministic: no duplicate attachment, leaked scene objects, stale override, duplicate disposal, or stale public references.
- The override is restored even if raw rendering throws.
- New focused unit tests exercise renderer creation/options, attach idempotence, camera routing, LOD map sharing timing, override restoration on success and error, and disposal. Tests should mock WebGL/Spark boundaries rather than require a real GPU.
- Existing unit tests remain green. No end-to-end tests are created, edited, or run.
- `npm run check`, `npm run lint`, `npm run test:unit`, and `npm run build` pass.
- `AGENTS.md` contains concise, current architecture/lifecycle notes and source references for the Studio-safe dual Spark renderer design; do not turn it into an implementation log.

Before finalizing, re-check every item in this Acceptance criteria section explicitly.

## Tests to run

Run only:

```sh
npm run test:unit
npm run check
npm run lint
npm run build
```

Create focused unit tests for this feature. Do **not** create, modify, or run Playwright/end-to-end tests. The user will perform end-to-end verification after implementation.

## Things Pi must not change

- Do not create, edit, or run end-to-end tests.
- Do not change the RAD URL validation, sample URL, scroll tween geometry, free-navigation behavior, camera debug attributes, or visual layout/styles.
- Do not change the existing device-profile values.
- Do not replace Threlte's declarative `SplatMesh` ownership with imperative scene management.
- Do not add a third Spark renderer or allow the editor renderer to drive LOD.
- Do not add or upgrade dependencies or rewrite unrelated modules.
- Do not commit generated build output or broad formatting churn.
- Do not overwrite or revert unrelated user changes if any appear.

## Expected completion report

Write `.codex-handoff/status.md` with these headings:

1. `## Summary` - concise description of the implemented design.
2. `## Files changed` - each changed file and its purpose.
3. `## Acceptance criteria` - checklist mapping every criterion above to evidence/source references.
4. `## Unit tests added` - behaviors covered and test file names.
5. `## Verification` - exact commands run and pass/fail results. State explicitly that e2e tests were not run.
6. `## Risks or follow-ups` - remaining concerns, assumptions, or `None`.
7. `## Commit` - final commit hash pushed to the current branch.

Update `AGENTS.md` with concise up-to-date feature information and source references usable in a fresh session.

Write `status.md` as the **last action before committing and pushing**. After the push, do not perform any more verification, file modification, or amend. Before writing the report, re-check that every Acceptance criteria item is met. Commit all intended implementation, tests, documentation, and handoff report, then push the current branch.
