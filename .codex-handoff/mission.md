# Follow-up Mission for Pi: Fix Free-Navigation Mouse Look Verification

## Objective
The declarative splat transform implementation is mostly in place, but Codex verification found a real mouse-look math issue and weak test coverage around mouse movement. Fix those without reworking the broader viewer.

## Verification Context
Codex pulled the implementation as:

```text
22a0f84 feat: declarative splat transforms and free navigation checkbox
```

Observed good changes:
- `src/lib/components/SparkSplats.svelte` removed the hardcoded `mesh.position.set(12, 1,17);`.
- `src/lib/components/RadViewerScene.svelte` now passes `position={[12, 1, 17]}` to `<SparkSplats>`.
- `SplatMesh` is rendered via `<T is={mesh} {position} {rotation} {scale} />`.
- `SparkRenderer` remains imperative and configured with `pagedExtSplats: true`.
- One "Free navigation" checkbox controls keyboard and mouse free-nav mode.

Problems to fix:
- `src/lib/spark/freeNavigation.ts` `applyLookAt()` currently creates a fresh Euler with `euler.y += deltaYaw`, starting from zero each call. `RadViewerScene.svelte` passes only the latest `deltaYaw`, then increments `navYaw` separately. Result: visual camera yaw does not accumulate correctly across mouse moves and ignores the current/extracted yaw.
- `tests/e2e/rad-viewer.spec.ts` "mouse movement path smoke test" only verifies `data-freenav="true"`. It does not prove that mouse movement changed orientation.
- `.codex-handoff/status.md` reports `Commit: 7a1ec95` and `Pushed: no`, while Codex pulled `22a0f84`.

## Files Likely Involved
- `src/lib/spark/freeNavigation.ts`
- `src/lib/components/RadViewerScene.svelte`
- `tests/unit/freeNavigation.test.ts`
- `tests/e2e/rad-viewer.spec.ts`
- `AGENTS.md` if navigation internals/debug attributes change
- `.codex-handoff/status.md`

## Required Fixes
1. Fix mouse-look yaw accumulation.
   - Make camera orientation use cumulative yaw and cumulative/clamped pitch.
   - Prefer changing helper API to accept the new absolute yaw and pitch, or accept current yaw/pitch plus deltas and return both updated values.
   - Do not reset yaw to only the latest mouse delta.
   - Preserve pitch clamping.
   - Ensure keyboard movement direction uses the same yaw that camera orientation uses.

One acceptable shape:

```ts
export function applyLook(
  camera: PerspectiveCamera,
  yaw: number,
  pitch: number,
): void {
  const euler = new Euler(pitch, yaw, 0, 'YXZ')
  camera.quaternion.copy(new Quaternion().setFromEuler(euler))
}

export function updateLookAngles(
  currentYaw: number,
  currentPitch: number,
  deltaYaw: number,
  deltaPitch: number,
  minPitch: number,
  maxPitch: number,
): [number, number] {
  const nextYaw = currentYaw + deltaYaw
  const nextPitch = Math.max(minPitch, Math.min(maxPitch, currentPitch + deltaPitch))
  return [nextYaw, nextPitch]
}
```

Then in `RadViewerScene.svelte`, update `navYaw` and `navPitch` first, apply the absolute values to the camera, and keep movement using `navYaw`.

2. Expose enough camera orientation debug state for e2e.
   - Add hidden debug attributes such as `data-yaw` and `data-pitch`, or a forward vector attribute, to `data-testid="camera-state"`.
   - Keep existing position/progress/freenav attributes.
   - This is for tests only and should remain visually hidden.

3. Strengthen mouse e2e.
   - The mouse movement test must capture initial orientation debug state, move the mouse while free nav is enabled, then assert yaw/pitch/forward vector changed.
   - Keep the existing keyboard movement e2e.
   - Keep scroll-mode e2e proving ScrollTrigger still works when free nav is off.

4. Strengthen unit tests for free-navigation math.
   - Add tests showing repeated mouse/yaw deltas accumulate instead of resetting.
   - Add tests for pitch clamping with the new helper API.
   - If the helper names change, update imports cleanly.

5. Add a lightweight transform-prop test if practical.
   - The previous status claimed tests cover the declarative transform API. Codex did not see a direct assertion beyond source shape.
   - If practical, add a component or e2e assertion using the Spark stub to verify the declarative position prop reaches the stub `SplatMesh` or Threlte object.
   - If this is not practical without brittle internals, document the reason in the status report.

6. Correct status metadata.
   - In the final `.codex-handoff/status.md`, do not report the old `7a1ec95` commit or `Pushed: no`.
   - Report the implementation commit Codex verified (`22a0f84`) and the new follow-up commit accurately.
   - If the final hash cannot be known before commit, phrase it as "final pushed commit containing this report" rather than inventing a hash.

## Constraints
- Do not rework the declarative `SplatMesh` ownership unless directly necessary for tests.
- Do not change the sample RAD URL.
- Do not add Theatre.js, `@threlte/theatre`, or `@threlte/studio`.
- Do not add separate controls; one checkbox must still control both mouse look and WASD/arrow navigation.
- Do not make e2e depend on the real remote RAD file; keep the Spark stub path working.
- Do not weaken TypeScript, lint, or tests.
- Do not touch `.gitignore` unless explicitly required.

## Acceptance Criteria
- Mouse-look yaw accumulates correctly across repeated mouse movement.
- Pitch remains clamped.
- Keyboard movement uses the same yaw orientation that mouse look applies.
- E2E verifies mouse movement changes orientation state, not only that free nav remains enabled.
- Existing e2e still verifies keyboard movement changes camera position when free nav is enabled.
- Existing e2e still verifies scroll-driven camera tween works when free nav is disabled.
- Tests cover the updated free-navigation math.
- Transform-prop test coverage is added, or status explains why it was not practical.
- Status report metadata no longer claims an unpushed/wrong commit.

## Tests to Run
Run these before finalizing:
- `npm run check`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

## Things Pi Must Not Change
- Do not remove `.codex-handoff/mission.md`.
- Do not overwrite unrelated user work.
- Do not remove or weaken the declarative `<SparkSplats position={[12, 1, 17]} />` path.
- Do not remove or weaken the existing scroll-driven camera interaction.
- Do not add separate controls for mouse and keyboard navigation.
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
- Verified prior implementation commit: 22a0f84
- Follow-up commit:
- Pushed: yes/no
```

Before writing the report, re-check that all items in Acceptance Criteria are met. Always write `status.md` as the last action before pushing, then push. After pushing, do not perform any more verifications or modifications.
