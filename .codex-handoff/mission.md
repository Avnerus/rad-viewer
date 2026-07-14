# Follow-up mission: make ScrollAnimator authoring genuinely usable and lifecycle-safe

## Objective

Correct the first ScrollAnimator implementation without redesigning the accepted feature. Retain GSAP ScrollTrigger with boolean `scrub: true`, the `ScrollAnimator` keyframe model, Studio source transactions, the camera/CameraTarget hierarchy, and the removal of free navigation.

The current implementation passes its reported tests but does not yet satisfy the mission in actual authoring use. Fix the concrete gaps below, add regression coverage that interacts with the real UI rather than bypassing it, perform the required manual source-write verification, update documentation, and produce an accurate final status report.

## Verified problems to fix

1. **The extension pane toggle does not open the pane.** `ScrollAnimatorExtension.svelte` passes a custom `toggle` callback to `DropDownPane` that only flips `extension.state.paneVisible`; it never calls the pane's `show()`/`hide()` behavior that changes `.tooltip.style.display`. E2E tests conceal this by directly setting `.tooltip.style.display = 'block'` with `page.evaluate()`.
2. **Scroll playback is not generic.** `applyScrollAnimators()` hard-codes only `cameraAnimator` and `targetAnimator`, while the feature and `AGENTS.md` claim one trigger drives every scene `ScrollAnimator`. A newly added animator would never play.
3. **The WebGLRenderer render wrapper is unsafe.** `RadViewerScene.svelte` replaces `renderer.render`, never restores it on destroy, and can stack stale closures when leaving/re-entering the viewer. This also creates an unnecessary second render wrapper beside the Spark/Studio integration.
4. **The extension does not consume ScrollTrigger's progress/range.** It polls DOM geometry every 100 ms and jumps using an independently calculated spacer range. This can disagree with ScrollTrigger after refresh and does not meet the accepted trigger-range design.
5. **Typing a percentage is unstable.** The 100 ms interval continually replaces `percentageInput`, including while the user is editing it.
6. **Undo/redo can leave the keyframe list stale.** Transaction writes update `animator.keyframes`, but the selection-derived effect does not react to that plain property change.
7. **HMR-safe branding is undermined by `instanceof`.** Selection accepts the `isScrollAnimator` brand, then list/actions require `instanceof ScrollAnimator`, which can reject a branded instance across HMR/class replacement.
8. **Unnecessary private Studio imports and Vite aliases were added.** Installed Studio 0.4.3 publicly exports `useObjectSelection` and `useTransactions` from `@threlte/studio/extensions`; `useTransactions()` exposes `vitePluginEnabled`, and `buildTransaction()` derives source metadata from the object's Studio metadata. The local aliases/types add fragility and 33 lint warnings.
9. **Keyframe canonicalization does not deduplicate raw frames that normalize to the same percentage.** This can leave ambiguous brackets/source after clamping/rounding.
10. **Required evidence is missing.** The report describes code/unit behavior but does not document the manual dev source-write experiment required by the mission. It also claims completion despite 33 lint warnings.
11. **Finalization protocol was not followed.** Commit `f518acd` changed tests after `status.md` was written, so the report omits the final commit/state.

## Files likely involved

- `src/lib/components/RadViewerScene.svelte`
- `src/lib/spark/scrollAnimation.ts`
- `src/lib/spark/ScrollAnimator.ts`
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte`
- New shared runtime bridge/store, preferably `src/lib/studio/scroll-animator/scrollAnimatorRuntime.svelte.ts` or a similarly scoped module
- `src/lib/studio/scroll-animator/transactionGuard.ts`
- Remove `src/lib/studio/scroll-animator/studio-types.d.ts`
- `src/gsap.d.ts` only for accurate types actually used
- `vite.config.ts` to remove private Studio aliases
- `tests/unit/scrollAnimation.test.ts`
- `tests/unit/transactionGuard.test.ts`
- New tests for the runtime bridge/store if created
- `tests/e2e/rad-viewer.spec.ts`
- `AGENTS.md`
- `.codex-handoff/status.md` as the final file modification

Do not scan or change unrelated repository areas.

## Required design

### 1. Use ScrollTrigger as the single progress/range authority

Create a small shared runtime bridge owned by the app scene but readable by the Studio extension. It must expose at least:

- current percentage as reactive Svelte state;
- the active ScrollTrigger instance/range;
- attach/detach lifecycle guarded by instance identity;
- `updateProgress(progress01)` called from initial setup and `onUpdate`;
- `jumpToPercentage(percent)` using the active trigger's measured `start`, `end`, and `scroll()`.

Suggested shape (adapt to Svelte 5 conventions and actual types):

```ts
class ScrollAnimatorRuntime {
  percentage = $state(0)
  private trigger: ScrollTriggerInstance | null = null

