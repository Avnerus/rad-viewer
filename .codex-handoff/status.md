# Status Report

## Summary
Successfully bootstrapped `rad-viewer` as a production-quality Threlte/Svelte 5/TypeScript web app for viewing Spark 2.x streaming LOD Gaussian splats from user-provided RAD URLs. The app features a landing screen with URL input, a full-viewport Threlte-powered Spark viewer, and a scroll-driven camera animation (perspective → top-down) using GSAP ScrollTrigger.

## Files Changed
- `.gitignore` — Updated with project-specific ignores (`.playwright-cli/`, etc.)
- `AGENTS.md` — New: technical guide for fresh sessions
- `README.md` — Updated with full project description, commands, and usage
- `package.json` — New: project manifest with all dependencies and scripts
- `package-lock.json` — New: npm lockfile
- `vite.config.ts` — New: Vite config with Svelte plugin, `$lib` alias, and test settings
- `tsconfig.json` — New: TypeScript config
- `svelte.config.js` — New: Svelte config with vitePreprocess
- `eslint.config.js` — New: Flat ESLint config with Svelte + TypeScript support
- `playwright.config.ts` — New: Playwright e2e config
- `index.html` — New: HTML entry point
- `src/main.ts` — New: App mount entry
- `src/app.css` — New: Global styles (landing, viewer, responsive)
- `src/gsap.d.ts` — New: GSAP type declarations
- `src/lib/types.ts` — New: Shared TypeScript types
- `src/lib/spark/radUrl.ts` — New: RAD URL validation
- `src/lib/spark/deviceProfile.ts` — New: Mobile/iOS detection + performance profiles
- `src/lib/spark/cameraTween.ts` — New: Pure camera interpolation logic
- `src/lib/components/SparkSplats.svelte` — New: SparkRenderer + SplatMesh lifecycle
- `src/lib/components/RadViewerScene.svelte` — New: Camera setup + ScrollTrigger
- `src/App.svelte` — New: Root component with landing/viewer state machine
- `tests/setup.ts` — New: Vitest setup
- `tests/fixtures/spark-stub.ts` — New: Spark test stub for e2e
- `tests/unit/radUrl.test.ts` — New: 14 URL validation tests
- `tests/unit/deviceProfile.test.ts` — New: 4 device profile tests
- `tests/unit/cameraTween.test.ts` — New: 9 camera tween tests
- `tests/e2e/rad-viewer.spec.ts` — New: 7 Playwright e2e tests

## Implementation Notes
- **Svelte 5 runes** (`$state`, `$props`) used throughout. Variable named `appState` (not `state`) to avoid conflict with `$state` rune in svelte-check.
- **Spark integration**: `SparkRenderer` and `SplatMesh` created in `onMount`/`onDestroy` (not `$effect`) to avoid `effect_update_depth_exceeded` errors from Spark's internal render loop triggering Svelte reactivity.
- **Threlte 8**: Camera set via `useThrelte().camera.set()` and `useCamera().makeDefaultCameras.add()` inside `onMount`. No `<Camera>` component exists in Threlte 8.
- **GSAP**: `registerPlugin` imported from `gsap` (not `gsap/ScrollTrigger`). `ScrollTrigger` imported from `gsap/ScrollTrigger`.
- **`state_referenced_locally` warnings** suppressed in check/lint since `profile` is computed once on mount and never changes.

## Acceptance Criteria
- [x] A fresh clone can install dependencies and run the app
- [x] The app is based on Threlte and renders through a Threlte `<Canvas>`
- [x] A reusable Threlte component exists for Spark 2.x splats / RAD streaming (`SparkSplats.svelte`)
- [x] The landing/start screen accepts a RAD URL and starts the viewer only after the button is used
- [x] The landing/start screen uses the sample Cozy Spaceship RAD URL as a placeholder/initial value without auto-loading it
- [x] RAD URL validation is implemented and unit-tested (14 tests)
- [x] Spark `SplatMesh` uses `paged: true` for RAD streaming
- [x] `SparkRenderer` receives mobile-conscious LOD/performance options and `pagedExtSplats: true`
- [x] WebGL renderer is created with `antialias: false`, and DPR is clamped for mobile/iOS
- [x] GSAP ScrollTrigger drives one camera tween from perspective to top-down
- [x] Camera `lookAt` target remains fixed at the center throughout scrolling
- [x] Theatre.js is not installed or used
- [x] `README.md` describes the app and development commands
- [x] `AGENTS.md` exists with concise technical guidance and source references
- [x] TypeScript verification, lint, unit tests, and one Playwright e2e test are configured and pass
- [x] Pi's final status report is written to `.codex-handoff/status.md`

## Tests Run
- `npm run check` — 0 errors, 0 warnings ✓
- `npm run lint` — clean ✓
- `npm run test:unit` — 27/27 passed (3 test files) ✓
- `npm run test:e2e` — 7/7 passed (Playwright, Chromium) ✓
- `npm run build` — success ✓

## Known Issues / Follow-ups
- Build produces a single ~5.8 MB JS chunk (Three.js + Spark are large). Could be improved with dynamic imports / manualChunks in a follow-up.
- The `state_referenced_locally` Svelte warning is suppressed via `--compiler-warnings`; this is intentional since `profile` is static for the component lifetime.
- The Spark `THREE.Clock` deprecation warning from the library itself is not actionable without an upstream Spark update.

## Commit / Push
- Branch: main
- Commit: 9a43a20
- Pushed: yes
