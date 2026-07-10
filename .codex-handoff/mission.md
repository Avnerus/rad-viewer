# Follow-up Mission for Pi: Fix Real Free-Navigation Input Semantics

## Objective
Fix and verify the real browser input behavior for free navigation. The user reports:
- Keyboard navigation does not work reliably.
- `W`/`S` and Arrow Up/Down are reversed.
- Mouse wheel zoom-out stops at the initial view, so the user can effectively only zoom in.

Use real Playwright input coverage (`page.keyboard`, `page.mouse.wheel`) to reproduce and prevent regressions.

## Verification Context
Codex last pulled the implementation as:

```text
e0fdb69 fix: free navigation keyboard, mouse yaw accumulation, add scroll zoom
```

Current known implementation details from prior verification:
- Free navigation is enabled by one checkbox labeled "Free navigation".
- `src/lib/spark/freeNavigation.ts` contains `computeMoveDirection`, `applyMovement`, `updateLookAngles`, `applyLook`, `applyZoom`, and key filtering.
- Existing e2e still relied too much on synthetic events for keyboard/wheel behavior.
- `applyZoom()` uses `newFov = camera.fov - scrollDelta * sensitivity`.
- The camera starts at FOV 60, `minFov` 10, `maxFov` 90.

## Files Likely Involved
- `src/lib/spark/freeNavigation.ts`
- `src/lib/components/RadViewerScene.svelte`
- `src/App.svelte` only if checkbox focus handling needs adjustment
- `tests/e2e/rad-viewer.spec.ts`
- `tests/unit/freeNavigation.test.ts`
- `AGENTS.md`
- `README.md`
- `.codex-handoff/status.md`

## Required Fixes
1. Add real Playwright keyboard navigation coverage.
   - Use `page.keyboard.down()` / `page.keyboard.up()` or `page.keyboard.press()` after checking the Free navigation checkbox.
   - Do not rely only on `window.dispatchEvent()` or `document.dispatchEvent()` from `page.evaluate()`.
   - The test must prove that keyboard navigation works immediately after enabling the checkbox, matching the user’s reported failure path.

2. Fix forward/back semantics.
   - `W` and Arrow Up should move the camera forward in the direction it is looking.
   - `S` and Arrow Down should move backward.
   - `A` and Arrow Left should strafe left.
   - `D` and Arrow Right should strafe right.
   - Add unit tests for direction semantics and e2e tests proving at least forward/back move in the expected opposite directions.
   - If the current coordinate system makes “forward” ambiguous, define it explicitly in code comments and tests from the camera’s actual free-nav yaw/orientation, not from an accidental world-axis sign.

3. Fix zoom-out range and semantics.
   - The user must be able to zoom both in and out from the initial FOV.
   - Mouse wheel zoom-out must not stop at the initial FOV 60 unless it reaches the configured `maxFov`.
   - With current defaults, zoom-out from 60 should be able to increase FOV toward `maxFov` 90.
   - Reverse the current wheel direction.
   - Current implementation uses `newFov = camera.fov - scrollDelta * sensitivity`, so positive `deltaY` decreases FOV. Change this convention so:
     - positive `deltaY` zooms out by increasing FOV toward `maxFov`;
     - negative `deltaY` zooms in by decreasing FOV toward `minFov`.
   - Make code, comments, README/AGENTS, and tests agree with this reversed direction.
   - Add real `page.mouse.wheel(...)` e2e coverage for both zoom-in and zoom-out from initial view.
   - Keep zoom disabled when free navigation is off.

4. Preserve existing behavior.
   - Mouse-look yaw/pitch accumulation must remain fixed.
   - Pitch clamping must remain tested.
   - Scroll-driven camera tween must still work when free nav is off.
   - One checkbox must still control mouse look, keyboard navigation, and wheel zoom together.

5. Correct docs and report metadata.
   - Update `AGENTS.md` and README if input semantics or wheel direction wording changes.
   - In `.codex-handoff/status.md`, report the verified prior implementation commit as `e0fdb69`.
   - Do not leave `Pushed: no` after pushing.
   - If the final hash is not known before commit, say "final pushed commit containing this report" rather than inventing a hash.

## Acceptance Criteria
- Real Playwright keyboard input proves free-navigation keyboard movement works after enabling the checkbox.
- `W` / Arrow Up moves forward, and `S` / Arrow Down moves backward, not reversed.
- Direction semantics are covered in unit tests and at least one e2e assertion.
- Real Playwright mouse wheel input proves zoom-in works with negative `deltaY`.
- Real Playwright mouse wheel input proves zoom-out works with positive `deltaY`, beyond the initial FOV until the configured maximum.
- Wheel zoom remains inactive when free navigation is off.
- Mouse-look yaw/pitch tests remain in place.
- Scroll-driven camera tween still works when free navigation is off.
- README and AGENTS describe the correct key and zoom behavior.
- Status report metadata is accurate.

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
- Do not remove the declarative `<SparkSplats position={[12, 1, 17]} />` path.
- Do not add separate navigation controls.
- Do not remove the scroll-driven camera interaction.
- Do not make e2e depend on the real remote RAD file.
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
- Verified prior implementation commit: e0fdb69
- Follow-up commit:
- Pushed: yes/no
```

Before writing the report, re-check that all items in Acceptance Criteria are met. Always write `status.md` as the last action before pushing, then push. After pushing, do not perform any more verifications or modifications.
