# Mission: ScrollAnimator authoring extension for Threlte Studio

## Objective

Replace the hard-coded two-pose camera tween and all free-navigation behavior with a reusable scroll-keyframed `ScrollAnimator` Object3D plus a Threlte Studio authoring extension.

Retain GSAP ScrollTrigger as the optimized scroll-progress driver. Use boolean `scrub: true`, never a numeric scrub duration, so animator progress is directly tied to scrollbar progress and does not continue easing after scrolling stops.

An author must be able to select a `ScrollAnimator` in Studio, jump/scroll to a percentage, pose it with Studio transform controls, insert or update a keyframe, inspect/delete its keyframes, and have keyframe data persisted into the selected animator's literal `<T ... keyframes={...}>` node in Svelte source. Runtime scrolling interpolates every `ScrollAnimator`. The real camera is parented by one animator and always looks at a new `CameraTarget`, which is parented by a second animator.

Interpret the request to remove the “Free transform” checkbox as removal of the existing **Free navigation** checkbox and all associated implementation/tests.

Relevant official documentation:

- Threlte authoring extensions: https://threlte.xyz/docs/reference/studio/authoring-extensions/
- Threlte object selection: https://threlte.xyz/docs/reference/studio/use-object-selection/
- Threlte transactions/source sync: https://threlte.xyz/docs/reference/studio/use-transactions/
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/

The installed version is `@threlte/studio` 0.4.3. Its public extension surface includes `useStudio`, `ToolbarItem`, `ToolbarButton`, and `DropDownPane` from `@threlte/studio/extend`, plus `useObjectSelection` and `useTransactions` from `@threlte/studio/extensions`.

## Files likely involved

Keep discovery targeted. Likely files to add/change/remove:

- `src/App.svelte`
- `src/app.css`
- `src/lib/components/RadViewerScene.svelte`
- New runtime/controller component if useful, such as `src/lib/components/ScrollAnimatorRuntime.svelte`
- New `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte`
- New supporting extension types/helpers in `src/lib/studio/scroll-animator/`
- New `src/lib/spark/ScrollAnimator.ts`
- New pure keyframe helpers such as `src/lib/spark/scrollAnimation.ts`
- `src/lib/types.ts` if shared public types belong there
- `tests/e2e/rad-viewer.spec.ts`
- New unit/component tests for scroll animation and the extension transaction guard
- Remove `src/lib/spark/freeNavigation.ts`
- Remove `tests/unit/freeNavigation.test.ts`
- Remove or replace obsolete `src/lib/spark/cameraTween.ts` and `tests/unit/cameraTween.test.ts`
- Keep `src/gsap.d.ts`, `gsap`, and the existing GSAP package entries unless a targeted type correction is needed
- `AGENTS.md`

Do not scan unrelated repository areas.

## Detailed design

### 1. Keyframe model and interpolation

Use a serializable, source-friendly shape. A recommended contract is:

```ts
export type Vec3Tuple = [number, number, number]

export type ScrollKeyframe = {
  /** Percentage in the inclusive range 0..100. */
  scroll: number
  position: Vec3Tuple
  /** XYZ Euler radians, stored for readable source authoring. */
  rotation: Vec3Tuple
}
```

Create pure functions for:

- clamping/normalizing percentage values;
- canonicalizing keyframes (deep copy, clamp, deterministic sort);
- upserting at a percentage (same normalized percentage replaces, never duplicates);
- deleting at a percentage;
- finding the bracketing keyframes;
- sampling a transform at any percentage.

Behavior must be explicit and tested:

- zero keyframes: do not mutate the animator;
- one keyframe: use it at every percentage;
- before first/after last: clamp to the endpoint transform;
- exact keyframe percentage: reproduce that keyframe exactly;
- duplicate insertion: replace the existing frame;
- position: `Vector3.lerp` semantics;
- rotation: store Euler XYZ values, but convert endpoint rotations to quaternions and use shortest-path quaternion slerp. Do not component-lerp Euler angles across ±π;
- source precision should be stable (Studio defaults to four decimals). Choose and document a deterministic percentage precision so wheel-scroll noise does not create near-duplicate frames. A percentage precision of 2–3 decimals is sufficient.

