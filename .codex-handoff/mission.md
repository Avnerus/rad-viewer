# Follow-up Mission: Pin editor Spark override inside `onBeforeRender`

## Objective

Keep Pi's crash-safe `editorRenderer.onBeforeRender` interception, but close the remaining LOD-safety gap in commit `2c3be49`.

The current editor-camera branch calls the original Spark `onBeforeRender` without changing `SparkRenderer.sparkOverride`. Spark resolves `const spark = SparkRenderer.sparkOverride ?? this`; therefore, if any pre-existing override is present, an editor-camera render uses that foreign/driving renderer rather than the non-driving editor renderer. The existing test named `preserves pre-existing sparkOverride for editor camera` only checks the value after the call and does not observe which renderer Spark would use inside it.

During every editor-camera `onBeforeRender`, explicitly set `SparkRenderer.sparkOverride = editorRenderer`, call the original callback, and restore the previous override in `finally`. This is scoped only to the Spark object's callback and must not reintroduce the removed full-`WebGLRenderer.render` override.

## Files likely involved

- `src/lib/spark/createSparkStudioRenderer.ts`
- `tests/unit/createSparkStudioRenderer.test.ts`
- `AGENTS.md`
- `.codex-handoff/status.md`

## Constraints

- Retain the `onBeforeRender` wrapping architecture that fixed the browser crash.
- Do not override or monkey-patch `WebGLRenderer.render` again.
- Keep only `editorRenderer` in the scene; `realRenderer` remains off-scene.
- Editor camera: share real LOD instances, temporarily set override to `editorRenderer` (`enableDriveLod: false`), invoke original `onBeforeRender`, restore the prior override.
- Real/default camera: temporarily set override to `realRenderer` (`enableDriveLod: true`), invoke original `onBeforeRender`, restore the prior override, share LOD instances.
- Prefer one small helper for the identical save/set/call/restore logic in both branches.
- Preserve the previous override on success and exception, including when it is a non-undefined foreign `SparkRenderer`.
- Do not change renderer options, Studio wiring, scene ownership, device profiles, SplatMesh behavior, camera/navigation behavior, layout, or dependencies.
- Do not create or modify automated end-to-end tests. Manual Playwright CLI verification is required because this feature previously crashed only in the real browser.

Critical behavior:

```ts
const callWithOverride = (spark: SparkRenderer) => {
  const previous = SparkRenderer.sparkOverride
  try {
    SparkRenderer.sparkOverride = spark
    originalOnBeforeRender(renderer, scene, camera)
  } finally {
    SparkRenderer.sparkOverride = previous
  }
}

if (camera.userData.editorCamera === true) {
  shareLodInstances()
  callWithOverride(editorRenderer)
} else {
  callWithOverride(realRenderer)
  shareLodInstances()
}
```

## Acceptance criteria

- Inside the original `onBeforeRender` callback for an editor camera, `SparkRenderer.sparkOverride` is exactly `editorRenderer` and `enableDriveLod === false`, even when the prior override was `realRenderer` or another non-undefined value.
- Inside the original callback for a real/default camera, the override remains exactly `realRenderer` with `enableDriveLod === true`.
- Both branches restore the exact prior override after success and after an exception.
- Editor cameras cannot inherit a driving/foreign Spark override and therefore cannot drive LOD.
- The implementation still wraps only `editorRenderer.onBeforeRender`; `WebGLRenderer.render` is untouched.
- Unit tests observe override identity *inside* the mocked original callback for both camera branches with a non-undefined prior override.
- Unit tests cover exception restoration for both branches.
- Existing unit tests, check, lint, and build pass.
- Manual Playwright CLI verification loads the real sample RAD model, activates the Studio editor camera, shows the Studio UI and model without a crash, and reports zero console errors.
- Save a screenshot under `.playwright-cli/` and include its path plus the observed model/editor state in the status report. Do not commit the screenshot unless this repository already tracks such artifacts.
- No automated E2E test is created, modified, or run.
- `AGENTS.md` accurately states that both camera paths pin their intended Spark override only during the wrapped `onBeforeRender` callback.

Re-check every acceptance criterion before finalizing.

## Tests to run

```sh
npm run test:unit
npm run check
npm run lint
npm run build
```

Then use `playwright-cli` against the real dev app as documented in `AGENTS.md`: load the sample model, wait for streaming, activate Studio's editor camera, inspect console errors, and take a screenshot showing the editor and loaded model. This is manual browser verification, not a new automated E2E test.

## Things Pi must not change

- Do not restore the full `renderer.render` override.
- Do not change `src/App.svelte`, `SparkStudioBridge.svelte`, `SparkSplats.svelte`, `RadViewerScene.svelte`, Vite config, E2E tests/fixtures, camera modules, or styles unless a directly related compiler error requires a minimal correction.
- Do not add dependencies or a third Spark renderer.
- Do not weaken tests to inspect only the post-callback restored value.
- Do not commit screenshots, server logs, build output, or unrelated formatting changes.

Update `AGENTS.md` with concise, correct current behavior and relevant source references. Do not add a full implementation log.

## Expected completion report format

Write `.codex-handoff/status.md` with:

1. `## Summary` - remaining override-inheritance defect and correction.
2. `## Files changed` - file and purpose.
3. `## Acceptance criteria` - checklist with code/test/browser evidence.
4. `## Unit tests` - in-callback identity and exception restoration coverage.
5. `## Verification` - exact commands/results, Playwright CLI steps, console result, screenshot path, and explicit statement that automated E2E was not run.
6. `## Risks or follow-ups` - remaining concerns or `None`.
7. `## Commit` - pushed commit identifier.

Place the report at `.codex-handoff/status.md` and push it to the current branch. Write `status.md` as the last file modification before committing and pushing. Before writing it, re-check every acceptance criterion. After pushing, perform no further verification or modification.
