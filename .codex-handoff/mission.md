# Mission: Keep Scroll Animator Pane Open Across Object Selection

This is a fresh feature/behavior mission, not a continuation of the prior positioning verification pass.

## Objective

Make the Scroll Animator authoring pane persistent while the user changes selection in Threlte Studio's hierarchy. Once opened, it must remain open and reactively update its contents for the newly selected object. It should close only through an explicit user action: the Scroll Animator toolbar toggle or Escape.

## Confirmed Root Cause

`FixedToolbarPane.svelte` currently installs a document-level capture-phase `pointerdown` listener. Any pointer interaction outside the panel or its anchor calls `closePanel()`. A hierarchy selection is necessarily outside both, so selecting another object dismisses the pane even though `ScrollAnimatorExtension.svelte` already reacts to `objectSelection.selectedObjects` and can update its content correctly.

Do not solve this by special-casing Studio hierarchy CSS classes. That would depend on private DOM and would still close the pane when the user interacts with other useful authoring UI such as the Inspector or transform controls.

The intended interaction model is a persistent authoring pane:

- toolbar toggle opens/closes it;
- Escape closes it;
- hierarchy, Inspector, canvas, transform-control, and other outside interactions do not close it;
- selection changes update the content in place.

## Files Likely Involved

- `src/lib/studio/scroll-animator/FixedToolbarPane.svelte`
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte` only if a narrow selection/content key or test hook is needed
- `tests/e2e/rad-viewer.spec.ts`
- `AGENTS.md`
- `.codex-handoff/status.md` as the final write

## Detailed Design

### 1. Remove outside-pointer dismissal

- Remove the document `pointerdown` listener, `handlePointerDown`, its capture-phase registration, and its cleanup.
- Do not add hierarchy-specific exceptions or inspect private Studio DOM classes.
- Preserve the existing toggle and Escape close paths.
- Preserve `autoUpdate`, body portal, fixed positioning strategy, stale-result guard, overflow behavior, and cleanup.
- Update comments and `AGENTS.md` so they no longer claim outside pointer interaction closes the pane.

The core change should be small:

```ts
onMount(() => {
  document.addEventListener('keydown', handleKeydown)
})

