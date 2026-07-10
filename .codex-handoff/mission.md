# Mission Brief for Pi: Declarative Splat Transform and Optional Free Navigation

## Objective
Update `rad-viewer` so Spark splat transforms are controlled declaratively through the Threlte-facing `<SparkSplats>` component API, then add one viewer checkbox that enables both mouse-driven camera panning/look and first-person keyboard navigation with `WASD` and arrow keys.

Current context observed by Codex:
- `src/lib/components/SparkSplats.svelte` imperatively applies static splat positioning with `mesh.position.set(12, 1,17);`.
- `src/lib/components/RadViewerScene.svelte` currently renders `<SparkSplats {url} {profile} />`.
- `SparkRenderer` and `SplatMesh` are currently added imperatively to the Three scene.
- There is an unrelated local `.gitignore` modification in the workspace adding `.vercel`; do not overwrite unrelated user work.

## Files Likely Involved
- `src/lib/components/SparkSplats.svelte`
- `src/lib/components/RadViewerScene.svelte`
- `src/App.svelte` if the checkbox state should live at the app/viewer shell level
- `src/app.css`
- `src/lib/types.ts`
- `src/lib/spark/cameraTween.ts` only if navigation mode needs camera pose helpers
- `src/lib/spark/freeNavigation.ts` or similar new helper if useful
- `tests/unit/*.test.ts`
- `tests/e2e/rad-viewer.spec.ts`
- `AGENTS.md`
- `README.md` if user-visible controls or commands change
- `.codex-handoff/status.md` as the final report

## Required Implementation
1. Move static splat positioning to declarative component props.
   - Remove the hardcoded `mesh.position.set(12, 1,17);` from `SparkSplats.svelte`.
   - Add typed props to `SparkSplats.svelte`, at minimum:
     - `position?: [number, number, number]`
     - optionally `rotation?: [number, number, number]`
     - optionally `scale?: number | [number, number, number]`
   - Keep the current static value by passing it declaratively from the parent:

```svelte
<SparkSplats
  {url}
  {profile}
  position={[12, 1, 17]}
/>
```

2. Prefer Threlte ownership for the `SplatMesh`.
   - Keep `SparkRenderer` imperative. It is renderer infrastructure and should still be created with the real `renderer`, `pagedExtSplats: true`, and the device profile options.
   - Wrap the `SplatMesh` with Threlte `<T is={mesh} ... />` so transforms are applied declaratively.
   - Do not also call `scene.add(mesh)` when the mesh is rendered through `<T>`.
   - Dispose the mesh on destroy. Ensure no duplicate scene membership and no leaked Spark objects.
   - If Threlte `<T>` cannot safely own `SplatMesh`, document the blocker in status and still provide a declarative props API that applies transforms through a reactive effect.

Critical shape:

```svelte
<script lang="ts">
  import { T, useThrelte } from '@threlte/core'
  import { onDestroy, onMount } from 'svelte'
  import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'

  let {
    url,
    profile,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
  } = $props()

  const { renderer, scene } = useThrelte()
  let spark: SparkRenderer | null = null
  let mesh: SplatMesh | null = $state(null)

  onMount(() => {
    spark = new SparkRenderer({
      renderer,
      pagedExtSplats: true,
      ...profile.sparkRenderer,
    })
    scene.add(spark)

    mesh = new SplatMesh({
      url,
      paged: true,
      raycastable: false,
    })
  })

  onDestroy(() => {
    mesh?.dispose()
    spark?.parent?.remove(spark)
    spark?.dispose()
  })
</script>

{#if mesh}
  <T is={mesh} {position} {rotation} {scale} />
{/if}
```

