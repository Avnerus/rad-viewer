# Mission Brief for Pi: Bootstrap `rad-viewer`

## Objective
Bootstrap `rad-viewer` as a production-quality Threlte/Svelte/TypeScript web app for viewing Spark 2.x streaming LOD Gaussian splats from user-provided RAD URLs.

The first usable screen must be a landing/start screen with a RAD URL input and a start button. After start, the app should show a full-viewport Threlte-powered Spark viewer and one scroll-driven interaction: scrolling tweens the camera from a perspective view to a top-down view while keeping `camera.lookAt()` fixed on the scene center. Use GSAP + ScrollTrigger for this interaction. Do not use Theatre.js or `@threlte/theatre`.

## Current Repo Context
- Repo appears to be a fresh project on `main`.
- Existing file observed: `README.md` with only `# rad-viewer`.
- No package manager, app scaffold, or AGENTS.md was present when this brief was written.

## Source References
Use these references before implementing:
- Spark streaming LOD example: https://github.com/sparkjsdev/spark/blob/main/examples/streaming-lod/index.html
- Spark docs home / quick start: https://sparkjs.dev/docs/
- Spark Level-of-Detail docs: https://sparkjs.dev/docs/lod-getting-started/
- SparkRenderer API docs: https://sparkjs.dev/docs/spark-renderer/
- SplatMesh API docs: https://sparkjs.dev/docs/splat-mesh/
- Spark performance docs: https://sparkjs.dev/docs/performance/
- Threlte repo/docs: https://github.com/threlte/threlte and https://threlte.xyz/docs/
- Threlte installation: https://threlte.xyz/docs/learn/getting-started/installation/
- Threlte `<Canvas>`: https://threlte.xyz/docs/reference/core/canvas/
- Threlte `<T>`: https://threlte.xyz/docs/reference/core/t/
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/

Important Spark details from the references:
- Load a prebuilt streaming RAD with `new SplatMesh({ url: "./my-splats-lod.rad", paged: true })`.
- RAD encodes the LOD tree, so `lod: true` is not needed for a RAD LOD file.
- Add `SparkRenderer` to the scene and pass it the actual `THREE.WebGLRenderer`.
- For large-coordinate streamed/paged splats, set `pagedExtSplats: true` on `SparkRenderer`.
- For mobile GPU control, prefer Spark LOD/perf controls such as `lodSplatScale`, `lodRenderScale`, `maxPagedSplats`, `maxStdDev`, and foveation parameters (`coneFov0`, `coneFov`, `coneFoveate`, `behindFoveate`).
- Spark docs recommend `antialias: false` for `THREE.WebGLRenderer`; splats do not benefit from MSAA and it adds significant overhead.

## Files Likely Involved
Create or update:
- `package.json`
- `package-lock.json` or the package manager lockfile you choose
- `index.html`
- `vite.config.ts`
- `tsconfig*.json`
- `svelte.config.js`
- `eslint.config.js` or equivalent flat ESLint config
- `playwright.config.ts`
- `src/main.ts`
- `src/App.svelte`
- `src/app.css`
- `src/lib/components/SparkSplats.svelte`
- `src/lib/components/RadViewerScene.svelte`
- `src/lib/spark/cameraTween.ts`
- `src/lib/spark/deviceProfile.ts`
- `src/lib/spark/radUrl.ts`
- `src/lib/types.ts` if shared app types help
- `tests/unit/*.test.ts`
- `tests/e2e/rad-viewer.spec.ts`
- `tests/fixtures/spark-stub.ts` if needed for stable tests
- `public/fixtures/sample.rad` only as a tiny placeholder if an e2e URL is needed; do not commit real splat assets
- `README.md`
- `AGENTS.md`
- `.gitignore`
- `.codex-handoff/status.md` as the final report

## Implementation Plan
1. Scaffold a Vite + Svelte + TypeScript app in the repo root. Use `npm` unless you find an existing package manager signal. Add scripts for `dev`, `build`, `preview`, `check`, `lint`, `test:unit`, `test:e2e`, and `test`.
2. Install runtime dependencies: `svelte`, `vite`, `typescript`, `three`, `@threlte/core`, `@sparkjsdev/spark`, `gsap`.
3. Install dev/test dependencies for Svelte type checking, ESLint, Vitest, Testing Library, jsdom, and Playwright. Configure TypeScript verification and lint so `npm run check` and `npm run lint` are enforced and meaningful.
4. Build the landing/start flow in `App.svelte`:
   - URL input accepts a RAD URL.
   - Start button validates and enters the viewer state.
   - Do not auto-load any heavy remote asset before the user starts.
   - Preserve/share the input URL in app state and optionally the query string for reloadability.
