# Mission: Repair Studio Camera Ownership and Scroll-Safe Authoring UI

This is a new mission based on first-use testing, not a continuation or verification-only follow-up.

## Objective

Fix the following authoring problems without regressing ScrollAnimator playback, source synchronization, Spark LOD routing, or Studio's own editor-camera mode:

1. Make the `PerspectiveCamera` nested under `Camera ScrollAnimator` the real/default Threlte camera. With Studio's editor camera disabled, moving either that camera or its parent in Studio must immediately change the rendered default-camera view.
2. Keep Studio's toolbar and standard floating panes attached to the viewport while the document scrolls. The Scroll Animator pane already appears fixed; the toolbar, Scene Hierarchy, Inspector, Static State, and Default Camera preview must not scroll away.
3. Remove or repair the inert, button-looking `Scroll Animator` title inside the opened dropdown.
4. Give the Scroll Animator toolbar control an appropriate icon.
5. Add a small, typed, future-facing access/configuration seam for Studio editor `CameraControls` parameters without importing Studio private modules or patching dependencies.
6. Use `https://avner.us/baby_yoda-lod.rad` for real-browser/manual testing and record it in `AGENTS.md` as the preferred lightweight authoring-test RAD for future sessions.

## Important Findings and Intended Behavior

- Studio's editor camera is intentionally separate and its enabled state is persisted. When it is enabled, the main Studio viewport is expected to use the editor camera. Do **not** eliminate that feature or force it permanently off. The defect is that, when editor-camera mode is disabled, Studio/Threlte must restore and render the exact application `PerspectiveCamera` nested below `Camera ScrollAnimator`.
- The app currently creates that camera manually and registers it imperatively in `onMount` with `threlte.camera.set(camera)` and `makeDefaultCameras.add(camera)`. This timing can cause Studio to capture or restore a fallback/incorrect default camera. Prefer Threlte's declarative camera ownership (`makeDefault` on the nested `<T is={camera}>`) and remove redundant manual registration and unused `useCamera` plumbing.
- Studio's toolbar, Scene Hierarchy, and Inspector are configured by Studio as fixed panes. The Default Camera pane is draggable, but its outer container is also intended to be fixed to the viewport. Disappearing on page scroll is not desired behavior.
- `DropDownPane` renders an inline pane title with `userExpandable={false}`. The title can therefore look like an actionable button while doing nothing. Fix that presentation in a narrowly scoped way.
- The installed Studio `CameraControls.svelte` constructs `cameraControls` internally and does not expose that object through a supported public API. A local bridge/config stub may prepare for future access, but must not claim to be connected today. A real connection will require an upstream public hook or a deliberately owned replacement editor-camera extension.

## Files Likely Involved

- `src/lib/components/RadViewerScene.svelte`
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte`
- `src/App.svelte` and/or the narrowest appropriate global Studio overlay stylesheet
- A new focused module under `src/lib/studio/editor-camera/`, for example `editorCameraControlsBridge.ts`
- Relevant unit tests under `tests/unit/`
- `tests/e2e/rad-viewer.spec.ts`
- `AGENTS.md`

Inspect only the necessary installed Studio/svelte-tweakpane source to identify the rendered portal/container structure. Do not modify `node_modules`.

## Detailed Design

### 1. Correct default-camera ownership

- Keep the `PerspectiveCamera` as a child of `Camera ScrollAnimator` in the Threlte tree.
- Register that nested camera declaratively as the default, approximately:

```svelte
<T is={cameraAnimator} ...>
  <T is={camera} name="PerspectiveCamera" makeDefault />
