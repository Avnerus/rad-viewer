# Follow-up Mission: Correct Verification Gaps and Finalize the Studio Repair

## Objective

Keep the successful declarative camera fix, fixed-pane CSS behavior, toolbar icon, and the user's post-report SparkSplats simplification. Correct the remaining implementation/documentation mismatches and produce a genuinely final, current status report.

This pass is narrowly scoped. Do not redesign ScrollAnimator or undo the user's commit `bff86c7`.

## Verified Review Findings

1. `DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING` does **not** match the installed Studio implementation. Installed `@threlte/studio/dist/extensions/editor-camera/CameraControls.svelte` sets:

```ts
cameraControls.smoothTime = 0.05
cameraControls.draggingSmoothTime = 0.05
cameraControls.dollyToCursor = true
```

The bridge currently uses `0.25`, `0.18`, and `false` while claiming to match Studio. Correct the constants, tests, and documentation to the installed values.

2. The bridge documentation says `getCurrentControls()` “always returns null,” but the module intentionally exposes `attachControls()` and its tests prove the getter returns an attached object. Correct wording everywhere: the singleton is **unattached by default/in current app integration**, so it returns `null` until a future supported owner calls `attachControls()`.

3. The inert Scroll Animator title was only styled with `pointer-events: none`. It remains a real button in the DOM/accessibility tree and may remain keyboard-focusable/actionless. The e2e test title says the button is gone but only asserts mouse pointer behavior. This does not meet the semantic requirement.

4. Fixed-overlay coverage and manual evidence inspect only the first `.tp-dfwv` (the toolbar), yet the report marks the toolbar and all floating panes complete. Verify each relevant pane rather than extrapolating from one element.

5. The user's commit `bff86c7` landed after Pi wrote the status report and after the reported checks. The final report therefore omits the current `SparkSplats` API and is not the last repository action.

6. `AGENTS.md` still contains a stale transaction-guard description saying path-prefixed keyframes use `startsWith('keyframes.')`. The implemented guard accepts only `keyframes` or a path ending in `.keyframes` and blocks descendants. Correct this while updating the current documentation.

## Files Likely Involved

- `src/lib/studio/editor-camera/editorCameraControlsBridge.ts`
- `tests/unit/editorCameraControlsBridge.test.ts`
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte`
- `src/app.css`
- `tests/e2e/rad-viewer.spec.ts`
- `src/lib/components/SparkSplats.svelte` only for a truthful comment/name if needed; preserve its API simplification
- `AGENTS.md`
- `.codex-handoff/status.md` as the final file action

## Required Changes

### 1. Correct CameraControls defaults and bridge documentation

- Change the three default tuning values to `0.05`, `0.05`, and `true`.
- Update unit fixtures and assertions accordingly.
- Preserve the structural, dependency-private-free attach/detach API.
- Replace every “always returns null” claim with precise wording: no production integration currently attaches an instance; `getCurrentControls()` returns `null` by default and returns the attached object after an explicit future `attachControls()` call.
- Keep the limitation clear: connecting Studio's internal instance still needs a supported upstream hook or an owned replacement editor-camera extension.

### 2. Remove the inert title semantically

- In the Scroll Animator extension only, ensure the non-expandable Tweakpane title-row button is not visible, focusable, or exposed as an actionable accessibility element.
- A safe approach is to hide that narrowly scoped generated title row with `display: none` and add an explicit semantic heading such as `<h2 class="sa-heading">Scroll Animator</h2>` inside the extension content. Apply it in both selected and unselected panel states.
- Do not hide title rows belonging to other Studio dropdowns or floating panes.
- Replace the misleading e2e test with assertions that:
  - no visible/focusable button named `Scroll Animator` exists inside the open extension;
  - a semantic heading named `Scroll Animator` is visible;
  - the real outer toolbar toggle still opens/closes the pane.
- Keep the `mdiAnimationOutline` icon.

### 3. Verify every required fixed overlay

- Preserve `.tp-dfwv { position: fixed !important }` only if DOM inspection confirms `.tp-dfwv` is the fixed-pane root class and does not affect inline dropdown panes. Record that evidence accurately.
- Extend the e2e test to identify and test all relevant elements independently, not `document.querySelector('.tp-dfwv')` alone:
  - main toolbar;
  - Scene Hierarchy;
  - Inspector;
  - Static State if enabled/present;
  - Default Camera preview when enabled;
  - Scroll Animator dropdown/tooltip.
- Open/enable panes as needed, capture named elements' viewport rectangles at the top, scroll to 50% and near the bottom, and assert each remains stable and visible within a small tolerance.
- If one item uses a different fixed/draggable wrapper rather than `.tp-dfwv`, test its actual outer viewport-positioning element.
- Do not claim an absent/unopened pane was verified. Report individual results.

### 4. Strengthen the camera regression without redesigning it

- Keep `<T is={camera} makeDefault />` and the removal of imperative camera registration.
- Add automated coverage that explicitly establishes editor-camera mode off, verifies `data-active="true"`, toggles editor-camera mode on and observes `false`, then toggles it off and observes `true` again.
- Preserve the manual evidence that parent transforms alter the app camera world transform while stationary.
- Do not add more per-frame transform writers. If convenient, combine diagnostic work into the existing task, but this is not required.

### 5. Preserve and document the user's SparkSplats change

The user intentionally:

- removed the scene-level offset so Baby Yoda is at the origin and visible;
- removed `position`, `rotation`, and `scale` component props from `SparkSplats` because Studio authors the actual nested `<T is={mesh}>`, not wrapper props.

Preserve this behavior. `SparkSplats` should accept only `url` unless another existing non-transform prop is genuinely required. Update its comment and `AGENTS.md` to state that the SplatMesh `<T>` is the Studio-editable object and component transform props are intentionally not exposed.

Do not re-add the old `[5, -6, -5]` offset or wrapper transform props. Use `https://avner.us/baby_yoda-lod.rad` for the final manual check.