Do not animate scale; the requested animator contract is position + rotation.

### 2. `ScrollAnimator` as a real Object3D

Implement `ScrollAnimator` as a class extending Three.js `Object3D`, not merely a wrapper component. Give it an HMR-safe brand such as `isScrollAnimator = true`, a useful `type = 'ScrollAnimator'`, and a `keyframes` property/setter that accepts plain serialized arrays and owns canonical deep copies.

It should expose an imperative method similar to:

```ts
applyScrollPercentage(percent: number): void
```

That method samples the current keyframes and applies local `position` and `quaternion`/`rotation` only when a sample exists.

Use distinct class instances directly in `RadViewerScene.svelte`. This is important for Studio's source metadata:

```svelte
<T
  is={cameraAnimator}
  name="Camera ScrollAnimator"
  keyframes={[
    { scroll: 0, position: [0, 0, -1], rotation: [0, 0, 0] },
    { scroll: 100, position: [0, 30, -1], rotation: [0, 0, 0] }
  ]}
>
  <T is={camera} name="PerspectiveCamera" />
</T>

<T
  is={targetAnimator}
  name="Camera Target ScrollAnimator"
  keyframes={[
    { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] }
  ]}
>
  <T is={cameraTarget} name="CameraTarget" />
</T>
```

The exact formatting/default transforms can differ, but preserve the current initial perspective-to-top-down motion and fixed-origin target as initial authored keyframes.

Do **not** hide these two per-instance `<T>` nodes inside a reusable Svelte wrapper. Studio 0.4.3 attaches source sync metadata to literal `<T>` nodes by module id and component index; a wrapper would point both uses at the wrapper implementation rather than at independent keyframe attributes in `RadViewerScene.svelte`.

### 3. Retain ScrollTrigger as the runtime progress driver

Keep GSAP and `ScrollTrigger`. Remove only the old hard-coded camera-pose sampling.

Create one ScrollTrigger for the existing `.scroll-spacer` range. It should resemble:

```ts
scrollTrigger = ScrollTrigger.create({
  trigger: spacer,
  start: 'top top',
  end: 'bottom bottom',
  scrub: true,
  onUpdate: ({ progress }) => {
    applyScrollAnimators(progress * 100)
  },
})
```

Critical ScrollTrigger invariants:

- `scrub` must be boolean `true`; do not use `scrub: 0.5`, `scrub: 1`, or any numeric smoothing duration;
- do not attach the animators to a GSAP tween/timeline whose playhead can keep changing after scrollbar movement stops;
- apply animator transforms only from ScrollTrigger progress changes, plus one explicit initial application after creation;
- do not run a per-frame/effect loop that reapplies animator positions or rotations;
- let ScrollTrigger retain its requestAnimationFrame synchronization, scroll-event debouncing, and automatic resize/refresh calculations;
- cleanly kill the trigger on destroy;
- preserve the fixed canvas + `.scroll-spacer` document layout.

With boolean scrub, ScrollTrigger progress is directly linked to scrollbar progress. This preserves GSAP's optimized scheduling without allowing delayed scrub updates to overwrite a stationary Studio gizmo edit.

A small scene traversal for branded `ScrollAnimator` instances inside `onUpdate` is acceptable and makes future animators work without manual registration. Alternatively maintain an explicit registry with correct register/unregister cleanup. Keep one ScrollTrigger, not one trigger per animator.

Expose the trigger's current percentage reactively to the authoring extension without making runtime playback depend on Studio being enabled.

Programmatic percentage jumps should use the ScrollTrigger's measured range after refresh, not make an independent guess that can drift from it:

```ts
const targetScroll = trigger.start + (clampedPercent / 100) * (trigger.end - trigger.start)
trigger.scroll(targetScroll)
```