</T>
```

- Remove the imperative camera registration and any resulting unused `useCamera` import/context. Let Threlte handle registration, restoration, and cleanup.
- Verify exact object identity, not merely matching transforms: with Studio editor-camera mode off, the active Threlte camera must be this `camera` instance.
- Verify both child-local and parent transforms affect the rendered view. The camera's per-frame `lookAt(CameraTarget)` intentionally owns camera orientation; do not mistake that for a position/parent-transform failure.
- Preserve Studio's editor-camera toggle. When it is on, editing/navigating the Studio camera is expected; when switched off, the nested app camera must be restored.
- Preserve Spark routing: Studio editor cameras remain marked/routed as editor views and must never drive LOD; the real nested app camera remains the LOD-driving camera.
- Preserve the rule that ScrollTrigger applies animator poses only from its `onUpdate` scroll path. Stationary authoring edits must not be overwritten each frame.
- Add a small diagnostic/test seam if needed (for example an attribute on the existing hidden camera debug element indicating whether the app camera is active) rather than exposing production controls.

### 2. Make all Studio overlay UI scroll-safe

- Reproduce using the lightweight RAD URL. Before changing CSS, inspect computed `position`, portal parent, and bounding rectangles at the top and after a substantial `window.scrollTo` for:
  - main toolbar,
  - Scene Hierarchy,
  - Inspector,
  - Static State where present,
  - Default Camera preview,
  - Scroll Animator dropdown.
- Fix the smallest application integration/CSS boundary that makes the affected top-level Studio pane roots viewport-fixed.
- Be careful: Tweakpane's base `.tp-dfwv` may default to `position: absolute`, while Studio/svelte-tweakpane asks for a fixed pane. A targeted app-level rule may be necessary, but it must select only body/portal-level Studio floating panes. It must **not** turn the inline pane nested in `DropDownPane` into a fixed global pane.
- Avoid a broad global `.tp-dfwv { position: fixed }` unless the DOM proves it cannot affect inline panes. Prefer an owned wrapper/data marker or a sufficiently precise top-level selector.
- Preserve dragging, pane positions, z-index ordering, pointer interaction, and the fixed canvas/scroll-spacer layout.
- Add an e2e regression that records bounding coordinates, scrolls, and asserts viewport-fixed elements retain their viewport coordinates within a small tolerance. Use the Spark stub for deterministic automated coverage; also manually verify with the lightweight real RAD.

### 3. Eliminate the inert inner “Scroll Animator” control

- Inspect the actual DOM. The opened dropdown must not contain a button/clickable-looking `Scroll Animator` title that has no action.
- Preferred result: retain one clear, semantic static heading for the panel while narrowly hiding/removing the non-expandable Tweakpane title-row button. Alternatively, make the title genuinely perform a sensible expand/collapse action if that can be done using public APIs without confusing the outer toolbar toggle.
- Scope the fix to this extension. Do not hide or alter Studio's other pane title bars.
- Add a DOM/e2e assertion that the open extension has no inert button named `Scroll Animator`, while its controls remain reachable and labeled.

### 4. Add a toolbar icon

- Pass an icon supported by Studio's public extension API to `DropDownPane`; `mdiAnimationOutline` is a good default (use the exact supported icon name/type).
- Verify the toolbar control renders the icon and still opens/closes the pane. Preserve an accessible name or tooltip; do not make the control icon-only and unlabeled to assistive technology.

### 5. Future-facing editor CameraControls seam

Create a deliberately small local module that separates desired tuning from the currently inaccessible Studio instance. A structural interface avoids depending on Studio internals, for example:

```ts
export interface EditorCameraControlsLike {
  smoothTime: number
  draggingSmoothTime: number
  dollyToCursor: boolean
}

export interface EditorCameraControlsTuning {
  smoothTime: number
  draggingSmoothTime: number
  dollyToCursor: boolean
}

export const DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING = { /* current Studio defaults */ }
export function applyEditorCameraControlsTuning(
  controls: EditorCameraControlsLike,
  tuning: EditorCameraControlsTuning,
): void { /* narrow assignment */ }
```

A tiny attach/detach/get-current bridge is acceptable if useful, but its current value must honestly remain `null`/unattached until a supported owner supplies an instance. Do not use deep/private imports from `@threlte/studio`, do not reach into component internals, and do not patch `node_modules`. Document in code and `AGENTS.md` that an upstream hook or owned editor-camera extension is required to connect it.

Add focused unit tests for defaults, application, and attach/detach behavior if included. Do not add UI controls for these future parameters in this mission.

### 6. Lightweight RAD testing and durable documentation

- Use `https://avner.us/baby_yoda-lod.rad` for real dev-server/manual authoring verification, including loading, camera ownership, pane scrolling, toolbar interaction, and parent/child transform behavior.
- Update `AGENTS.md` with a concise “Lightweight authoring-test RAD” entry and update the screenshot/manual-testing guidance to prefer it where GPU stalls previously made Studio interaction impractical.
- Keep the existing larger sample documented if it remains valuable for high-load/LOD testing. Do not silently change the application's user-facing default URL unless a code/test requirement independently justifies it.
- Verify the RAD and its chunk requests load with CORS. If external availability blocks a test, report the exact request/error; do not disguise that as an application failure.

## Additional Caveats

- Studio can persist editor-camera mode across reloads. Manual and automated tests must explicitly establish whether editor-camera mode is on or off before judging the application default camera.
- Object transforms are local. Testing a transformed `ScrollAnimator` parent must inspect the camera world transform/rendered view, not only the camera child's local `position`.
- The per-frame `lookAt` updates the real camera quaternion. It should continue to aim at `CameraTarget`; parent/child position editing must still change the view.
- CSS for Studio is portal-based and may cross Svelte style scoping boundaries. If global CSS is necessary, make the selector precise and leave a comment explaining the required DOM contract.
- Browser automation timeouts are not evidence of correctness. The lightweight RAD was provided specifically to enable the previously deferred real Studio interaction checks; attempt those checks and report evidence.

## Constraints

- Use only public Threlte/Studio APIs in application code.
- Do not patch, vendor, or deep-import `node_modules` implementation files.
- Do not replace GSAP/ScrollTrigger or its scrubbed scroll behavior.
- Do not reintroduce free navigation or any removed free-navigation UI/code/tests.
- Do not make ScrollTrigger write transforms continuously outside `onUpdate`.
- Do not let ordinary Studio transform transactions for `ScrollAnimator` write position/rotation into Svelte source; only explicit keyframe save/delete operations may source-sync `keyframes`.
- Do not break camera-target look-at, source authoring, undo/redo, dual SparkRenderer routing, LOD ownership, or mobile performance settings.
- Do not perform unrelated refactors or dependency upgrades.