3. Add one checkbox that enables both mouse panning/look and first-person keyboard movement.
   - Add a single user-facing checkbox, for example "Free navigation".
   - When unchecked, preserve the current scroll-driven camera tween behavior.
   - When checked:
     - Enable mouse-movement camera panning/look in the canvas/viewer area.
     - Enable first-person keyboard movement with `W`, `A`, `S`, `D` and arrow keys.
     - Use a single checkbox state for both mouse and keyboard behavior. Do not add separate toggles.
     - Avoid fighting the existing ScrollTrigger camera tween. A reasonable approach is to disable/ignore ScrollTrigger camera updates while free navigation is enabled, then restore the scroll pose when disabled.
     - Do not require pointer lock unless you decide it is necessary; if used, make the interaction and tests robust.
     - Prevent keyboard handling from interfering with typing in form controls.
   - Use small, deterministic movement constants and clamp pitch to avoid camera flips.

4. Keep camera target behavior clear.
   - Scroll mode must still tween from perspective to top-down and keep the fixed lookAt center.
   - Free navigation mode may use yaw/pitch orientation and should not be constrained to the center lookAt target while enabled.
   - When returning to scroll mode, re-apply the current ScrollTrigger pose or the closest valid scroll pose so the camera is not left in a free-navigation orientation.

5. Update tests.
   - Add or update unit tests for transform prop helpers if you extract helper logic.
   - Add unit tests for free-navigation math if movement/yaw/pitch logic is extracted.
   - Update Playwright e2e to verify:
     - the checkbox exists as one control;
     - enabling it allows keyboard movement to change camera debug state;
     - mouse movement path is at least smoke-tested if feasible with Playwright;
     - disabling it restores scroll-driven behavior.
   - Existing scroll e2e must continue to assert camera progress/position changes in scroll mode.

6. Update docs.
   - Update `AGENTS.md` with the current architecture:
     - `SparkRenderer` remains imperative.
     - `SplatMesh` is owned by Threlte `<T>` if implemented that way.
     - `<SparkSplats>` accepts transform props such as `position`.
     - The one "Free navigation" checkbox enables both mouse panning/look and WASD/arrow movement.
   - Update `README.md` with the checkbox behavior if user-facing controls are described there.

## Constraints
- Do not remove the sample RAD URL.
- Do not add Theatre.js, `@threlte/theatre`, or `@threlte/studio`.
- Do not add large assets.
- Do not make e2e depend on loading the real remote RAD file; keep the Spark stub path working.
- Do not weaken TypeScript, lint, or test coverage to pass.
- Do not overwrite unrelated local/user changes such as the existing `.gitignore` modification.
- Do not rework the app styling beyond what the checkbox/navigation affordance requires.

## Acceptance Criteria
- The hardcoded `mesh.position.set(12, 1,17);` is removed.
- The same splat offset is preserved declaratively via `<SparkSplats position={[12, 1, 17]} />` or an equivalent typed prop.
- `SplatMesh` is owned by Threlte `<T>` with declarative transform props, unless a documented technical blocker requires an imperative fallback.
- `SparkRenderer` remains configured with `pagedExtSplats: true`, mobile-conscious profile options, and the real Threlte/Three renderer.
- No duplicate scene-add path exists for the same `SplatMesh`.
- One checkbox controls both mouse panning/look and WASD/arrow first-person navigation.
- Scroll camera tween still works when the checkbox is off.
- Free navigation changes camera state when the checkbox is on.
- Keyboard listeners ignore form inputs and are cleaned up on destroy.
- Tests cover the new declarative transform API and the one-checkbox free-navigation behavior.
- `AGENTS.md` and README are updated where relevant.

## Tests to Run
Run these before finalizing:
- `npm run check`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

Create new tests for new transform/navigation functionality; do not only rely on existing tests.

## Things Pi Must Not Change
- Do not remove `.codex-handoff/mission.md`.
- Do not overwrite unrelated user work.
- Do not change `.gitignore` unless directly asked by the user.
- Do not remove or weaken the existing scroll-driven camera interaction.
- Do not add separate controls for mouse panning and keyboard navigation; use one checkbox.
- Do not push without `status.md`.
- Always write `status.md` as the last file modification before committing/pushing.
- After pushing, do not perform any more verifications or modifications.

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

Before writing the report, re-check that all items in Acceptance Criteria are met. Always write `status.md` as the last action before pushing, then push. After pushing, do not perform any more verifications or modifications.