If the public typings used by the project do not expose `start`, `end`, or `scroll`, update the narrow local declaration accurately. Do not fall back to `document.body.scrollHeight`. A helper based on `ScrollTrigger.maxScroll(window)` is also acceptable if it exactly matches the configured trigger range.

Creating the trigger must establish the correct initial pose at the current progress, including reload/browser scroll restoration. Do this once during setup; do not introduce continuous reapplication.

### 4. Camera and `CameraTarget` hierarchy

- Parent the real `PerspectiveCamera` under `Camera ScrollAnimator`.
- Create a named `CameraTarget` `Object3D` and parent it under a second `ScrollAnimator`.
- The real camera must always look at `CameraTarget`'s **world position**, including while an author is moving either animator with Studio gizmos.
- Update look-at after parent world matrices are current. A lightweight Threlte render task that only updates camera orientation is appropriate; it must not write either animator's position/rotation.
- Because look-at defines the final viewing direction, it intentionally wins over the camera object's own orientation. Generic animator rotation remains supported and affects ordinary children (and any offset child position), but do not let camera rotation fight the target constraint.
- Keep existing default-camera registration through Threlte context and preserve the Spark real-camera/editor-camera renderer routing.
- Camera debug state must report camera and target **world** positions after parenting. Remove free-navigation-only debug attributes (`data-freenav`, yaw, pitch, zoom) and update tests accordingly.

### 5. Studio extension UI

Register the custom extension through `<Studio extensions={[ScrollAnimatorExtension]}>`.

Use `createExtension` with a unique scope and include the required scene slot/snippet. Use `useObjectSelection()` to derive the selected object. The UI is active only when exactly one branded `ScrollAnimator` is selected; otherwise show a concise “Select one ScrollAnimator” state and disable mutation controls.

Add a Studio toolbar item with a fixed `DropDownPane` (or equivalent fixed top Studio pane) containing:

1. Current ScrollTrigger percentage, live-updated from trigger progress.
2. A numeric input allowing 0..100; commit on Enter/change/blur, clamp invalid values, and scroll there automatically through the trigger range.
3. A sorted list of the selected animator's keyframes.
4. A clickable percentage for each row that jumps to that trigger percentage.
5. A delete button for each row.
6. One clearly labelled `Insert/save scroll keyframe` button.

Native HTML controls inside the exported `DropDownPane` are acceptable and avoid depending directly on Studio's transitive `svelte-tweakpane-ui` package. Make buttons keyboard accessible and provide useful disabled/empty states.

The Studio toolbar is already implemented as a fixed Tweakpane at `y=6`; the new pane must remain fixed and usable while the document scrolls. Verify this behavior rather than adding a competing page-level toolbar. Ensure the app's viewer header does not obscure Studio authoring controls; adjust z-index/offset only as needed.

Insert/save captures the selected animator's current **local** position and XYZ Euler rotation at the current normalized percentage. It upserts an existing frame at that percentage. The list must update immediately.

Clicking a keyframe changes ScrollTrigger's scroll position; the resulting progress update applies that saved pose. Editing with transform controls after the jump remains untouched until ScrollTrigger progress changes again.

### 6. Persist only keyframes, never live animator transforms

This is a critical invariant.

Studio's built-in transform controls call the transaction extension with source sync enabled for `position`, `rotation`, and `scale`. For branded `ScrollAnimator` objects, the custom extension must prevent these ordinary transactions from entering Studio's source-sync queue, while leaving runtime transform and undo/redo behavior intact. The only source-synced attribute allowed on a `ScrollAnimator` is `keyframes`.

A practical approach for Studio 0.4.3 is to subscribe with `useTransactions().onTransaction(...)`. The queue invokes these callbacks before it enqueues sync requests on commit, undo, and redo. For transactions whose object is a `ScrollAnimator`, clear/suppress `transaction.sync` unless its final `attributeName` is exactly `keyframes`. Extract the predicate/mutation into a small testable helper. Unsubscribe on component destruction.