5. Implement `radUrl.ts`:
   - Accept `http:`, `https:`, and same-origin relative URLs.
   - Require `.rad` path extension, allowing query strings/hash.
   - Return typed success/error results so UI and tests do not depend on thrown strings.
6. Implement `deviceProfile.ts`:
   - Detect mobile/iOS using Spark's `isMobile()` where available, with a small browser fallback if needed.
   - Return renderer DPR clamp and Spark options.
   - For mobile/iOS, clamp DPR to 1 or a very low range, reduce `lodSplatScale`, raise `lodRenderScale`, use lower `maxStdDev`, set a conservative `maxPagedSplats` multiple of 65,536, and use stronger foveation.
   - Keep desktop settings higher quality but still bounded.
7. Implement `cameraTween.ts` as pure, unit-testable logic:
   - Define `CameraPose` with `position` and fixed `target`.
   - Provide `getCameraPose(progress, start, end)` or similar.
   - Provide an `applyCameraPose(camera, pose)` helper that sets position and calls `camera.lookAt(target)` every time.
   - Use the scene center as the fixed lookAt target. Default center can be `[0, 0, 0]`.
8. Implement Threlte integration:
   - Use `<Canvas>` from `@threlte/core`.
   - Use `createRenderer` to create `new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "default" })`.
   - Use `<Canvas dpr={...}>` to clamp device pixel ratio.
   - Use `renderMode="always"` while the viewer is active so Spark streaming/sorting and ScrollTrigger camera changes render consistently.
   - Add a default perspective camera with `makeDefault`.
   - Create a Threlte component for Spark splats, preferably `SparkSplats.svelte`, that creates and owns:
     - one `SparkRenderer({ renderer, pagedExtSplats: true, ...profile.sparkRenderer })`
     - one `SplatMesh({ url, paged: true, raycastable: false, ...optionalTransform })`
   - Add both Spark objects to the scene via Threlte `<T is={...} />` or explicit scene lifecycle. Clean up with `dispose()` on unmount or URL change.
9. Implement scroll-driven interactivity with GSAP + ScrollTrigger:
   - Register `ScrollTrigger` in `onMount` only in the browser.
   - Create exactly one primary scroll interaction for this version: scroll progress 0..1 maps perspective camera pose to top-down camera pose.
   - Keep the camera target fixed at the center on every update.
   - Kill the ScrollTrigger/tween on component destroy.
   - Avoid Theatre.js entirely.
10. Create a small, restrained UI:
   - First screen: URL input and start button.
   - Viewer: full-viewport canvas with enough scroll height for the camera tween.
   - Keep text and controls responsive on mobile. Do not let UI overlap the canvas in a way that blocks the experience.
11. Add tests:
   - Unit tests for RAD URL validation.
   - Unit tests for mobile/iOS profile limiting Spark/GPU options.
   - Unit tests for camera tween output at progress 0, 0.5, and 1, including fixed target.
   - Component-level test for the start flow if practical.
   - One Playwright e2e test using Pi's `playwright-cli` skill. It should submit a RAD URL, start the viewer, assert the canvas/viewer is visible, scroll, and assert the camera debug state or visible state changes from perspective to top-down.
12. For e2e stability, avoid depending on a huge remote RAD or WebGL-heavy Spark load. If necessary, create a Vite test alias activated by `VITE_E2E_STUB_SPARK=true` that maps `@sparkjsdev/spark` to a small test stub exporting `SparkRenderer`, `SplatMesh`, and `isMobile`. The stub classes should extend `THREE.Object3D` enough for the app to mount. Do not use the stub in production builds.
13. Update `README.md` with:
   - What rad-viewer does.
   - How to install/run/check/test.
   - How to provide a RAD URL.
   - Notes on CORS for remote RAD files and `.radc` chunks.
   - Mention that mobile GPU use is limited through Spark LOD, DPR, and renderer settings.
