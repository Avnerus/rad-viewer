# RAD Viewer

A web-based viewer for **Spark 2.x streaming LOD Gaussian splats** from user-provided RAD file URLs. Built with [Svelte 5](https://svelte.dev/), [Threlte](https://threlte.xyz/), [Three.js](https://threejs.org/), and [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).

## Features

- Landing screen with RAD URL input and start button
- Full-viewport Threlte-powered Spark viewer
- Scroll-driven camera animation: scroll from a perspective view to a top-down view
- Free navigation mode: single checkbox enables mouse look + WASD/arrow first-person movement
- Mobile-aware performance settings (DPR clamping, reduced splat budgets, foveation)
- RAD URL validation with user-friendly error messages
- URL preserved in query string for reloadability

## Sample RAD URL

```
https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad
```

This URL is pre-filled in the input field for convenience.

## Installation & Development

```bash
npm install        # Install dependencies
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
```

## Quality Checks

```bash
npm run check      # TypeScript + Svelte type checking
npm run lint       # ESLint
npm run test:unit  # Vitest unit tests
npm run test:e2e   # Playwright e2e tests
npm run test       # All tests
```

## How to Use

1. Open the app in a browser.
2. Paste a `.rad` file URL (or use the pre-filled sample).
3. Click **Start**.
4. The viewer loads the splat data via Spark's streaming LOD system.
5. **Scroll** to animate the camera from an angled perspective to a top-down view.
6. Check **Free navigation** (bottom-right) to enable mouse look and `WASD`/arrow key movement. Uncheck it to return to scroll-driven camera.
7. Click **← Back** to return to the URL input.

## Providing a RAD URL

The app accepts:
- Full `http://` or `https://` URLs
- Same-origin relative paths (e.g., `/assets/model.rad`)

The file must have a `.rad` extension. Query strings and hash fragments are allowed.

## CORS

Remote RAD files and their `.radc` chunk files must be served with [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) headers. If a URL fails to load, verify that the server allows cross-origin requests from your domain.

## Mobile Performance

On mobile/iOS devices, the app automatically applies conservative settings:
- Device pixel ratio clamped to 1
- Reduced splat scale and higher render scale
- Lower `maxStdDev` and `maxPagedSplats`
- Stronger foveation culling

These settings are controlled by Spark's LOD system and renderer options.

## Architecture

- **Svelte 5** with runes (`$state`, `$effect`, `$props`)
- **Threlte** `<Canvas>` with custom `createRenderer` for Spark compatibility
- **Spark 2.x** `SparkRenderer` + `SplatMesh` with `paged: true` for RAD streaming
- **GSAP ScrollTrigger** for scroll-driven camera animation
- **Vitest** for unit tests, **Playwright** for e2e tests

## Tech Stack

| Package | Purpose |
|---------|---------|
| `svelte@5` | UI framework with runes |
| `@threlte/core` | Three.js integration for Svelte |
| `@sparkjsdev/spark` | Gaussian splat rendering with streaming LOD |
| `three` | 3D graphics |
| `gsap` | ScrollTrigger camera animation |
| `vite` | Build tool and dev server |
| `vitest` | Unit testing |
| `@playwright/test` | End-to-end testing |
