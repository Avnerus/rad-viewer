# RAD Viewer — Technical Guide

## Architecture

A client-side Threlte/Svelte 5/TypeScript web app for viewing Spark 2.x streaming LOD Gaussian splats from user-provided RAD URLs.

**Key files:**
- `src/App.svelte` — Root component. Landing screen ↔ viewer state machine. `<Canvas>` lives here.
- `src/lib/components/RadViewerScene.svelte` — Camera setup, ScrollTrigger, and camera debug state element.
- `src/lib/components/SparkSplats.svelte` — SparkRenderer + SplatMesh lifecycle (imperative `onMount`/`onDestroy`).
- `src/lib/spark/cameraTween.ts` — Pure camera interpolation logic (unit-testable).
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

- **SparkRenderer** is created once in `SparkSplats.svelte` `onMount` with `pagedExtSplats: true` and device-profile options. Added to the Three.js scene imperatively via `scene.add()`. Removed and disposed in `onDestroy`.
- **SplatMesh** is created with `paged: true` for RAD streaming. Also added imperatively via `scene.add()` in `onMount`, removed and disposed in `onDestroy`. No `<T>` declarative usage — avoids duplicate scene membership.
- **WebGLRenderer** uses `antialias: false` (splats don't benefit from MSAA).
- **DPR** is clamped to `Math.min(devicePixelRatio, 2)` on desktop, `1` on mobile.
- **renderMode="always"** on `<Canvas>` ensures Spark streaming/sorting and ScrollTrigger camera changes render every frame.
- Camera is registered via `useThrelte().camera.set()` and `useCamera().makeDefaultCameras.add()` in `onMount`.
- Theatre.js is **not** used.

## Scroll Layout

The viewer uses a **fixed canvas + scrollable container** pattern:
- `.viewer-container` has `min-height: 400vh` providing the scroll range.
- `.viewer-stage` is `position: fixed; inset: 0` keeping the canvas pinned to the viewport.
- `.scroll-track` inside `RadViewerScene.svelte` provides the ScrollTrigger trigger element.
- Scrolling is real (`window.scrollY` changes), and ScrollTrigger progress drives the camera tween.

## ScrollTrigger Invariant

The camera `lookAt` target is **always fixed at the scene center `[0, 0, 0]`** throughout scrolling. Only the camera position interpolates.

ScrollTrigger is created in `RadViewerScene.svelte` `onMount`, killed on `onDestroy`.

## Camera Debug State

`RadViewerScene.svelte` renders a visually hidden `<div class="camera-debug" data-testid="camera-state">` with attributes:
- `data-progress` — ScrollTrigger progress (0..1)
- `data-x`, `data-y`, `data-z` — Camera position
- `data-target` — Fixed lookAt target

Used by e2e tests to verify camera movement. Not visible to users.

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

## CORS Note

Remote RAD files and their `.radc` chunk files must be served with CORS headers. If a RAD URL fails to load, check that the origin allows cross-origin requests.