Do not remove `userData.threlteStudio`; the extension needs that metadata to persist the correct literal `<T>` node and Studio uses it for other source-aware actions.

Insert/update/delete should commit one undoable transaction which:

- reads/writes cloned canonical `keyframes` arrays on the selected animator;
- immediately updates runtime UI state;
- includes source sync metadata targeting the selected `<T>` node's `keyframes` attribute;
- uses the source metadata's `moduleId`, component `index`, and any `pathItems` correctly;
- serializes only plain data (no `Vector3`, `Euler`, or `Quaternion` instances).

`buildTransaction({ object, propertyPath: 'keyframes', ... })` may be used if cloning/history semantics are correct; otherwise construct the public transaction shape explicitly. Confirm insert, replacement, delete, undo, and redo do not alias/mutate historic arrays.

When `useTransactions().vitePluginEnabled` is false (for example a production preview), playback and percentage jumping still work, but source-mutating save/delete controls must be disabled with a clear “Studio source sync unavailable” explanation. Do not claim that an in-memory edit was persisted.

### 7. Remove obsolete navigation and hard-coded tween code

Remove all existing free-navigation state, props, checkbox/hint markup, CSS, keyboard/mouse/wheel listeners, RAF loop, pure helpers, and free-navigation tests.

The hard-coded `cameraTween` module is superseded by generic keyframe sampling. Remove it and its tests if nothing else uses it.

Keep GSAP, ScrollTrigger registration, the narrow local ScrollTrigger type declaration, and dependency entries. Update the declaration as needed for the runtime controller and percentage-jump API. Do not remove GSAP from `package.json` or `package-lock.json`.

Do not leave compatibility branches, dead debug fields, or stale AGENTS documentation describing free navigation/fixed-origin look-at.

## Additional constraints and caveats

- Do not persist extension UI state as the source of truth for keyframes. Authored Svelte `keyframes` props are the source of truth.
- Do not write `position`, `rotation`, `scale`, or other transform attributes onto a `ScrollAnimator` `<T>` node as a side effect of Studio editing, including undo/redo.
- Do not let reactive keyframe/list updates continuously reapply the sampled pose. Only initial trigger setup and ScrollTrigger `onUpdate` drive playback transforms.
- Do not use numeric scrub smoothing. Boolean `scrub: true` is mandatory.
- Avoid shared mutable keyframe arrays between source props, animator, transaction history, and UI.
- Treat multi-selection as unsupported and disabled rather than guessing which object to edit.
- Use local transforms for keyframes so parenting remains composable; use world transforms only for camera look-at/debug reporting.
- Preserve selection when jumping to a keyframe.
- Deleting the last frame is allowed; the animator then keeps its current transform until another keyframe is authored.
- A programmatic jump to the already-current pixel may not change trigger progress. Do not introduce a continuous reapplication workaround. If explicit reapplication is needed, route it through the same named trigger update function and document the exception.
- Source persistence is a dev-authoring capability. Authored playback must remain deterministic in production without RPC/HMR.
- Keep Svelte 5 syntax and the existing TypeScript/check conventions.

## Acceptance criteria

