# Follow-up Mission for Pi: Verify Real Keyboard and Wheel Input

## Objective
The latest free-navigation implementation appears to fix the code path, but the e2e coverage still does not prove the real browser keyboard path that the user reported as broken. Add Playwright tests that use real `page.keyboard` and `page.mouse.wheel` interactions, fix any remaining keyboard-navigation bug those tests expose, and clean up small reporting/comment inconsistencies.

## Verification Context
Codex pulled the latest implementation as:

```text
e0fdb69 fix: free navigation keyboard, mouse yaw accumulation, add scroll zoom
```

Observed good changes:
- `shouldHandleKeyEvent()` now allows checkbox/radio inputs.
- `updateLookAngles()` and `applyLook()` make yaw/pitch cumulative.
- `data-yaw`, `data-pitch`, and `data-zoom` are exposed for e2e.
- Scroll-to-zoom was added and tested with synthetic wheel events.

Remaining issues:
- `tests/e2e/rad-viewer.spec.ts` test `"keyboard movement changes camera position when free nav is enabled"` dispatches synthetic `KeyboardEvent`s inside `page.evaluate()`. This bypasses the real browser focus path and would not catch the checkbox-focus bug the user observed.
- The existing test that uses `page.keyboard.down('KeyW')` does not assert that keyboard movement changed camera position before disabling free nav.
- Scroll zoom e2e uses `document.dispatchEvent(new WheelEvent(...))`, not actual Playwright mouse-wheel input over the viewer/canvas.
- `src/lib/spark/freeNavigation.ts` comments for `applyZoom()` contradict the implementation/tests: the code does `newFov = camera.fov - scrollDelta * sensitivity`, so positive `deltaY` decreases FOV.
- `.codex-handoff/status.md` reports `Follow-up commit: 5b33240` and `Pushed: no`, while Codex pulled `e0fdb69`.

## Files Likely Involved
- `tests/e2e/rad-viewer.spec.ts`
- `src/lib/components/RadViewerScene.svelte` only if real Playwright keyboard/wheel tests expose a runtime issue
- `src/lib/spark/freeNavigation.ts` for comment/doc cleanup or small helper fixes
- `AGENTS.md` only if behavior/docs change
- `.codex-handoff/status.md`

## Required Fixes
1. Add real Playwright keyboard navigation coverage.
   - Add or rewrite an e2e test so it:
     - starts the viewer;
     - checks the single "Free navigation" checkbox;
     - does **not** manually blur/focus a different element unless that is also how the UI behaves;
     - captures initial camera debug position;
     - uses `page.keyboard.down('KeyW')` or `page.keyboard.press('KeyW')` / arrow key input;
     - waits long enough for the rAF movement loop;
     - uses `page.keyboard.up('KeyW')` if needed;
     - asserts the camera position changed.
   - This test must use Playwright keyboard APIs, not only synthetic `window.dispatchEvent()` / `document.dispatchEvent()` from `page.evaluate()`.
   - Keep the synthetic dispatch test only if useful as a lower-level supplement, not as the main keyboard proof.

2. Fix keyboard navigation if the real Playwright test fails.
   - The important scenario is after clicking/checking the checkbox, where the checkbox may retain focus.
   - A valid fix can be focus management, event filtering, event listener placement, or another robust approach.
   - Ensure text inputs/textarea/contenteditable still do not consume navigation keys for camera movement.

3. Add real Playwright wheel zoom coverage.
   - Add or rewrite an e2e test so it:
     - enables free navigation;
     - moves the mouse over the canvas/viewer;
     - captures initial `data-zoom`;
     - uses `page.mouse.wheel(...)`;
     - asserts `data-zoom` changes and stays within the configured range.
   - Keep the synthetic `WheelEvent` test only if useful as a supplement, not as the main mouse-wheel proof.
   - Preserve the test proving wheel does not zoom when free nav is disabled.

4. Clean up zoom comments/docs.
   - Make `applyZoom()` comments match the actual implementation and tests.
   - Current code: `newFov = camera.fov - scrollDelta * sensitivity`.
   - Therefore positive `scrollDelta` decreases FOV, and negative `scrollDelta` increases FOV, unless you intentionally change the implementation and tests.

5. Correct status metadata.
   - In the final `.codex-handoff/status.md`, do not report `5b33240` or `Pushed: no`.
   - Report the verified prior implementation commit as `e0fdb69`.
   - If the final hash is not known before commit, state "final pushed commit containing this report" rather than inventing a hash.

## Constraints
- Do not remove or weaken the single "Free navigation" checkbox.
- Do not add separate controls for keyboard, mouse-look, or zoom.
- Do not remove or weaken the scroll-driven camera tween when free nav is off.
- Do not make e2e depend on the real remote RAD file; keep the Spark stub path.
- Do not add Theatre.js.
- Do not touch unrelated files.

## Acceptance Criteria
- A Playwright e2e test using `page.keyboard` proves keyboard navigation moves the camera when free nav is enabled immediately after checking the checkbox.
- Keyboard movement remains disabled when free nav is off.
- Text input/textarea/contenteditable safety remains covered.
- A Playwright e2e test using `page.mouse.wheel` proves scroll zoom changes camera FOV in free nav.
- Wheel zoom remains disabled when free nav is off.
- Mouse-look yaw/pitch tests remain in place.
- Zoom comments/docs match the implementation.
- Status report metadata no longer claims a wrong/unpushed commit.

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
