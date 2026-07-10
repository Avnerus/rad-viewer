# Follow-up Mission for Pi: Fix Scroll Verification and Fresh-Session Accuracy

## Objective
Tighten the bootstrapped `rad-viewer` implementation so the required scroll-driven camera interaction is real, testable, and documented accurately.

Codex verification found that the current e2e test named "scrolling drives camera from perspective to top-down" only asserts that the canvas remains visible after `window.scrollTo`. It does not prove that ScrollTrigger progressed or that the camera moved. The CSS also appears to prevent real page scrolling (`html, body, #app { overflow: hidden; }` and `.viewer-container { overflow: hidden; }`), while the `.scroll-track` is only a 1px absolute element. In addition, `VITE_E2E_STUB_SPARK=true` is documented but not wired into the `npm run test:e2e` path, and `AGENTS.md` has stale implementation notes.

## Files Likely Involved
- `src/App.svelte`
- `src/app.css`
- `src/lib/components/RadViewerScene.svelte`
- `src/lib/components/SparkSplats.svelte`
- `src/lib/spark/cameraTween.ts` only if needed for debug/test state
- `tests/e2e/rad-viewer.spec.ts`
- `playwright.config.ts`
- `package.json`
- `vite.config.ts` only if the test stub wiring needs adjustment
- `AGENTS.md`
- `README.md` if commands or behavior change
- `.codex-handoff/status.md` as the final report

## Required Fixes
1. Make the scroll-driven camera interaction actually scrollable and observable.
   - Ensure the viewer page has a real scroll range while the canvas stays usable as the visual viewport.
   - Keep the camera lookAt target fixed at the center throughout scrolling.
   - Avoid adding more than one primary scroll interaction.
   - Do not use Theatre.js.
2. Add an explicit e2e-observable camera state for tests.
   - Prefer a small test/debug-only DOM attribute or text node such as `data-camera-progress`, `data-camera-x`, `data-camera-y`, `data-camera-z`, or a visually hidden status element.
   - It must update from ScrollTrigger `onUpdate`.
   - It must not be a decorative user-facing feature.
3. Strengthen the Playwright e2e test.
   - Submit the sample Cozy Spaceship RAD URL.
   - Start the viewer.
   - Assert the viewer/canvas is visible.
   - Capture initial camera progress/position state.
   - Scroll far enough to drive the tween.
   - Assert camera progress or camera position changed toward top-down.
   - Assert the fixed target remains `[0, 0, 0]` or equivalent if exposed.
4. Wire the Spark test stub into the normal e2e command.
   - `npm run test:e2e` should run with `VITE_E2E_STUB_SPARK=true` so e2e does not depend on the real Spark library, a remote RAD fetch, or GPU-specific behavior.
   - Keep production/dev builds using real `@sparkjsdev/spark`.
   - If cross-platform env var support is needed, use a dependency such as `cross-env` or a Node-based script. Keep it simple.
5. Clean up Spark/Threlte object ownership if needed.
   - Avoid adding the same `SplatMesh` both imperatively with `scene.add(mesh)` and declaratively with `<T is={mesh} />`, unless there is a verified Threlte reason and it is documented.
   - Ensure imperatively added objects such as `SparkRenderer` are removed from the scene and disposed on destroy.
6. Update `AGENTS.md` so it reflects the actual code.
   - It currently says `RadViewerScene.svelte` owns `<Canvas>` and says `$effect` handles `SplatMesh` URL changes, but current code has `<Canvas>` in `App.svelte` and Spark lifecycle in `onMount`/`onDestroy`.
   - Keep AGENTS concise with source references and current commands.
7. Fix the final status report commit mismatch.
   - The previous status report said commit `9a43a20`, but the pushed commit pulled by Codex was `78f6856`.
   - In your new report, include the actual commit you push.

## Critical Implementation Suggestions
One acceptable shape is:

```svelte
<!-- RadViewerScene.svelte -->
<script lang="ts">
  let cameraProgress = $state(0)
  let cameraPosition = $state(defaultPerspectivePose.position)
  const fixedTarget = defaultPerspectivePose.target

  // In ScrollTrigger onUpdate:
  cameraProgress = self.progress
  const pose = getCameraPose(self.progress, defaultPerspectivePose, defaultTopDownPose)
  cameraPosition = pose.position
  applyCameraPose(camera, pose)
</script>

<div
  class="camera-debug"
  data-testid="camera-state"
  data-progress={cameraProgress.toFixed(3)}
  data-x={cameraPosition[0].toFixed(3)}
  data-y={cameraPosition[1].toFixed(3)}
  data-z={cameraPosition[2].toFixed(3)}
  data-target={fixedTarget.join(',')}
  aria-hidden="true"
></div>
```

For scroll layout, prefer a stable structure where the scrollable area is outside or alongside the fixed canvas, for example:

```svelte
<div class="viewer-container">
  <div class="viewer-stage">
    <Canvas>...</Canvas>
  </div>
  <div class="scroll-track" bind:this={scrollTrackRef} aria-hidden="true"></div>
</div>
```

```css
html,
body,
#app {
  width: 100%;
  min-height: 100%;
}

.viewer-container {
  position: relative;
  min-height: 400vh;
}

.viewer-stage {
  position: fixed;
  inset: 0;
}

.scroll-track {
  height: 400vh;
  pointer-events: none;
}
```

Adapt this to the app structure and Threlte constraints. The important outcome is that `window.scrollY` or the configured ScrollTrigger scroller can progress from top to bottom.

For e2e script wiring, one acceptable option:

```json
{
  "scripts": {
    "test:e2e": "cross-env VITE_E2E_STUB_SPARK=true playwright test"
  }
}
```

## Constraints
- Do not rebuild or restyle unrelated parts of the app.
- Do not use Theatre.js, `@threlte/theatre`, or `@threlte/studio`.
- Do not add large binary RAD/splat assets.
- Do not make e2e depend on loading the real remote RAD file.
- Do not weaken TypeScript, lint, or tests to pass.
- Do not remove the sample RAD URL:

```text
https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad
```

## Acceptance Criteria
- The viewer has a real scroll range and ScrollTrigger progress changes when the page is scrolled.
- Scrolling changes the camera position from the perspective pose toward the top-down pose.
- Camera lookAt target remains fixed at the scene center for the whole tween.
- Playwright e2e asserts scroll progress or camera position changes, not only canvas visibility.
- `npm run test:e2e` uses the Spark stub path by default.
- Production/dev app paths still use real `@sparkjsdev/spark`.
- Spark/Threlte object ownership is clean: no duplicate add path for the same `SplatMesh`, and imperatively added objects are removed/disposed on destroy.
- `AGENTS.md` accurately describes current architecture, lifecycle, commands, and source references.
- README is updated if any command or user behavior changed.
- The final status report includes the actual commit hash that is pushed.
- TypeScript verification, lint, unit tests, e2e tests, and build pass.

## Tests to Run
Run these before finalizing:
- `npm run check`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

Create or update tests as needed so the new scroll/camera acceptance criteria are actually covered.

## Things Pi Must Not Change
- Do not remove `.codex-handoff/mission.md`.
- Do not overwrite user work if new uncommitted changes appear; inspect and work around them.
- Do not add Theatre.js.
- Do not add real downloaded RAD assets.
- Do not push without `status.md`.
- Do not perform additional modifications or verification after pushing.

## Expected Completion Report Format
Write `.codex-handoff/status.md` with:

```md
# Status Report

## Summary
- ...

## Files Changed
- ...

## Implementation Notes
- ...

## Acceptance Criteria
- [x] ...
- [ ] ... (only if incomplete; explain blocker)

## Tests Run
- `npm run check` - result
- `npm run lint` - result
- `npm run test:unit` - result
- `npm run test:e2e` - result
- `npm run build` - result

## Known Issues / Follow-ups
- ...

## Commit / Push
- Branch:
- Commit:
- Pushed: yes/no
```

Before writing the report, re-check that every item in Acceptance Criteria is met. Always write `status.md` as the last action before pushing, then push. After pushing, do not perform any more verifications or modifications.
