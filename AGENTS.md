# RAD Viewer — Technical Guide

## Architecture

A client-side Threlte/Svelte 5/TypeScript web app for viewing Spark 2.x streaming LOD Gaussian splats from user-provided RAD URLs.

**Key files:**
- `src/App.svelte` — Root component. Landing screen ↔ viewer state machine. `<Canvas>` lives here. Owns `freeNavEnabled` state and renders the free-navigation checkbox outside the Canvas.
- `src/lib/components/RadViewerScene.svelte` — Camera setup, ScrollTrigger, free-navigation input handling (keyboard + mouse), and camera debug state element.
- `src/lib/components/SparkSplats.svelte` — SparkRenderer (imperative) + SplatMesh (Threlte `<T>` declarative) lifecycle. Accepts transform props (`position`, `rotation`, `scale`).
- `src/lib/spark/cameraTween.ts` — Pure camera interpolation logic (unit-testable).
- `src/lib/spark/freeNavigation.ts` — Pure functions for free-navigation movement, yaw/pitch, and key handling (unit-testable).
- `src/lib/spark/deviceProfile.ts` — Mobile/iOS detection + Spark performance profile.
- `src/lib/spark/radUrl.ts` — RAD URL validation with typed results.
- `src/lib/types.ts` — Shared TypeScript types.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run check` | Svelte + TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e tests (builds with Spark stub + previews first) |
| `npm run test` | Run unit + e2e tests |

## Spark / Threlte Integration Notes

- **SparkRenderer** is created once in `SparkSplats.svelte` `onMount` with `pagedExtSplats: true` and device-profile options. Added to the Three.js scene imperatively via `scene.add()`. Removed and disposed in `onDestroy`. It is renderer infrastructure and remains imperative.
- **SplatMesh** is created with `paged: true` for RAD streaming. Owned by Threlte `<T is={mesh} ... />` for declarative transform props (`position`, `rotation`, `scale`). Not added via `scene.add()` — Threlte `<T>` handles scene membership. Disposed in `onDestroy`.
- **`<SparkSplats>` props**: `url`, `profile`, `position` (default `[0,0,0]`), `rotation` (default `[0,0,0]`), `scale` (default `1`).
- **WebGLRenderer** uses `antialias: false` (splats don't benefit from MSAA).
- **DPR** is clamped to `Math.min(devicePixelRatio, 2)` on desktop, `1` on mobile.
- **renderMode="always"** on `<Canvas>` ensures Spark streaming/sorting and ScrollTrigger camera changes render every frame.
- Camera is registered via `useThrelte().camera.set()` and `useCamera().makeDefaultCameras.add()` in `onMount`.
- Theatre.js is **not** used.

## Scroll Layout

The viewer uses a **fixed canvas + scrollable document** pattern:
- `<Canvas>` lives in `src/App.svelte` inside a `.viewer-stage` (`position: fixed; inset: 0`) that keeps it pinned to the viewport.
- `.scroll-spacer` (400vh) lives in `src/App.svelte` in the normal document flow, providing the real scroll range.
- `RadViewerScene.svelte` queries `.scroll-spacer` via `querySelector` as the ScrollTrigger trigger element.
- Scrolling is real (`window.scrollY` changes), and ScrollTrigger progress drives the camera tween.

## ScrollTrigger Invariant

The camera `lookAt` target is **always fixed at the scene center `[0, 0, 0]`** throughout scrolling. Only the camera position interpolates.

ScrollTrigger is created in `RadViewerScene.svelte` `onMount`, killed on `onDestroy`.

## Camera Debug State

`RadViewerScene.svelte` renders a visually hidden `<div class="camera-debug" data-testid="camera-state">` with attributes:
- `data-progress` — ScrollTrigger progress (0..1)
- `data-x`, `data-y`, `data-z` — Camera position
- `data-target` — Fixed lookAt target
- `data-freenav` — `"true"` when free navigation is active, `"false"` otherwise
- `data-yaw` — Current yaw angle in radians (free nav mode)
- `data-pitch` — Current pitch angle in radians (free nav mode)
- `data-zoom` — Current camera FOV in degrees (free nav mode)

Used by e2e tests to verify camera movement. Not visible to users.

## Free Navigation

A single "Free navigation" checkbox (rendered in `App.svelte`, outside `<Canvas>`) toggles mouse-driven camera look, first-person keyboard movement, and scroll-wheel zoom:

- **Unchecked (default)**: Scroll-driven camera tween via ScrollTrigger (perspective → top-down).
- **Checked**: ScrollTrigger is killed. Mouse movement controls yaw/pitch. `WASD` and arrow keys move the camera in first-person mode. Mouse scroll wheel zooms the camera FOV (clamped to `minFov`/`maxFov`). Keyboard events ignore text-input elements but allow checkboxes/radios.
- **Exiting free nav**: Camera is restored to the last scroll-driven pose, FOV resets to 60°, and ScrollTrigger is re-created.
- **Checkbox focus**: The checkbox uses `tabindex="-1"` and `onblur` to return focus to `<body>`, preventing it from intercepting keyboard navigation.

Movement logic is extracted into pure functions in `src/lib/spark/freeNavigation.ts`:
- `computeMoveDirection(keys)` — normalised direction from key state
- `applyMovement(camera, direction, yaw, dt, speed)` — frame-rate-independent movement
- `updateLookAngles(currentYaw, currentPitch, deltaYaw, deltaPitch, minPitch, maxPitch)` — pure math returning cumulative `[yaw, pitch]` with clamped pitch
- `applyLook(camera, yaw, pitch)` — applies absolute yaw/pitch to camera quaternion via YXZ Euler
- `applyZoom(camera, scrollDelta, sensitivity, minFov, maxFov)` — clamped FOV adjustment from scroll delta (positive `deltaY` = zoom out / increase FOV, negative = zoom in / decrease FOV)
- `extractYawPitch(camera)` — read current orientation
- `shouldHandleKeyEvent(event)` — skip text inputs, allow checkboxes/radios
- `isNavKey(key)` — check if key is WASD/arrow

The `freeNavEnabled` state lives in `App.svelte` and is passed as a prop to `RadViewerScene`. The scene uses a `$effect` to react to changes, managing internal `freeNavActive` state, ScrollTrigger lifecycle, and the `requestAnimationFrame` movement loop.

## Source References

- Spark docs: https://sparkjs.dev/docs/
- Spark LOD: https://sparkjs.dev/docs/lod-getting-started/
- SparkRenderer API: https://sparkjs.dev/docs/spark-renderer/
- SplatMesh API: https://sparkjs.dev/docs/splat-mesh/
- Threlte docs: https://threlte.xyz/docs/
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/

## Sample RAD URL

```
https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad
```

## E2E Testing

`npm run test:e2e` builds with `VITE_E2E_STUB_SPARK=true`, which aliases `@sparkjsdev/spark` to `tests/fixtures/spark-stub.ts`. The stub classes extend `THREE.Object3D` so the app mounts without loading real splat data or requiring GPU-specific WebGL behavior. Production and dev builds always use the real library.

## Screenshotting the Splat Scene with playwright-cli

To capture a screenshot of the 3D canvas splat scene (e.g. for visual verification):

1. **Start the dev server**:
   ```bash
   npm run dev &>/tmp/dev-server.log &
   sleep 3
   ```
   The server runs at `http://localhost:5173/`.

2. **Open the browser and navigate**:
   ```bash
   playwright-cli open http://localhost:5173/
   ```

3. **Click Start** to load the sample RAD URL (pre-filled in the text box):
   ```bash
   playwright-cli snapshot          # find the Start button ref
   playwright-cli click e9          # click Start (ref may vary)
   ```

4. **Wait for the scene to load** — the Spark renderer streams LOD chunks and the GPU will be busy. Wait ~10 seconds:
   ```bash
   sleep 10
   ```

5. **Take the screenshot**. The standard `playwright-cli screenshot` command can time out due to GPU stalls from the heavy WebGL rendering. Use `run-code` instead:
   ```bash
   playwright-cli run-code --filename=.playwright-cli/screenshot.js
   ```
   Where `.playwright-cli/screenshot.js` contains:
   ```js
   async function run(page) {
     await page.screenshot({ path: '.playwright-cli/splat-scene.png', type: 'png' });
   }
   ```

6. **Close the browser**:
   ```bash
   playwright-cli close
   ```

7. **Stop the dev server** when done:
   ```bash
   kill %1
   ```

## CORS Note

Remote RAD files and their `.radc` chunk files must be served with CORS headers. If a RAD URL fails to load, check that the origin allows cross-origin requests.