## Acceptance Criteria

- [ ] With Studio editor-camera mode disabled, Threlte's active/default camera is the exact nested `PerspectiveCamera` instance under `Camera ScrollAnimator`.
- [ ] Moving that camera or its parent while the page is stationary visibly changes the default-camera render and is not immediately overwritten.
- [ ] Enabling Studio editor-camera mode still works; disabling it restores the nested app camera and its current world transform.
- [ ] CameraTarget look-at and Spark editor/default-camera LOD routing remain correct.
- [ ] Main Studio toolbar and all standard floating panes remain at stable viewport coordinates throughout document scrolling; the inline Scroll Animator content remains attached to its outer dropdown.
- [ ] The open extension contains no inert button-looking `Scroll Animator` title.
- [ ] The Scroll Animator toolbar control has a suitable icon, accessible labeling, and working open/close behavior.
- [ ] A typed, tested, dependency-private-free CameraControls tuning/bridge stub exists and is clearly documented as unattached pending a supported hook.
- [ ] `https://avner.us/baby_yoda-lod.rad` is used successfully for manual real-browser verification and recorded in `AGENTS.md` for future sessions, or any external loading failure is precisely evidenced.
- [ ] Existing ScrollAnimator insert/update/delete/jump/source-sync/undo behavior remains working.
- [ ] New regression tests cover default-camera ownership/restore behavior, fixed overlay coordinates, icon/inert-title behavior, and CameraControls tuning stub logic.
- [ ] All relevant automated checks pass, or each failure is reported accurately with its command, output summary, and reason.

Re-check every acceptance item immediately before finalizing. Do not label partial, deferred, or untested criteria as complete.

## Tests to Run

Add tests for the new behavior, then run:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Manual real-browser verification with `https://avner.us/baby_yoda-lod.rad` must include:

1. Explicitly turn Studio editor-camera mode off; select and move the nested `PerspectiveCamera`, then its `Camera ScrollAnimator` parent, and confirm the default view follows each edit.
2. Turn Studio editor-camera mode on, move/navigate it, then turn it off and confirm the app camera is restored at the authored world pose.
3. Open all relevant Studio panes, capture viewport bounding coordinates at scroll top, scroll to at least 50% and near 100%, and confirm coordinates remain stable and panes remain interactive.
4. Confirm the Scroll Animator icon, open/close action, absence of a dead inner title button, percentage jump, keyframe selection, and explicit save behavior.
5. Confirm stationary gizmo edits are not overwritten until a real scroll update and that ordinary ScrollAnimator transform edits do not source-sync position/rotation.
6. Confirm both real and Studio editor camera paths render the lightweight splat and only the real camera drives Spark LOD.

Include concise evidence (observed object identity/state, before/after bounding coordinates, and relevant source diff behavior) in the completion report. Do not treat DOM `.click()` alone as sufficient evidence for pointer usability when normal pointer interaction is feasible with the lightweight RAD.

## Things Pi Must Not Change

- Do not change the core ScrollAnimator keyframe schema or interpolation semantics.
- Do not replace the single scene-wide ScrollTrigger or add per-animator triggers.
- Do not restore the Free transform/free-navigation feature.
- Do not patch Studio, svelte-tweakpane, or CameraControls dependency source.
- Do not expose a fake CameraControls instance or claim the stub is wired when it is not.
- Do not broadly restyle unrelated Tweakpane or Studio UI.
- Do not change the existing larger RAD sample's role as a high-load sample merely because the new lightweight URL is preferred for authoring tests.
- Do not modify unrelated application behavior, configuration, or dependencies.

## AGENTS.md Update

Update `AGENTS.md` with concise, fresh-session-useful information and source references for:

- declarative ownership of the nested default camera and the editor-camera toggle distinction,
- the targeted fixed-overlay CSS/DOM contract,
- the Scroll Animator toolbar icon and panel-heading behavior,
- the CameraControls tuning/bridge stub and its current public-API limitation,
- `https://avner.us/baby_yoda-lod.rad` as the preferred lightweight manual authoring-test file.

Do not turn `AGENTS.md` into a chronological implementation log.

## Expected Completion Report

Write `.codex-handoff/status.md` with:

1. Summary and implementation commit(s).
2. Files changed and why.
3. Root cause of the wrong default camera and the exact ownership/lifecycle fix.
4. Root cause of scrolling Studio panes, the final scoped selector/DOM contract, and before/after scroll bounding-coordinate evidence.
5. How the inert title was removed/repaired and which icon was added.
6. CameraControls stub API, tests, and a clear statement of whether it is connected (it should not be unless a supported public path was found and evidenced).
7. Automated tests added plus exact command results.
8. Manual results using the lightweight RAD, including camera identity/toggle behavior, real pointer interactions, source-write observations, and Spark routing.
9. Acceptance-criteria audit marking each item met, partial, blocked, or not met with evidence.
10. Remaining risks or known issues without minimizing them.

Always write `status.md` as the **last action** before the final commit/push. After writing it, do not run more verification and do not make more modifications. Commit all work, including the report and `AGENTS.md`, and push the current branch.
