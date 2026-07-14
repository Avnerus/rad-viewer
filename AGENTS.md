# RAD Viewer — Technical Guide

## Architecture

A client-side Threlte/Svelte 5/TypeScript web app for viewing Spark 2.x streaming LOD Gaussian splats from user-provided RAD URLs. Camera animation is driven by scroll-keyframed `ScrollAnimator` objects authored via a Threlte Studio extension.

**Key files:**
- `src/App.svelte` — Root component. Landing screen ↔ viewer state machine. `<Canvas>` with `<Studio extensions={[ScrollAnimatorExtension]}>` wrapping `RadViewerScene`.
- `src/lib/components/RadViewerScene.svelte` — Camera setup, ScrollTrigger, `ScrollAnimator` instances (camera + target), `CameraTarget`, SparkRenderer bridge, and SplatMesh. Wraps WebGLRenderer.render for per-frame camera look-at updates.
- `src/lib/components/SparkSplats.svelte` — SplatMesh (Threlte `<T>` declarative) lifecycle only.
- `src/lib/components/SparkStudioBridge.svelte` — Manages dual SparkRenderer lifecycle via `createSparkStudioRenderer`.
- `src/lib/spark/ScrollAnimator.ts` — Three.js `Object3D` subclass with `keyframes` property and `applyScrollPercentage()`.
- `src/lib/spark/scrollAnimation.ts` — Pure keyframe model, canonicalization, upsert/delete, bracketing, and interpolation (position lerp + quaternion slerp).
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte` — Studio extension: fixed toolbar pane with percentage display/input, keyframe list, jump, delete, and insert/save actions.
- `src/lib/studio/scroll-animator/transactionGuard.ts` — Suppresses source sync for ScrollAnimator transform attributes; only `keyframes` persists.
- `src/lib/studio/scroll-animator/studio-types.d.ts` — Local type declarations for internal @threlte/studio modules.
- `src/lib/spark/createSparkStudioRenderer.ts` — Factory for dual SparkRenderer setup.
- `src/lib/spark/deviceProfile.ts` — Mobile/iOS detection + Spark performance profile.
- `src/lib/spark/radUrl.ts` — RAD URL validation with typed results.
- `src/lib/types.ts` — Shared TypeScript types.

## ScrollAnimator Model

`ScrollAnimator extends Object3D` holds a `keyframes` array of plain `{ scroll, position, rotation }` objects:

```ts
interface ScrollKeyframe {
  scroll: number        // 0..100, rounded to 2 decimals
  position: [number, number, number]
  rotation: [number, number, number]  // XYZ Euler radians
}
```

- Position interpolates linearly; rotation uses shortest-path quaternion slerp.
- `applyScrollPercentage(percent)` samples and applies local position/quaternion.
- Zero keyframes: no mutation. One keyframe: used at all percentages.
- Brand: `isScrollAnimator = true`, `type = 'ScrollAnimator'`.

## ScrollTrigger Runtime

One GSAP ScrollTrigger with **boolean `scrub: true`** (never numeric) drives all animators. The `onUpdate` callback traverses and calls `applyScrollPercentage(progress * 100)` on each animator. No per-frame/effect loop reapplies animator transforms. ScrollTrigger retains its own RAF synchronization and resize refresh.

Initial pose is applied once after ScrollTrigger creation.

## Camera / CameraTarget Hierarchy

- Real `PerspectiveCamera` is a child of `Camera ScrollAnimator`.
- Named `CameraTarget` (`Object3D`) is a child of `Camera Target ScrollAnimator`.
- The real camera **always looks at CameraTarget's world position**, updated every render frame via a wrapped `WebGLRenderer.render`.
- Camera animator rotation does not fight the target constraint — look-at wins for the camera's final viewing direction.

## Studio Extension UI

Registered via `<Studio extensions={[ScrollAnimatorExtension]}>`. Shows a fixed-top `DropDownPane` with:
1. Live ScrollTrigger percentage display.
2. Numeric percentage input (0..100) — commit on Enter/blur, scrolls via trigger range.
3. Sorted keyframe list with clickable jump and delete buttons.
4. "Insert/save scroll keyframe" button — captures local position + Euler rotation at current percentage.

Active only for exactly one selected `ScrollAnimator`; otherwise shows "Select one ScrollAnimator". Source-sync controls are disabled with a clear message when `vitePluginEnabled` is false.

## Source-Sync Guard Invariant

The `guardScrollAnimatorTransactions` helper runs via `useTransactions().onTransaction()`. For any transaction whose object is a branded `ScrollAnimator`, it clears `transaction.sync` unless `attributeName === 'keyframes'`. This prevents Studio's transform controls from writing `position`, `rotation`, or `scale` into Svelte source, while allowing `keyframes` mutations through.

Keyframe mutations use `transactions.buildTransaction()` with explicit sync metadata targeting the `<T>` node's `moduleId` and `componentIndex` from `getThrelteStudioUserData()`.

## Removed Features

Free navigation (checkbox, keyboard/mouse/wheel listeners, RAF loop, pure helpers in `freeNavigation.ts`) and the hard-coded two-pose `cameraTween` module have been removed. GSAP and ScrollTrigger are retained.

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

- **SparkRenderer** lifecycle is managed by `SparkStudioBridge.svelte` via `createSparkStudioRenderer()`. Two instances per scene:
  - **Editor renderer**: `enableLod: true`, `enableDriveLod: false`. Added to the Three scene. Sorts splats for Studio editor camera views but never drives LOD fetching or pager updates.
  - **Real-camera renderer**: `enableLod: true`, `enableDriveLod: true`. Never added to the scene. Drives LOD selection from the app's real camera. Its `lodInstances` map is shared with the editor renderer before each editor render.
- **Camera routing via `onBeforeRender` wrap**: `editorRenderer.onBeforeRender` is wrapped to detect `camera.userData.editorCamera === true`. Both paths pin their intended `SparkRenderer.sparkOverride` for the duration of the original callback and restore the prior value in `try/finally`:
  - Editor camera → share real renderer's `lodInstances` → `sparkOverride = editorRenderer` → call original → restore
  - Real/default camera → `sparkOverride = realRenderer` → call original → restore → share `lodInstances` to editor for next frame
- **SplatMesh** is created with `paged: true` for RAD streaming in `SparkSplats.svelte`. Owned by Threlte `<T is={mesh} ... />` for declarative transform props. Disposed in `onDestroy`.
- **WebGLRenderer** uses `antialias: false`. DPR clamped to `Math.min(devicePixelRatio, 2)` on desktop, `1` on mobile.
- **renderMode="always"** on `<Canvas>` ensures Spark streaming/sorting renders every frame.
- Camera is registered via `useThrelte().camera.set()` and `useCamera().makeDefaultCameras.add()` in `onMount`.
- Theatre.js is **not** used.

## Threlte Studio Integration

- `<Studio extensions={[ScrollAnimatorExtension]}>` wraps the viewer scene in `App.svelte`. The `threlteStudio()` Vite plugin is registered before `svelte()` in `vite.config.ts`.
- Studio editor cameras are marked with `camera.userData.editorCamera = true`. This marker prevents editor cameras from driving Spark LOD.
- Two literal `<T>` nodes in `RadViewerScene.svelte` host the `ScrollAnimator` instances — not wrapped in a reusable component — so Studio's source sync metadata targets independent `keyframes` attributes.
- Internal Studio modules (`useObjectSelection`, `useTransactions`, `vitePluginEnabled`, `getThrelteStudioUserData`) are accessed via Vite resolve aliases in `vite.config.ts` with local type declarations in `studio-types.d.ts`.

## Scroll Layout

The viewer uses a **fixed canvas + scrollable document** pattern:
- `<Canvas>` lives in `src/App.svelte` inside a `.viewer-stage` (`position: fixed; inset: 0`).
- `.scroll-spacer` (400vh) lives in `src/App.svelte` in normal document flow, providing the scroll range.
- ScrollTrigger uses `.scroll-spacer` as the trigger element.

## Camera Debug State

`RadViewerScene.svelte` renders a visually hidden `<div class="camera-debug" data-testid="camera-state">` with attributes:
- `data-progress` — ScrollTrigger progress (0..1) as percentage
- `data-x`, `data-y`, `data-z` — Camera **world** position
- `data-target-x`, `data-target-y`, `data-target-z` — CameraTarget **world** position

Used by e2e tests to verify camera movement. Not visible to users.

## Source References

- Spark docs: https://sparkjs.dev/docs/
- Spark LOD: https://sparkjs.dev/docs/lod-getting-started/
- SparkRenderer API: https://sparkjs.dev/docs/spark-renderer/
- SplatMesh API: https://sparkjs.dev/docs/splat-mesh/
- Threlte docs: https://threlte.xyz/docs/
- Threlte Studio setup: https://threlte.xyz/docs/reference/studio/getting-started
- Threlte authoring extensions: https://threlte.xyz/docs/reference/studio/authoring-extensions/
- Threlte object selection: https://threlte.xyz/docs/reference/studio/use-object-selection/
- Threlte transactions/source sync: https://threlte.xyz/docs/reference/studio/use-transactions/
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/

## Sample RAD URL

```
https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad
```

## E2E Testing

`npm run test:e2e` builds with `VITE_E2E_STUB_SPARK=true`, which aliases `@sparkjsdev/spark` to `tests/fixtures/spark-stub.ts`. The stub classes extend `THREE.Object3D` so the app mounts without loading real splat data or requiring GPU-specific WebGL behavior. Production and dev builds always use the real library.

## CORS Note

Remote RAD files and their `.radc` chunk files must be served with CORS headers. If a RAD URL fails to load, check that the origin allows cross-origin requests.
