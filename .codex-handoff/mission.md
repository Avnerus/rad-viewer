# Follow-up Mission for Pi: Tighten Direction E2E and Status Metadata

## Objective
The latest implementation appears to fix the free-navigation direction and zoom semantics, but Codex verification found remaining handoff/test precision issues. Tighten these without reworking the feature.

## Verification Context
Codex pulled the latest implementation as:

```text
1982f63 fix: correct W/S forward/back direction, reverse zoom semantics, use real Playwright input
```

Observed good changes:
- `applyMovement()` now maps local forward `-Z` to world `-Z` at yaw `0`.
- `applyZoom()` now uses `camera.fov + scrollDelta * sensitivity`, so positive `deltaY` zooms out and negative `deltaY` zooms in.
- E2E uses real `page.keyboard` and `page.mouse.wheel`.
- Unit tests cover W/S and zoom direction.

Remaining issues:
- `.codex-handoff/status.md` reports `Follow-up commit: 4985b4e` and `Pushed: no (pending)`, while Codex pulled `1982f63` from `origin/main`.
- README says "scroll-to-zoom" but does not explicitly state the wheel direction after the user specifically requested it be reversed.
- The e2e W/S test proves W and S move in opposite directions, but it does not prove W/ArrowUp move along the yaw-derived forward vector. Strengthen it so the browser-level test catches a future reversal.

## Files Likely Involved
- `tests/e2e/rad-viewer.spec.ts`
- `README.md`
- `.codex-handoff/status.md`
- `AGENTS.md` only if docs need a small wording correction

## Required Fixes
1. Strengthen e2e direction semantics.
   - Keep using real Playwright input (`page.keyboard.down/up`), not synthetic events.
   - Use the camera debug `data-yaw` to compute the expected horizontal forward vector according to the code convention:
     - local forward is `-Z`;
     - at yaw `0`, forward is world `(0, -1)` in X/Z;
     - from current implementation, horizontal forward vector is `[Math.sin(yaw) * -1, Math.cos(yaw) * -1]` for X/Z, or an equivalent expression matching `applyMovement()`.
   - Assert the W movement delta has a positive dot product with the expected forward vector.
   - Assert S movement has a negative dot product with that same expected forward vector, or add equivalent ArrowUp/ArrowDown assertions.
   - Keep the simpler "moved at all" test only if useful, but do not rely on it as the main direction proof.

2. Update README wording.
   - Explicitly document the current wheel convention:
     - scroll down / positive wheel delta zooms out;
     - scroll up / negative wheel delta zooms in.
   - Keep wording concise.

3. Correct status metadata.
   - In `.codex-handoff/status.md`, do not report `4985b4e` or `Pushed: no`.
   - Report the verified prior implementation commit as `1982f63`.
   - If the final follow-up hash is not known before commit, say "final pushed commit containing this report" rather than inventing a hash.

## Constraints
- Do not change free-navigation runtime code unless the strengthened e2e exposes a real bug.
- Do not add separate navigation controls.
- Do not remove the declarative `<SparkSplats position={[12, 1, 17]} />` path.
- Do not remove scroll-driven camera mode.
- Do not make e2e depend on the real remote RAD file.
- Do not touch unrelated files.

## Acceptance Criteria
- E2E using real Playwright keyboard input proves W/ArrowUp forward semantics, not just nonzero movement.
- E2E proves S/ArrowDown backward semantics or equivalent inverse movement.
- README explicitly states the wheel direction for zoom.
- Status report metadata accurately references `1982f63` as the prior implementation and does not claim `Pushed: no` after the final push.
- Existing unit/e2e coverage for zoom direction remains intact.

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
- Verified prior implementation commit: 1982f63
- Follow-up commit:
- Pushed: yes/no
```

Before writing the report, re-check that all items in Acceptance Criteria are met. Always write `status.md` as the last action before pushing, then push. After pushing, do not perform any more verifications or modifications.