- A real `ScrollAnimator extends Object3D` supports authored position/rotation keyframes at 0..100% and deterministic interpolation.
- Position interpolates linearly; rotation uses shortest-path quaternion slerp from source-stored XYZ Euler radians.
- One retained GSAP ScrollTrigger drives all animators with boolean `scrub: true` and no GSAP tween/timeline or numeric scrub catch-up.
- The runtime applies animators during initial trigger setup and when ScrollTrigger progress changes; Studio gizmo edits are not overwritten while trigger progress is stationary.
- ScrollTrigger retains requestAnimationFrame-synchronized/debounced updates and refresh-aware range calculation.
- Studio has a fixed-top extension pane showing current percentage, percentage input, selected animator keyframes, jump actions, delete actions, and `Insert/save scroll keyframe`.
- The extension operates only for exactly one selected `ScrollAnimator` and has clear disabled/empty states.
- Typing/clicking a percentage maps through ScrollTrigger's measured start/end range and the UI percentage tracks trigger progress.
- Insert at a new percentage adds a sorted keyframe; insert at the same normalized percentage updates it; delete removes it; undo/redo behaves correctly.
- Keyframe mutations write a literal `keyframes={...}` value to the selected animator's `<T>` node in Svelte source when Vite source sync is available.
- Moving/rotating/scaling a selected `ScrollAnimator` with built-in Studio controls never writes transform props into Svelte source, including through undo/redo.
- Source mutation controls are disabled with a clear explanation when Vite source sync is unavailable; runtime playback still works.
- The real camera is a child of one animator. A named `CameraTarget` is a child of another animator. The real camera continuously looks at the target's world position.
- Initial authored keyframes preserve the current perspective → top-down scroll behavior and origin target before the author changes them.
- Camera debug values and e2e assertions use world-space camera/target positions and no longer expose free-nav state.
- Free-navigation UI/code/styles/listeners/RAF/helpers/tests are gone.
- Hard-coded camera-pose tween code/tests are gone, while GSAP/ScrollTrigger and their dependencies remain.
- Fixed canvas, scroll spacer, landing/URL flow, Spark streaming, dual SparkRenderer routing, editor-camera behavior, device profiling, and declarative SplatMesh ownership remain intact.
- `AGENTS.md` is updated with concise current architecture, authoring workflow, source references, important invariants, and tests. It must not become a chronological implementation log.
- All required checks pass and the branch is pushed with the implementation and final status report.

Before finalizing, re-check every acceptance criterion explicitly. Do not rely only on green tests.

## Tests and verification to run

Create new tests for the new feature. At minimum:

### Unit tests

- percentage clamp/normalization;
- keyframe canonical sorting/deep cloning;
- upsert new frame and replace normalized duplicate;
- delete frame;
- sampling zero, one, and multiple keyframes;
- exact endpoints, between frames, and outside range;
- linear position interpolation;
- quaternion shortest-path rotation across the ±π boundary;
- `ScrollAnimator.applyScrollPercentage` does nothing with zero frames and applies local transforms otherwise;
- ScrollTrigger range-to-percentage and percentage-to-scroll mapping helpers, including zero-length range;
- transaction guard suppresses source sync for ScrollAnimator transform/other attributes on commit/undo/redo-shaped transactions but allows `keyframes`;
- keyframe transaction history uses independent arrays (no aliasing).

### Component/extension tests where practical

- no selection, non-animator selection, multi-selection, and one animator selection states;
- percentage input clamping/jump behavior through the trigger seam;
- sorted list rendering and button state;
- insert/update/delete calls the correct transaction seam;
- source-sync-unavailable state disables persistence controls.

Mock the ScrollTrigger and transaction/source seams. Automated tests must not rewrite checked-in Svelte source.

### E2E tests

- existing landing, URL validation, canvas, and back navigation behavior;
- free-navigation controls are absent;
- initial camera and target debug world positions are correct;
- scrolling moves the camera animator toward its last keyframe;
- target debug position comes from `CameraTarget`, not a hard-coded origin;
- after scrolling stops, moving a selected animator is not overwritten by later scrub/ticker activity;
- extension toolbar/pane remains fixed at the top while document scroll changes;
- current percentage follows ScrollTrigger progress;
- selecting the camera animator in the Studio hierarchy reveals its frames and clicking a frame jumps to its percentage, if stable with the existing Studio UI.

Do not make an e2e save/delete click against the real dev source unless the test uses an isolated temporary fixture and proves cleanup. Prefer mocked component coverage for disk mutation.

Run:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Also perform one deliberate manual dev-authoring verification before the final report:

1. Start the viewer in dev mode and select `Camera ScrollAnimator`.
2. Scroll, stop, wait longer than a plausible scrub duration, move the animator, and confirm ScrollTrigger does not snap it back while progress is stationary.
3. Confirm the trigger uses literal `scrub: true` and no numeric scrub/timeline catch-up.
4. Inspect the source diff and confirm transform controls did not add/update `position`, `rotation`, or `scale` on that animator node.
5. Save a keyframe and confirm only its `keyframes` source value changes.
6. Update the same percentage and confirm it replaces rather than duplicates.
7. Delete a frame and verify source/list/runtime behavior.
8. Confirm the Studio UI remains fixed while scrolling.
9. Confirm the camera looks at the animated target in both app camera and Studio editor contexts without regressing Spark LOD routing.

If this manual source-authoring verification intentionally changes checked-in initial keyframes, restore only those test edits before final verification. Do not discard unrelated user changes.

## Things Pi must not change

- Do not remove GSAP or ScrollTrigger; do not replace them with raw window scroll listeners.
- Do not add numeric scrub smoothing or a delayed GSAP tween/timeline for animator progress.
- Do not alter SparkRenderer dual-instance ownership/routing or the `sparkOverride` try/finally invariant.
- Do not let Studio editor cameras drive Spark LOD.
- Do not change SplatMesh paging/lifecycle, its current scene transform, or Threlte declarative ownership.
- Do not change RAD URL validation, sample URL, query-string behavior, landing flow, or loading/back behavior except to remove free-navigation state reset.
- Do not change device profiles, DPR policy, WebGL antialias policy, or continuous Canvas rendering.
- Do not replace Threlte Studio or add Theatre.js.
- Do not make keyframes live only in localStorage/Studio persisted extension state.
- Do not add a source-writing API outside the existing Threlte Studio Vite transaction mechanism unless the public mechanism is proven insufficient and the status report explains the evidence and smallest necessary deviation.
- Do not mutate repository source from automated tests.
- Do not modify unrelated files or overwrite unrelated working-tree changes.

## AGENTS.md update

Update `AGENTS.md` with concise, fresh-session-useful information:

- `ScrollAnimator` model and source location;
- retained ScrollTrigger boolean-scrub runtime invariant;
- Studio extension UI and authoring steps;
- source-sync guard invariant (only `keyframes` persists for animator objects);
- camera/CameraTarget hierarchy and world-space look-at;
- relevant debug attributes and tests;
- removal of free navigation and the hard-coded camera-pose tween;
- official Threlte extension/selection/transaction and GSAP ScrollTrigger links.

Keep it architectural and reference-oriented, not a full implementation log.

## Expected completion report

Write `.codex-handoff/status.md` with:

1. **Summary** — concise implemented behavior.
2. **Files changed** — added/modified/deleted, grouped by purpose.
3. **Design decisions** — keyframe shape/precision, retained ScrollTrigger ownership and boolean scrub, rotation interpolation, source transaction strategy, transform sync guard, camera look-at ordering.
4. **Acceptance criteria audit** — every criterion above marked met/not met with evidence.
5. **Tests added** — exact new/updated coverage.
6. **Verification results** — exact commands and pass/fail summaries, including the manual Studio source-authoring verification.
7. **Source-write evidence** — what changed when saving a keyframe and evidence that gizmo transforms did not write animator transform props.
8. **GSAP evidence** — confirmation that ScrollTrigger remains, uses `scrub: true`, and has no delayed numeric scrub/timeline overwrite.
9. **Known issues/deviations** — anything incomplete, flaky, version-specific, or intentionally different, with rationale.
10. **Commits pushed** — commit ids and current branch.

## Finalization sequence

1. Implement the mission.
2. Run all automated and manual verification.
3. Re-check that **all acceptance criteria** are met.
4. Update `AGENTS.md`.
5. Stage the intended implementation/docs changes.
6. Write `.codex-handoff/status.md` as the **last file modification**.
7. Stage the status report, commit intentionally, and push the current branch.
8. After pushing, perform **no more verification and no more modifications**. The pushed `status.md` must describe the exact final state.