### 6. Repair durable documentation

Update `AGENTS.md` concisely with:

- accurate transaction-guard suffix semantics;
- accurate CameraControls defaults and attach/null semantics;
- semantic Scroll Animator heading behavior;
- actual overlay selector/DOM contract established by testing;
- current `SparkSplats` API and direct Studio-editable `<T>` mesh;
- the lightweight Baby Yoda RAD guidance already added.

Do not add a chronological log.

## Constraints

- Do not undo the user's `bff86c7` origin/API change.
- Do not patch or deep-import `node_modules`.
- Do not replace GSAP/ScrollTrigger or change interpolation/keyframe semantics.
- Do not reintroduce free navigation.
- Do not alter ScrollTrigger's on-scroll-only animator updates.
- Do not let ordinary ScrollAnimator transforms source-sync position/rotation/scale.
- Do not change Spark dual-renderer/LOD routing.
- Do not broadly hide Tweakpane title rows or broadly restyle unrelated Studio controls.
- Do not perform unrelated refactors or dependency upgrades.

## Acceptance Criteria

- [ ] CameraControls bridge defaults exactly match installed Studio: `0.05`, `0.05`, `true`.
- [ ] Bridge docs consistently say “unattached by default/current integration,” not “always null”; attach/detach tests remain truthful.
- [ ] The open extension has a visible semantic `Scroll Animator` heading and no visible/focusable/actionless title button of that name.
- [ ] The animation icon and outer open/close toolbar control still work.
- [ ] Automated rectangle checks independently cover every relevant toolbar/floating pane listed above at multiple scroll positions.
- [ ] Editor-camera automated coverage proves the active camera transitions `true → false → true` across off/on/off.
- [ ] Declarative default camera, CameraTarget look-at, stationary authoring behavior, and Spark routing remain intact.
- [ ] `SparkSplats` remains at origin, exposes no transform props, and its nested `<T is={mesh}>` remains Studio-editable.
- [ ] `AGENTS.md` is accurate on guard semantics, CameraControls, pane positioning, the extension heading, SparkSplats, and the Baby Yoda test URL.
- [ ] All relevant checks are rerun after the user's `bff86c7` change and pass, or failures are reported exactly.

Re-check every acceptance item before finalizing. Do not mark extrapolated, partial, or untested behavior complete.

## Tests to Run

Add/update regression tests, then run:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Manual browser verification with `https://avner.us/baby_yoda-lod.rad` must confirm:

1. Baby Yoda is centered/visible with the SplatMesh at origin.
2. App/editor/app camera switching restores the nested camera.
3. A stationary parent edit changes the camera world transform and is not overwritten.
4. Each named Studio toolbar/pane remains fixed and interactive at top, middle, and bottom scroll positions.
5. The extension has its icon, real outer toggle, semantic heading, and no dead inner button.

If headless WebGL remains black, distinguish that limitation from the nonvisual DOM/camera checks and do not claim visual splat confirmation without a real visible render.

## Things Pi Must Not Change

- The user's origin and SparkSplats transform-prop removal.
- ScrollAnimator keyframe data or interpolation behavior.
- The single scene-wide ScrollTrigger/runtime architecture.
- CameraTarget look-at behavior.
- Spark renderer ownership and LOD invariants.
- Unrelated UI, configuration, dependencies, or tests.

## Expected Completion Report

Rewrite `.codex-handoff/status.md` with:

1. Summary and all implementation/user commit IDs in scope.
2. Complete changed-file list, including the user's `SparkSplats` change.
3. Each review finding and its resolution.
4. Exact CameraControls defaults and truthful attach/null semantics.
5. Semantic DOM/accessibility evidence for the heading and absence of a dead title button.
6. Per-element fixed-overlay coordinate evidence at top/middle/bottom.
7. Camera off/on/off evidence.
8. Baby Yoda/SparkSplats verification and any headless visual limitation.
9. Exact automated check results run after all code changes.
10. Acceptance audit and remaining risks.

Always write `status.md` as the **last action** before the final commit and push. After writing it, do not run more verification and do not make more modifications. Commit all changes and push the current branch.