14. Create `AGENTS.md` with fresh-session technical information:
   - Project architecture and key files.
   - Commands for dev/check/lint/test/e2e.
   - Spark/Threlte integration notes and gotchas.
   - ScrollTrigger location and invariant: camera lookAt stays fixed at the center.
   - Source references to Spark/Threlte/GSAP docs.
   - Keep it concise. It does not need a full implementation log.
15. Run verification, fix issues, and push.

## Critical Code Shape Suggestions
Use this only as guidance; adapt to actual package types.

Threlte Canvas renderer:
```svelte
<script lang="ts">
  import { Canvas } from '@threlte/core'
  import { WebGLRenderer } from 'three'
  import Scene from './RadViewerScene.svelte'
  import { getDeviceProfile } from '$lib/spark/deviceProfile'

  const profile = getDeviceProfile()
</script>

<Canvas
  renderMode="always"
  dpr={profile.dpr}
  createRenderer={(canvas) =>
    new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'default'
    })}
>
  <Scene {profile} />
</Canvas>
```

Spark component lifecycle:
```svelte
<script lang="ts">
  import { T, useThrelte } from '@threlte/core'
  import { onDestroy } from 'svelte'
  import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'

  let { url, profile } = $props()
  const { renderer } = useThrelte()

  const spark = new SparkRenderer({
    renderer,
    pagedExtSplats: true,
    ...profile.sparkRenderer
  })

  let mesh = $state<SplatMesh | null>(null)

  $effect(() => {
    if (!url) return
    const next = new SplatMesh({
      url,
      paged: true,
      raycastable: false
    })
    mesh?.dispose()
    mesh = next
    return () => next.dispose()
  })

  onDestroy(() => {
    mesh?.dispose()
    spark.dispose()
  })
</script>

<T is={spark} />
{#if mesh}
  <T is={mesh} />
{/if}
```

ScrollTrigger camera invariant:
```ts
ScrollTrigger.create({
  trigger: scrollRoot,
  start: 'top top',
  end: 'bottom bottom',
  scrub: true,
  onUpdate: (self) => {
    const pose = getCameraPose(self.progress, perspectivePose, topDownPose)
    applyCameraPose(camera, pose) // must call camera.lookAt(center)
  }
})
```

## Constraints
- Do not use Theatre.js, `@threlte/theatre`, or `@threlte/studio`.
- Do not commit `node_modules`, build output, downloaded RAD/splat assets, or browser cache artifacts.
- Do not build a backend. Keep this a client-side viewer unless a tool requires a dev server for tests.
- Do not hardcode a single demo RAD as the only path. The required flow accepts a user-provided RAD URL.
- Do not allow mobile to default to full device pixel ratio and desktop LOD budgets.
- Do not disable TypeScript or lint rules just to pass checks.
- Do not scan or refactor unrelated repository content.

## Acceptance Criteria
- A fresh clone can install dependencies and run the app.
- The app is based on Threlte and renders through a Threlte `<Canvas>`.
- A reusable Threlte component exists for Spark 2.x splats / RAD streaming.
- The landing/start screen accepts a RAD URL and starts the viewer only after the button is used.
- RAD URL validation is implemented and unit-tested.
- Spark `SplatMesh` uses `paged: true` for RAD streaming.
- `SparkRenderer` receives mobile-conscious LOD/performance options and `pagedExtSplats: true`.
- WebGL renderer is created with `antialias: false`, and DPR is clamped for mobile/iOS.
- GSAP ScrollTrigger drives one camera tween from perspective to top-down.
- Camera `lookAt` target remains fixed at the center throughout scrolling.
- Theatre.js is not installed or used.
- `README.md` describes the app and development commands.
- `AGENTS.md` exists with concise technical guidance and source references.
- TypeScript verification, lint, unit tests, and one Playwright e2e test are configured and pass.
- Pi's final status report is written to `.codex-handoff/status.md` as the last action before pushing.

## Tests to Run
Run these before finalizing:
- `npm run check`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e` using Pi's `playwright-cli` skill
- `npm run build`

If package scripts differ, document the exact commands and why.

Create new tests for all new core functionality. Do not only run generated scaffold tests.

## Things Pi Must Not Change
- Do not remove `.codex-handoff/mission.md`.
- Do not overwrite user work if new uncommitted changes appear; inspect and work around them.
- Do not use Theatre.js or add it transitively through a Threlte package unless it is unavoidable and unused; prefer not installing it at all.
- Do not add large binary example assets.
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