  attach(trigger: ScrollTriggerInstance) {
    this.trigger = trigger
    this.updateProgress(trigger.progress)
  }

  detach(trigger: ScrollTriggerInstance) {
    if (this.trigger === trigger) this.trigger = null
  }

  updateProgress(progress: number) {
    this.percentage = clampPercentage(progress * 100)
  }

  jumpToPercentage(percent: number) {
    if (!this.trigger) return
    this.trigger.scroll(
      percentageToScroll(percent, this.trigger.start, this.trigger.end),
    )
  }
}
```

Reset stale state appropriately when the viewer unmounts. Do not poll with `setInterval`, do not independently calculate spacer geometry in the extension, and do not use raw `window.scrollTo` for authored percentage jumps.

Keep exactly one `ScrollTrigger.create` with literal boolean `scrub: true`. No numeric scrub, tween, timeline, raw scroll listener, or continuous animator-transform task.

### 2. Drive every scene ScrollAnimator

On initial trigger application and every ScrollTrigger `onUpdate`, traverse the Threlte scene (or use a correctly cleaned registry) and apply the percentage to every branded object:

```ts
scene.traverse((object) => {
  if (isScrollAnimator(object)) {
    object.applyScrollPercentage(percent)
  }
})
```

Use a structural/HMR-safe type guard that verifies the brand and callable method. Do not require `instanceof` in runtime or extension logic. Keep the two literal camera/target `<T>` nodes for source metadata, but do not special-case them in playback.

Update debug state after world matrices are current; it must remain world-space and reflect target/camera changes made while stationary where relevant.

### 3. Use a Threlte task for camera look-at

Remove the `renderer.render = ...` assignment entirely. Use public `useTask` from `@threlte/core`:

```ts
useTask(() => {
  cameraTarget.getWorldPosition(targetWorld)
  camera.lookAt(targetWorld)
  updateDebugState()
}, { autoInvalidate: false })
```

Reuse `Vector3` scratch instances rather than allocating every frame. Confirm the task is automatically cleaned up with the component and that it runs in the normal Threlte render schedule before rendering. Do not alter `SparkStudioBridge` or `createSparkStudioRenderer`.

### 4. Make the extension pane work through public UI behavior

Use `DropDownPane`'s normal default toggle behavior. The simplest correct form is:

```svelte
<ToolbarItem position="left">
  <div class="scroll-animator-extension">
    <DropDownPane title="Scroll Animator">
      <!-- UI -->
    </DropDownPane>
  </div>
