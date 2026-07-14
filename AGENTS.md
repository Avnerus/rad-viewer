# RAD Viewer — Technical Guide

## Architecture

A client-side Threlte/Svelte 5/TypeScript web app for viewing Spark 2.x streaming LOD Gaussian splats from user-provided RAD URLs. Camera animation is driven by scroll-keyframed `ScrollAnimator` objects authored via a Threlte Studio extension.

**Key files:**
- `src/App.svelte` — Root component. Landing screen ↔ viewer state machine. `<Canvas>` with `<Studio extensions={[ScrollAnimatorExtension]}>` wrapping `RadViewerScene`.
- `src/lib/components/RadViewerScene.svelte` — Camera setup, ScrollTrigger, `ScrollAnimator` instances (camera + target), `CameraTarget`, SparkRenderer bridge, and SplatMesh. Uses `useTask` for per-frame camera look-at. Scene-wide `ScrollAnimator` playback via `scene.traverse`.
- `src/lib/components/SparkSplats.svelte` — SplatMesh (Threlte `<T>` declarative) lifecycle only.
- `src/lib/components/SparkStudioBridge.svelte` — Manages dual SparkRenderer lifecycle via `createSparkStudioRenderer`.
- `src/lib/spark/ScrollAnimator.ts` — Three.js `Object3D` subclass with `keyframes` property and `applyScrollPercentage()`.
- `src/lib/spark/scrollAnimation.ts` — Pure keyframe model, canonicalization (with dedup), upsert/delete, bracketing, and interpolation (position lerp + quaternion slerp).
- `src/lib/studio/scroll-animator/ScrollAnimatorExtension.svelte` — Studio extension: fixed toolbar pane with percentage display/input, keyframe list, jump, delete, and insert/save actions. Uses public `@threlte/studio/extensions` imports.
- `src/lib/studio/scroll-animator/scrollAnimatorRuntime.ts` — Shared runtime bridge: reactive percentage from ScrollTrigger, `jumpToPercentage` via trigger's measured range, attach/detach lifecycle.
- `src/lib/studio/scroll-animator/transactionGuard.ts` — Suppresses source sync for ScrollAnimator transform attributes; only `keyframes` persists. Uses narrow structural types (no private imports).
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
- Brand: `isScrollAnimator = true`, `type = 'ScrollAnimator'`, plus callable `applyScrollPercentage`.
- Canonicalization deduplicates entries that normalize to the same percentage (last-write-wins).

## ScrollTrigger Runtime

One GSAP ScrollTrigger with **boolean `scrub: true`** (never numeric) drives all animators. On initial setup and every `onUpdate`, the scene is traversed and `applyScrollPercentage` is called on every branded `ScrollAnimator`. No per-frame/effect loop reapplies animator transforms. ScrollTrigger retains its own RAF synchronization and resize refresh.

The `scrollAnimatorRuntime` singleton bridges the scene and extension:
- Reactive percentage via Svelte store (subscribed by extension)
- `jumpToPercentage()` uses the trigger's `start`, `end`, and `scroll()`
- `attach()`/`detach()` lifecycle tied to trigger identity

## Camera / CameraTarget Hierarchy

- Real `PerspectiveCamera` is a child of `Camera ScrollAnimator`.
- Named `CameraTarget` (`Object3D`) is a child of `Camera Target ScrollAnimator`.
- The real camera **always looks at CameraTarget's world position**, updated every frame via a Threlte `useTask` (not a renderer.render wrapper).
- Camera animator rotation does not fight the target constraint — look-at wins for the camera's final viewing direction.

## Studio Extension UI

Registered via `<Studio extensions={[ScrollAnimatorExtension]}>`. Uses public `useObjectSelection` and `useTransactions` from `@threlte/studio/extensions`. Shows a `DropDownPane` (default toggle behavior, no custom override) with:
1. Live ScrollTrigger percentage from the shared runtime bridge.
2. Numeric percentage input (0..100) — draft string not overwritten while focused; commits on Enter/blur.
3. Sorted keyframe list with clickable jump and delete buttons.
4. "Insert/save scroll keyframe" button — captures local position + Euler rotation at current percentage.

