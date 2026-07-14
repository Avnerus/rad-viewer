# Final follow-up mission: close remaining ScrollAnimator evidence and interaction gaps

## Objective

Finish the existing ScrollAnimator implementation without redesigning it. The second pass correctly introduced scene-wide playback, a shared ScrollTrigger runtime, public Studio APIs, `useTask`, structural branding, and deduplication. Preserve those improvements.

Correct the remaining small functional defects, prove that the Studio controls are operable through real pointer/keyboard interaction, perform the mandatory dev-mode source-authoring experiment, and write an honest final report. This mission is not complete if any mandatory verification is skipped.

## Remaining verified issues

1. `transactionGuard.ts` claims to allow path-prefixed keyframe metadata, but checks `attributeName.startsWith('keyframes.')`. Studio builds nested attribute names as `[...pathItems, propertyPath].join('.')`, so a path-prefixed keyframe is `some.path.keyframes`, not `keyframes.some.path`. The current guard can suppress a legitimate nested keyframe sync and can allow arbitrary child attributes under `keyframes`.
2. Source-sync-unavailable UI shows only a percentage label, not the requested numeric percentage input. Typed percentage jumps should remain available because they do not mutate source.
3. `updateDebugState()` runs only when scroll progress changes. Moving the camera/target animator in Studio while stationary leaves world-space debug state stale even though the `useTask` updates look-at every frame.
4. `eslint.config.js` was globally relaxed to ignore underscore-prefixed arguments just to accommodate the unused `useTask` delta. Avoid changing global lint policy; omit the unused argument instead.
5. E2E uses `HTMLElement.click()` inside `page.evaluate()` for the pane toggle and keyframe buttons. This bypasses Playwright/browser actionability and hit testing. It proves the handler works, but not that a human can click the UI.
6. The fixed-toolbar/pane viewport test required by the follow-up mission was removed rather than stabilized.
7. The mandatory manual source-authoring experiment was explicitly not performed. Source persistence and transform-write suppression therefore remain unverified in the real Vite/Studio integration.
8. The status report marks the overall problem set resolved while admitting mandatory criteria were skipped. The next report must mark only genuinely verified criteria as met.

## Files likely involved

