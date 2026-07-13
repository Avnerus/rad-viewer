# Follow-up Mission: Correct Spark Studio camera routing

## Objective

Fix the dual-`SparkRenderer` routing introduced in commit `2340703` (status report names inner implementation commit `b645578`). The current implementation reverses the feature's primary invariant:

- Editor-camera path currently sets `SparkRenderer.sparkOverride = realRenderer`, so the LOD-driving renderer is updated with the Studio editor camera.
- Real/default-camera path currently applies no override, so the only `SparkRenderer` in the scene, `editorRenderer`, handles the render and does not drive LOD.

After the fix, Studio editor cameras must render through `editorRenderer` (`enableDriveLod: false`), while every real/default-camera render must render through `realRenderer` (`enableDriveLod: true`).

## Files likely involved

- `src/lib/spark/createSparkStudioRenderer.ts`
- `tests/unit/createSparkStudioRenderer.test.ts`
- `AGENTS.md`
- `.codex-handoff/status.md`

Do not broaden the change unless a directly related compile/test failure requires it.

## Constraints

- Keep only `editorRenderer` attached to the Three scene.
- Keep copying `realRenderer.lodInstances` into `editorRenderer.lodInstances` before an editor-camera render.
- For an editor camera (`camera.userData.editorCamera === true`), set the override to `editorRenderer` for the duration of the raw Three render.
- For a real/default camera, set the override to `realRenderer` for the duration of the raw Three render. Do not pass through without an override.
- Use the same helper or equivalent `try/finally` logic on both paths. Preserve and restore any pre-existing `SparkRenderer.sparkOverride` value after success or failure.
- Preserve the bound/original raw Three render call without recursion.
- Do not change Studio wiring, device-profile values, SplatMesh ownership, scroll/free-navigation behavior, layout, dependencies, or renderer count.
- Do not create, edit, or run end-to-end tests. The user owns end-to-end verification.
- Remove or correct inaccurate comments/docs that currently say editor rendering uses `realRenderer` or real rendering passes through directly.

Critical intended routing:

```ts
if (camera.userData.editorCamera === true) {
  shareLodInstances()
  renderWithSparkOverride(editorRenderer, scene, camera)
} else {
  renderWithSparkOverride(realRenderer, scene, camera)
  shareLodInstances()
}
```

Refine the exact post-real-render sharing timing only if justified by the installed Spark implementation, but the active override identities above are mandatory.

## Acceptance criteria

- During the raw render for a Studio editor camera, `SparkRenderer.sparkOverride` is exactly `editorRenderer` and its `enableDriveLod` is `false`.
- During the raw render for a real/default camera, `SparkRenderer.sparkOverride` is exactly `realRenderer` and its `enableDriveLod` is `true`.
- Editor-camera rendering cannot drive Spark LOD selection, fetching, or pager updates.
- Real/default-camera rendering remains the sole LOD driver.
- Editor rendering consumes the real renderer's current `lodInstances` and retains its own editor-camera sort/view.
- Both camera paths restore the prior override after successful raw rendering and after a raw-render exception.
- Unit tests observe `SparkRenderer.sparkOverride` *inside the raw render mock*, not merely after it has been restored. Tests explicitly assert renderer identity for both camera paths.
- Unit tests include error-path restoration for both editor and real/default cameras, or a parameterized equivalent proving both branches.
- Existing focused lifecycle, profile-option, LOD-sharing, and disposal tests remain green.
- `AGENTS.md` accurately describes editor override = editor renderer and real/default override = driving renderer.
- The status report acknowledges the routing defect found in Codex verification and accurately describes the correction.
- `npm run test:unit`, `npm run check`, `npm run lint`, and `npm run build` pass.
- No end-to-end test is created, modified, or run.

Re-check every acceptance criterion before finalizing.

## Tests to run

Run only:

```sh
npm run test:unit
npm run check
npm run lint
npm run build
```

Create/update unit tests for both routing identities and both restoration paths. Do not create, modify, or run Playwright/end-to-end tests.

## Things Pi must not change

- Do not change `src/App.svelte`, `SparkStudioBridge.svelte`, `SparkSplats.svelte`, `RadViewerScene.svelte`, `vite.config.ts`, camera tween/free-navigation modules, or E2E fixtures/tests unless a directly related compiler error makes a minimal change unavoidable.
- Do not add or upgrade dependencies.
- Do not change renderer count or attach `realRenderer` to the scene.
- Do not weaken tests to assert only the final restored override.
- Do not alter unrelated tests, documentation, formatting, or user work.

Update `AGENTS.md` with concise, correct current behavior and source references; it should not become an implementation log.

## Expected completion report format

Write `.codex-handoff/status.md` with:

1. `## Summary` - defect and corrected routing.
2. `## Files changed` - file and purpose.
3. `## Acceptance criteria` - checklist with evidence.
4. `## Unit tests` - exact in-render identity and error restoration coverage.
5. `## Verification` - commands and results; explicitly state E2E was not run.
6. `## Risks or follow-ups` - remaining concerns or `None`.
7. `## Commit` - pushed commit identifier.

Write `status.md` as the last file modification before committing and pushing. Before writing it, re-check all acceptance criteria. Commit and push the current branch. After pushing, perform no further verification or modification.
