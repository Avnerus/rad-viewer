# Follow-up Mission for Pi: Correct Handoff Docs and Status Metadata

## Objective
The scroll/camera implementation fixes appear to be in place, but the fresh-session documentation and status report still contain inaccurate metadata. Correct those without changing viewer behavior unless a tiny cleanup is directly tied to the documentation mismatch.

## Verification Context
Codex pulled the follow-up implementation as commit:

```text
18feb54 fix: tighten scroll interaction, camera debug state, and e2e verification
```

The implementation now appears to include:
- Real scroll height through `.scroll-spacer`.
- Fixed canvas through `.viewer-stage`.
- ScrollTrigger querying `.scroll-spacer`.
- Camera debug attributes for e2e verification.
- `npm run test:e2e` using `cross-env VITE_E2E_STUB_SPARK=true`.
- Imperative-only Spark object ownership in `SparkSplats.svelte`.

However:
- `.codex-handoff/status.md` says `Commit: 770cb84` and `Pushed: no`, which does not match the pulled Git state.
- `AGENTS.md` says `.viewer-container` provides scroll range and `.scroll-track` inside `RadViewerScene.svelte` is the trigger. Actual code uses `.viewer-stage` in `App.svelte`, `.scroll-spacer` in `App.svelte`, and `RadViewerScene.svelte` queries `.scroll-spacer`.
- `src/app.css` still has an unused `.scroll-track` rule; remove it if it is truly unused, or update docs if you intentionally keep it. Do not reintroduce a `.scroll-track` element unless there is a real reason.

## Files Likely Involved
- `AGENTS.md`
- `.codex-handoff/status.md`
- `src/app.css` only if removing the unused `.scroll-track` rule
- `README.md` only if you find the same stale selector documentation there

## Required Fixes
1. Update `AGENTS.md` so the Scroll Layout section matches the actual code:
   - `<Canvas>` lives in `src/App.svelte`.
   - `.viewer-stage` is fixed and contains the canvas.
   - `.scroll-spacer` lives in `src/App.svelte`, is in document flow, and provides the 400vh scroll range.
   - `RadViewerScene.svelte` queries `.scroll-spacer` as the ScrollTrigger trigger.
   - Do not mention `.viewer-container` or `.scroll-track` unless those selectors really exist in active code.
2. Update `.codex-handoff/status.md` so it no longer claims the wrong commit or `Pushed: no`.
   - Do not invent a future self-referential commit hash.
   - It is acceptable to state that the verified implementation commit was `18feb54` and that this follow-up commit corrects handoff docs/status.
   - Set push state accurately for the intended final state, e.g. `Pushed: yes, after final push`.
3. If `.scroll-track` is unused, remove the unused CSS rule from `src/app.css`.
4. Do not alter the scroll/camera/Spark behavior unless needed to remove an unused selector cleanly.

## Constraints
- Do not rework the implementation.
- Do not change the sample RAD URL.
- Do not add Theatre.js.
- Do not add assets.
- Do not weaken TypeScript, lint, or tests.
- Do not run more modifications or verification after pushing.

## Acceptance Criteria
- `AGENTS.md` accurately describes the current scroll layout and ScrollTrigger trigger selector.
- `.codex-handoff/status.md` no longer reports `770cb84` as the pushed commit or `Pushed: no`.
- No stale `.scroll-track` documentation remains unless `.scroll-track` is active code.
- If `.scroll-track` CSS was unused, it is removed.
- Viewer behavior remains unchanged.
- Final report explains this was a documentation/status correction follow-up.

## Tests to Run
Because this should be documentation/status-only plus optional unused CSS removal:
- `npm run check`
- `npm run lint`
- `npm run build`

If you touch tests or runtime TypeScript/Svelte logic, also run:
- `npm run test:unit`
- `npm run test:e2e`

No new tests are needed unless you change runtime behavior.

## Things Pi Must Not Change
- Do not remove `.codex-handoff/mission.md`.
- Do not overwrite unrelated user work.
- Do not modify the core scroll/camera implementation unless directly required for the selector cleanup above.
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

## Tests Run
- `npm run check` - result
- `npm run lint` - result
- `npm run build` - result
- `npm run test:unit` - result, if run
- `npm run test:e2e` - result, if run

## Known Issues / Follow-ups
- ...

## Commit / Push
- Branch:
- Verified implementation commit: 18feb54
- Status/docs correction commit: final commit containing this report
- Pushed: yes, after final push
```

Before writing the report, re-check that all items in Acceptance Criteria are met. Always write `status.md` as the last file modification before committing and pushing.