onDestroy(() => {
  document.removeEventListener('keydown', handleKeydown)
  stopAutoUpdate?.()
  stopAutoUpdate = undefined
})
```

Keep cleanup idempotent; avoid redundant observer teardown if a single `closePanel()` call can own it safely.

### 2. Update content reactively without remounting the pane

`ScrollAnimatorExtension.svelte` already derives `singleAnimator` from Studio selection and refreshes `uiState.animator`/`uiState.keyframes`. Preserve and verify this behavior:

- Selecting `Camera ScrollAnimator` shows its name and its keyframes.
- Selecting `Camera Target ScrollAnimator` while the pane is open keeps the same pane open and replaces the displayed name/keyframe list with that animator's data.
- Selecting a non-ScrollAnimator object while open keeps the pane open and shows the existing `Select one ScrollAnimator` state.
- Selecting multiple objects or clearing selection also keeps it open and shows the non-single-animator state.
- Returning to a ScrollAnimator updates the panel again without requiring close/reopen.
- Current percentage remains driven by the shared runtime and must not reset merely because selection changes.
- Unsaved Studio transform edits and the on-scroll-only ScrollTrigger invariant remain unchanged.

Do not key/remount `FixedToolbarPane` on selection. The open state and portal element should remain stable; only the content changes.

### 3. Preserve explicit close and focus behavior

- Clicking the active Scroll Animator toolbar button closes the pane.
- Pressing Escape closes it.
- Escape should restore focus to the actual toolbar `<button>`, not merely the non-focusable anchor wrapper. Since public `ToolbarButton` does not expose `bind:this`, a narrow query inside the owned anchor wrapper is acceptable:

```ts
function focusToggle(): void {
  anchorEl?.querySelector<HTMLButtonElement>('button')?.focus()
}
```

- Do not add a modal focus trap. The pane remains a nonmodal labelled dialog so users can interact with the hierarchy and Inspector while it stays open.

### 4. Add behavior-focused regression tests

Use native Playwright interactions where reliable in the Spark-stub e2e environment. Test at least:

1. Open Scroll Animator with `Camera ScrollAnimator` selected; verify panel, heading, name, and camera keyframes.
2. Without closing, select `Camera Target ScrollAnimator`; assert:
   - the same panel remains visible;
   - only one `.sa-panel-tooltip` exists;
   - displayed animator name changes;
   - keyframe list changes to the target animator's data.
3. Select a non-ScrollAnimator such as `PerspectiveCamera`, `CameraTarget`, or SplatMesh; assert panel remains visible and shows `Select one ScrollAnimator`.
4. Select the camera animator again; assert content returns without reopening.
5. Click elsewhere in Studio/the canvas and confirm the panel remains open.
6. Verify explicit toolbar-toggle close.
7. Reopen, press Escape, verify close and actual toggle-button focus.
8. Repeat selection switching after scrolling to 50% to ensure `autoUpdate` keeps the persistent panel in the viewport.

Prefer assertions against semantic text/roles and owned `.sa-*` selectors. Do not rely on private hierarchy class names when accessible text selection is available.

## Constraints

- Do not add hierarchy-specific, Inspector-specific, or Tweakpane-private click exceptions.
- Do not restore click-outside dismissal in another component/action.
- Do not change Floating UI `strategy: 'fixed'`, `autoUpdate`, portal behavior, positioning middleware, or viewport overflow.
- Do not change ScrollAnimator schema, interpolation, runtime progress, keyframe transactions, source-sync guard, or undo/redo.
- Do not change GSAP/ScrollTrigger or allow per-frame playback to overwrite stationary editor modifications.
- Do not change camera ownership, CameraTarget look-at, CameraControls bridge, Spark renderer/LOD routing, or SparkSplats API/origin.
- Do not reintroduce free navigation.
- Do not patch/deep-import dependencies or broadly restyle Studio.
- Do not perform unrelated refactors.

## Acceptance Criteria

- [ ] Once opened, the Scroll Animator pane remains open during hierarchy selection, Inspector interaction, canvas clicks, and other outside pointer interactions.
- [ ] Switching between Camera and Camera Target ScrollAnimators updates name and keyframes in place with exactly one panel instance.
- [ ] Selecting a non-ScrollAnimator, multiple objects, or no object keeps the pane open and shows the correct neutral state.
- [ ] Returning to a ScrollAnimator repopulates content without close/reopen.
- [ ] Selection changes do not reset scroll percentage or mutate source/animator transforms.
- [ ] Toolbar toggle and Escape remain the only close mechanisms.
- [ ] Escape returns focus to the actual Scroll Animator toolbar button.
- [ ] Persistent pane remains correctly fixed/in viewport while selection changes at nonzero scroll.
- [ ] Outside-pointer listener and related documentation/tests are fully removed.
- [ ] Existing positioning, camera, animation, source-sync, and Spark behavior remains intact.
- [ ] New e2e tests cover the complete selection-switching sequence and explicit close paths.

Re-check every acceptance item immediately before finalizing. Test implementation details pragmatically; prioritize the user-visible persistent-pane behavior and honest reporting.

## Tests to Run

Add/update tests, then run:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Manual verification with `https://avner.us/baby_yoda-lod.rad`:

1. Open Scroll Animator.
2. Select Camera ScrollAnimator, Camera Target ScrollAnimator, the camera child, and the SplatMesh in succession.
3. Confirm the pane never closes and its content follows selection.
4. Scroll to the middle and repeat.
5. Confirm toggle and Escape still close it deliberately.

If real WebGL automation requires synthetic events, report that limitation honestly; the core evidence is persistent visibility and reactive content across actual selection changes.

## Things Pi Must Not Change

- FixedToolbarPane fixed/auto-update positioning architecture.
- ScrollAnimator animation, authoring, and source synchronization.
- Camera/CameraTarget hierarchy and editor-camera behavior.
- CameraControls bridge.
- Spark renderers, LOD behavior, and SparkSplats simplification.
- Unrelated application UI, dependencies, configuration, and tests.

## AGENTS.md Update

Update `AGENTS.md` concisely to state:

- Scroll Animator is a persistent nonmodal authoring pane;
- outside pointer interactions do not close it;
- only the toolbar toggle and Escape close it;
- selection changes update the pane in place, including the neutral state for non-single-ScrollAnimator selection;
- Escape restores focus to the actual toggle button.

Do not add a chronological implementation log.

## Expected Completion Report

Write `.codex-handoff/status.md` with:

1. Summary and implementation commit.
2. Files changed.
3. Root cause and dismissal-policy change.
4. Selection/content state behavior for camera animator, target animator, and non-animator selection.
5. Explicit toggle/Escape/focus behavior.
6. Nonzero-scroll persistent-pane evidence.
7. Automated and real Baby Yoda verification results.
8. Exact test command results.
9. Acceptance audit and remaining risks.

Always write `status.md` as the **last action** before committing and pushing. After writing it, do not run verification, edit documentation, or make any other modification. Commit all work and push the current branch.