- `src/lib/studio/scroll-animator/transactionGuard.ts`
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte`
- `src/lib/components/RadViewerScene.svelte`
- `tests/unit/transactionGuard.test.ts`
- `tests/e2e/rad-viewer.spec.ts`
- `eslint.config.js` (restore the pre-follow-up rule)
- `AGENTS.md` only if final behavior/evidence references change
- `.codex-handoff/status.md` as the last file modification

Do not scan or modify unrelated areas.

## Required corrections

### 1. Correct the source-sync allowlist

Allow only an attribute whose final path segment is exactly `keyframes`:

```ts
function isKeyframesAttribute(attributeName: string): boolean {
  return attributeName === 'keyframes' || attributeName.endsWith('.keyframes')
}
```

Do not allow `keyframes.0`, `keyframes.position`, or another descendant attribute. Add unit cases for:

- `keyframes` → allowed;
- `scene.camera.keyframes` → allowed;
- `keyframes.0` → blocked;
- `scene.keyframes.position` → blocked;
- `position`, `rotation`, `scale`, and another property → blocked;
- non-ScrollAnimator transactions unchanged.

The real camera and target animator `<T>` nodes currently use a root `keyframes` attribute, but the guard contract and documentation must still be correct.

### 2. Share percentage navigation UI across source-sync states

Render the current percentage label and numeric percentage input whenever exactly one ScrollAnimator is selected, regardless of `transactions.vitePluginEnabled`. Only source-mutating controls must be conditional:

- `Insert/save scroll keyframe` disabled/hidden when source sync is unavailable;
- delete controls disabled/hidden when source sync is unavailable;
- percentage input and keyframe jump buttons remain enabled;
- warning clearly explains that persistence controls are unavailable.

Reuse one percentage-input markup/handler path instead of duplicating logic across branches. Preserve the focus-aware draft behavior.

Prevent the Enter→blur sequence from calling `jumpToPercentage` twice. A small commit guard or an Enter handler that relies on blur for the single commit is sufficient. Add focused coverage if a component seam is available.

### 3. Keep world-space debug state current

In the existing `useTask`, after updating `camera.lookAt`, also update debug state so stationary Studio transforms of either animator are observable:

```ts
useTask(() => {
  cameraTarget.getWorldPosition(targetWorld)
  camera.lookAt(targetWorld)
  updateDebugState()
}, { autoInvalidate: false })
```

Use no unused callback argument. Restore `eslint.config.js` to its prior `@typescript-eslint/no-unused-vars: 'warn'` setting. Do not suppress warnings globally.

Do not reintroduce a renderer wrapper or animator-transform task. The task may update look-at/debug only; ScrollTrigger remains the sole animator-transform driver.

### 4. Make real pointer interaction work and test it honestly

Replace direct DOM `.click()` calls in `page.evaluate()` with normal Playwright interactions:

```ts
const toggle = page.locator(
  '.scroll-animator-extension button[aria-label="Toggle Pane"]',
)
await toggle.click()
```

Use visible locators for keyframe buttons and normal `.click()`. `page.evaluate()` remains acceptable for reading hidden debug attributes or setting document scroll position; it is not acceptable for invoking extension controls.

If normal click fails, diagnose the actual actionability error before changing tests:

- inspect the toggle bounding box and `document.elementFromPoint()` at its center;
- inspect computed `pointer-events`, visibility, z-index, and any overlapping `.viewer-header`, canvas, loading overlay, Studio pane, or hierarchy pane;
- fix the smallest real CSS/layout/accessibility cause so a human pointer can operate it;
- do not use `{ force: true }`, `dispatchEvent('click')`, JS `.click()`, direct style mutation, or temporary element hiding as a workaround.

The hierarchy is already clicked normally, so the extension toolbar control should also be made normally actionable.

Add stable semantic selectors/test IDs only where needed. Do not couple tests to generic `.tooltip` instances.

### 5. Restore the fixed-position viewport test

With the pane open through a real click:

1. Record bounding boxes for the Studio toolbar and extension pane.
2. Scroll the document substantially using `window.scrollTo`.
3. Wait for ScrollTrigger/UI update.
4. Record bounding boxes again.
5. Assert viewport `x/y` remain stable within a small tolerance and both remain visible/actionable.

GPU stalls are not a reason to omit the criterion. Use one batched `page.evaluate()` to read bounding rectangles if individual locator calls time out, but do not mutate or click DOM through evaluate. Increase a targeted timeout only as needed.

### 6. Perform the real dev source-authoring experiment

This is mandatory and must use the development server, not production preview/stub E2E:

1. Ensure the working tree is otherwise understood and preserve unrelated changes.
2. Start the real dev server with the Threlte Studio Vite plugin.
3. Enter the viewer, select `Camera ScrollAnimator`, and open the extension with an actual pointer click.
4. Jump to a nonexisting normalized percentage using the visible numeric input.
5. Move and rotate the animator using Studio transform controls. Stop and wait; verify boolean scrub does not snap the pose back while scroll progress is stationary.
6. Capture a targeted `git diff` of `RadViewerScene.svelte`. Verify the gizmo action did **not** add/change `position`, `rotation`, `scale`, or another transform prop on the animator `<T>`.
7. Click `Insert/save scroll keyframe`, wait for source sync, and verify the correct camera animator's literal `keyframes={...}` changed at the chosen percentage.
8. Edit and save again at the same normalized percentage; verify replacement, not duplication.
9. Delete the temporary frame; verify source and visible list update.
10. Exercise Studio undo and redo; verify the visible list and source remain consistent.
11. Repeat a minimal insert/delete on `Camera Target ScrollAnimator` to prove per-node source targeting.
12. Restore only temporary experiment keyframes so the final checked-in authored defaults remain intentional.

If a step fails, diagnose and fix it; do not report the mission complete. The final report must state the chosen percentage and summarize the exact before/after source diff for each operation. Screenshots are optional; source-diff evidence is required.

## Acceptance criteria

- Transaction guard allows only root/path-prefixed attributes whose final segment is `keyframes`; descendant attributes are blocked.
- Current percentage and typed jumps work both with and without Studio source sync.
- Insert/delete are unavailable with a clear warning when source sync is unavailable.
- Enter/blur results in one percentage jump, not duplicate calls.
- `useTask` updates look-at and world debug state without an unused delta argument.
- Global ESLint policy is restored; lint passes with zero errors and zero warnings.
- Pane toggle, pane close, keyframe jump, and percentage input use normal Playwright pointer/keyboard interaction—no evaluated click, forced click, event dispatch, style mutation, or hit-test bypass.
- Studio toolbar and extension pane remain fixed and actionable after document scrolling, covered by E2E.
- Manual dev authoring proves transform gizmos do not persist animator transforms.
- Manual dev authoring proves insert/update/delete/undo/redo write the correct literal keyframes source and keep UI consistent.
- Manual dev authoring proves camera and target animator source writes target their independent `<T>` nodes.
- One boolean-scrub ScrollTrigger remains the sole animator-transform driver.
- Scene-wide branded traversal, runtime attach/detach, `useTask`, public Studio imports, deduplication, Spark routing, and all previously correct behavior remain intact.
- All checks pass: check, lint, unit, E2E, build.
- `AGENTS.md` and final `status.md` make no false claims and record any genuine unresolved item as unmet.
- Status is the last file modification and no later implementation/test commit invalidates it.

Re-check every acceptance criterion before finalization. Mandatory criteria may not be waived as “known deviations.”

## Tests to update/run

Add/update:

- transaction guard suffix/descendant cases listed above;
- source-sync-unavailable numeric input visibility and typed jump;
- real pane open/close via normal click;
- real visible keyframe click via normal click;
- multi-character numeric entry via normal keyboard input;
- fixed toolbar/pane viewport geometry before/after scroll;
- stationary debug update if a stable Studio transform seam exists;
- retain viewer remount, scene traversal, runtime lifecycle, interpolation, and existing viewer coverage.

Remove comments/documentation that normalize `page.evaluate().click()` as an acceptable Studio interaction strategy.

Run after restoring manual experiment edits:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Report exact test and warning counts. Trust these results in the report, but do not substitute them for the manual source-write experiment.

## Things Pi must not change

- Do not redesign ScrollAnimator, its keyframe shape, runtime singleton, scene traversal, or percentage precision.
- Do not remove GSAP/ScrollTrigger or change boolean `scrub: true`.
- Do not add a tween/timeline, raw scroll listener, polling interval, or continuous animator-transform task.
- Do not reintroduce free navigation or cameraTween.
- Do not wrap/replace WebGLRenderer.render.
- Do not change SparkStudioBridge, dual SparkRenderer routing, override safety, LOD ownership, SplatMesh lifecycle/transform, or editor camera markers.
- Do not change URL/landing/loading behavior, device profile, DPR, WebGL settings, Canvas render mode, or scroll-spacer height.
- Do not reintroduce private Studio imports/Vite aliases/types.
- Do not weaken global lint rules to hide feature warnings.
- Do not mutate checked-in source from automated tests.
- Do not discard unrelated user changes during the manual experiment.

## AGENTS.md update

Keep the current architecture guide, but correct any inaccurate source-guard path wording and remove the claim that evaluated clicks are a normal Studio testing strategy. Document that E2E performs real pointer interaction and that source persistence requires dev-mode manual verification when changed.

AGENTS.md should remain concise and architectural, not an implementation log.

## Expected completion report

Overwrite `.codex-handoff/status.md` with:

1. **Summary**
2. **Files changed**
3. **Each remaining issue above and exact resolution**
4. **Acceptance criteria audit** with no omitted criteria
5. **Automated tests and exact results/counts/warnings**
6. **Real pointer interaction evidence**, including the diagnosed cause if CSS/layout changed
7. **Fixed-position before/after bounding coordinates**
8. **Manual source-authoring evidence**: chosen percentage and targeted diff outcomes for gizmo, insert, replacement, delete, undo, redo, and independent target animator
9. **Known issues**—must be empty for mandatory criteria; otherwise report mission incomplete
10. **Implementation commit ids/branch**; final status-only commit may be noted as pending

## Finalization sequence

1. Implement corrections and tests.
2. Run automated checks.
3. Perform the full manual dev source-authoring experiment.
4. Restore temporary authored keyframes and re-run affected checks.
5. Re-check every acceptance criterion.
6. Update AGENTS.md.
7. Commit implementation/tests/docs if desired.
8. Write `.codex-handoff/status.md` as the final file modification.
9. Commit the status report and push all commits.
10. Do not modify or verify anything after the final push.