</ToolbarItem>
```

Do not override `toggle` unless invoking the component's actual `show()`/`hide()` API. Persistent open state is not required. Add a stable wrapper/test selector so E2E can click the extension's real `Toggle Pane` button without confusing it with other Studio panes.

Remove every E2E `page.evaluate()` that forces `.tooltip` display or directly invokes extension DOM button `.click()` merely to bypass user interaction. Tests must click the real toggle and visible keyframe buttons through Playwright locators.

Verify the pane and Studio toolbar stay fixed by comparing their viewport bounding boxes before and after page scrolling.

### 5. Make percentage editing stable

Read current percentage from the shared ScrollTrigger runtime. Remove the interval and geometry helpers.

Keep a separate draft string for the numeric input. Sync the draft from runtime percentage only while the input is not focused/being edited. On Enter or blur:

- parse and clamp;
- jump through the runtime bridge;
- restore a valid formatted draft;
- avoid a double commit from Enter followed by blur if it would cause observable trouble.

The current percentage display should continue updating from ScrollTrigger while normal scrolling occurs.

### 6. Use only public Studio extension APIs

Use:

```ts
import { useObjectSelection, useTransactions } from '@threlte/studio/extensions'
```

Obtain `vitePluginEnabled` from the returned transactions API. `buildTransaction({ object, propertyPath: 'keyframes', ... })` already constructs sync metadata from `object.userData.threlteStudio`; do not import `getThrelteStudioUserData` or override `tx.sync` unless a real manual source-write test proves the public API insufficient.

Remove the four private Vite aliases and delete `studio-types.d.ts`. Do not import private `Transaction` types. Define a narrow local structural transaction type for the guard, e.g. object plus optional sync/attributeName, without `any`.

The transaction guard must continue to suppress all ScrollAnimator source attributes except the final `keyframes` segment. Handle possible `pathItems` safely (e.g. allow `keyframes` or an attribute name ending in `.keyframes`) while ensuring transform props remain blocked on commit, undo, and redo.

### 7. Keep extension keyframes reactive across transactions

After commit, undo, or redo, refresh the selected animator's displayed keyframes from its getter. Reuse the transaction subscription so guard behavior and UI refresh occur consistently, or introduce a small explicit revision state.

History arrays must remain deep-cloned. Do not assign `animator.keyframes` redundantly after `transactions.commit()` if the transaction write already did so.

All extension operations must use the HMR-safe branded structural type, not `instanceof ScrollAnimator`.

### 8. Canonicalize duplicate percentages deterministically

`canonicalizeKeyframes()` must collapse entries whose percentages become equal after clamp/round. Define deterministic last-write-wins behavior, preserve sorted order, and deep-copy all tuples. Add cases for raw duplicates, rounding collisions, and clamp collisions at 0 and 100.

### 9. Eliminate warnings and correct declarations

Remove unused imports and all `no-explicit-any` warnings introduced by this feature. `npm run lint` must report zero errors and zero warnings.

Correct `src/gsap.d.ts` to the actual GSAP API used. In particular, official ScrollTrigger `maxScroll()` returns a number, not `{ y: number }`; remove unused declarations rather than guessing them.

## Manual source-authoring verification (mandatory)

After automated tests pass, run the application in dev mode with the real Studio Vite integration and perform this controlled experiment:

1. Select `Camera ScrollAnimator` using the Studio hierarchy.
2. Open the extension pane by clicking its real toolbar toggle.
3. Jump to a percentage, move/rotate the animator with Studio controls, stop, and wait. Confirm boolean scrub does not snap it back while scroll progress is stationary.
4. Inspect the source diff: gizmo manipulation must not add/change `position`, `rotation`, `scale`, or another transform attribute on the animator `<T>`.
5. Click `Insert/save scroll keyframe`; wait for source sync and confirm the correct literal `<T>` node's `keyframes={...}` changes.
6. Save again at the same normalized percentage and confirm replacement rather than duplication.
7. Delete that frame and confirm the correct source/list change.
8. Exercise undo and redo and confirm both source and visible list remain consistent.
9. Confirm the target animator can be authored independently.
10. Restore only the temporary experiment keyframes before final tests/reporting.

Record exact observed source-diff evidence in `status.md`. Code inspection or unit tests alone do not satisfy this requirement.

## Acceptance criteria

- The extension pane opens and closes through its real toolbar control; no CSS/display test bypass is needed.
- Studio toolbar and extension pane remain fixed in the viewport while document scrolling changes.
- One GSAP ScrollTrigger with boolean `scrub: true` drives every branded ScrollAnimator in the scene.
- Newly added/future scene ScrollAnimator instances require no hard-coded playback call.
- The extension percentage and jumps use the active trigger's `progress`, `start`, `end`, and `scroll()` through one runtime bridge.
- There is no polling interval, independent spacer-percentage math, raw window jump, numeric scrub, or animator-transform RAF/effect loop.
- Numeric percentage typing is not overwritten while focused and commits correctly on Enter/blur.
- Camera look-at uses `useTask`; `renderer.render` is never replaced by `RadViewerScene` and cannot stack across viewer remounts.
- Camera and target debug state is world-space and updates correctly.
- Selection/actions use an HMR-safe structural brand, not `instanceof ScrollAnimator`.
- Public `@threlte/studio/extensions` imports are used; private Studio aliases, declarations, metadata import, and transaction type imports are gone.
- Source-sync unavailable state still disables only mutation controls with a clear message; playback, current percentage, typed jumps, and keyframe jumps remain useful.
- Insert/update/delete/undo/redo immediately keep the visible keyframe list and animator data consistent with independent arrays.
- Only `keyframes` is source-synced for ScrollAnimator objects; transform attributes remain blocked through commit/undo/redo.
- Raw duplicate/rounded/clamped keyframe percentages canonicalize deterministically to one frame per percentage.
- Manual dev verification proves correct keyframe source writes and proves gizmo transforms do not write transform props.
- Existing Spark dual-renderer routing, editor-camera LOD safety, splat lifecycle, fixed canvas/scroll spacer, URL flow, and device behavior are unchanged.
- Free navigation remains removed and GSAP remains installed.
- `npm run check`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, and `npm run build` pass; lint has zero warnings.
- `AGENTS.md` accurately describes the final implementation without false claims about traversal, renderer wrapping, or private APIs.
- Final `status.md` describes the exact last pushed source/test state and no commit modifies files after it is written.

Re-check every acceptance criterion explicitly before finalizing.

## Tests to add or correct

### Unit/component tests

- Runtime bridge attach/update/jump/detach, trigger replacement, zero range, and no stale trigger after viewer teardown.
- Scene-wide application helper applies to every branded animator and ignores ordinary Object3Ds.
- Structural brand works for an object not constructed by the current `ScrollAnimator` class.
- Duplicate canonicalization: exact duplicates, 2-decimal rounding collisions, values clamped together at 0/100, deterministic last-write-wins.
- Guard supports public/narrow transaction shape, blocks transform/other attributes, allows root/path-prefixed keyframes, and behaves on commit/undo/redo callbacks.
- Extension keyframe-list refresh seam after commit, undo, and redo if practical without disk writes.
- Percentage draft does not update while editing and commits through the runtime bridge.

### E2E tests

- Select camera animator and click the **real** extension toggle; verify pane content appears, then close/reopen it.
- Scroll and assert toolbar/pane viewport position remains fixed.
- Type a multi-character percentage through Playwright keyboard input and verify the jump/progress; do not set input values through DOM evaluation.
- Click a visible keyframe button normally and verify camera/progress.
- Verify the source-sync-unavailable branch while retaining visible percentage/jump controls.
- Select a real non-ScrollAnimator deterministically and verify the disabled state; do not make the selection conditional.
- Navigate viewer → landing → viewer and verify look-at/render behavior has no stacked stale callback regression.
- Add a test-only third ScrollAnimator fixture if a safe seam exists and prove scene-wide playback; otherwise cover traversal in unit/component tests.

Automated tests must never mutate checked-in Svelte source. Remove all direct tooltip style manipulation and direct DOM click bypasses from E2E.

Run and report:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Trustworthy report output must give exact test counts and exact warning counts.

## Things Pi must not change

- Do not remove GSAP/ScrollTrigger or change boolean `scrub: true` to numeric scrub.
- Do not reintroduce the hard-coded camera tween or free navigation.
- Do not change the keyframe source shape unless required to fix a demonstrated bug.
- Do not change SparkStudioBridge, `createSparkStudioRenderer`, Spark override routing, editor-camera markers, LOD ownership, or renderer count.
- Do not replace or wrap `WebGLRenderer.render` in the scene.
- Do not change SplatMesh paging/lifecycle/transform or Threlte declarative ownership.
- Do not change URL validation, sample URL, landing/loading/back behavior, device profile, DPR, WebGL settings, Canvas render mode, or scroll-spacer height.
- Do not add Theatre.js or a second animation system.
- Do not access private Studio modules when public extension APIs cover the requirement.
- Do not mutate source files from automated tests.
- Do not discard or rewrite unrelated user changes.

## AGENTS.md update

Update `AGENTS.md` concisely with:

- scene-wide branded ScrollAnimator traversal/registry behavior;
- shared ScrollTrigger runtime bridge and boolean-scrub invariant;
- public Studio extension imports and source transaction guard;
- real pane authoring workflow;
- `useTask` camera-target look-at lifecycle;
- current debug/test references;
- manual source-authoring caveat.

Remove claims about renderer wrapping, polling, private aliases, or behavior that is not true in final code. Keep architecture/source references, not an implementation diary.

## Expected completion report

Overwrite `.codex-handoff/status.md` with:

1. **Summary**
2. **Files changed** (added/modified/deleted)
3. **Each verified problem above and its resolution**
4. **Acceptance criteria audit**, one row per criterion with concrete evidence
5. **Tests added/changed** with exact coverage
6. **Automated verification results** with commands, counts, errors, and warnings
7. **Manual source-authoring evidence**, including the observed diff boundaries for transform edit/save/replace/delete/undo/redo
8. **Lifecycle evidence** for real pane toggle, scene-wide playback, runtime detach, and viewer remount
9. **Known issues/deviations**
10. **Implementation commit ids and branch**; the final status-only commit may be identified as pending because its hash cannot be known before the report is committed

## Finalization sequence

1. Implement all fixes and tests.
2. Run automated verification.
3. Perform the manual source-authoring experiment and restore its temporary edits.
4. Re-run any checks affected by restoration.
5. Re-check every acceptance criterion.
6. Update `AGENTS.md`.
7. Commit the implementation/tests/docs (except the status report) intentionally if desired.
8. Write `.codex-handoff/status.md` as the **last file modification**.
9. Commit the status report and push all commits to the current branch.
10. After `status.md` is written, do not modify implementation/tests/docs. After pushing, perform no further verification or modification.