Active only for exactly one selected `ScrollAnimator`; otherwise shows "Select one ScrollAnimator". Source-sync controls are disabled with a clear message when `vitePluginEnabled` is false.

## Source-Sync Guard Invariant

The `guardScrollAnimatorTransactions` helper runs via `useTransactions().onTransaction()`. For any transaction whose object is a branded `ScrollAnimator`, it clears `transaction.sync` unless `attributeName` is `keyframes` or starts with `keyframes.`. This prevents Studio's transform controls from writing `position`, `rotation`, or `scale` into Svelte source, while allowing `keyframes` mutations through.

Keyframe mutations use `transactions.buildTransaction()` which derives source metadata from the object's `userData.threlteStudio` automatically. No private metadata imports needed.

## Removed Features

Free navigation (checkbox, keyboard/mouse/wheel listeners, RAF loop, pure helpers) and the hard-coded two-pose `cameraTween` module have been removed. GSAP and ScrollTrigger are retained.

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
- **Camera routing via `onBeforeRender` wrap**: Editor renderer's `onBeforeRender` is wrapped to detect `camera.userData.editorCamera === true`. Both paths pin their intended `SparkRenderer.sparkOverride` for the duration of the original callback and restore in `try/finally`.
- **SplatMesh** is created with `paged: true` for RAD streaming. Owned by Threlte `<T>` for declarative transforms. Disposed in `onDestroy`.
- **WebGLRenderer** uses `antialias: false`. DPR clamped to `Math.min(devicePixelRatio, 2)` on desktop, `1` on mobile.
- **renderMode="always"** on `<Canvas>` ensures Spark streaming/sorting renders every frame.
- Theatre.js is **not** used.

## Threlte Studio Integration

- `<Studio extensions={[ScrollAnimatorExtension]}>` wraps the viewer scene. The `threlteStudio()` Vite plugin is registered before `svelte()` in `vite.config.ts`.
- Studio editor cameras are marked with `camera.userData.editorCamera = true`.
- Two literal `<T>` nodes in `RadViewerScene.svelte` host the `ScrollAnimator` instances — not wrapped in a reusable component — so Studio's source sync metadata targets independent `keyframes` attributes.
- Extension uses **only public** `@threlte/studio/extensions` imports (`useObjectSelection`, `useTransactions`). No private module imports or Vite aliases.

## Scroll Layout

Fixed canvas + scrollable document: `<Canvas>` in `.viewer-stage` (`position: fixed; inset: 0`), `.scroll-spacer` (400vh) in document flow.

## Camera Debug State

Visually hidden `<div class="camera-debug" data-testid="camera-state">` with:
- `data-progress` — ScrollTrigger percentage
- `data-x`, `data-y`, `data-z` — Camera **world** position
- `data-target-x`, `data-target-y`, `data-target-z` — CameraTarget **world** position

## Source References

- Threlte authoring extensions: https://threlte.xyz/docs/reference/studio/authoring-extensions/
- Threlte object selection: https://threlte.xyz/docs/reference/studio/use-object-selection/
- Threlte transactions/source sync: https://threlte.xyz/docs/reference/studio/use-transactions/
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/

## Sample RAD URL

```
https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad
```

## E2E Testing

`npm run test:e2e` builds with `VITE_E2E_STUB_SPARK=true`. Studio UI elements are rendered inside the WebGL canvas overlay, so Playwright actionability checks can fail. Tests use targeted `page.evaluate()` for pane toggle clicks when necessary, while verifying visible content through standard locators.

## CORS Note

Remote RAD files and their `.radc` chunk files must be served with CORS headers.
