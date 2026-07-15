# Status: Keep Scroll Animator Pane Open Across Object Selection

## Summary

Made the Scroll Animator authoring pane persistent across object selection changes. The pane now closes only via the toolbar toggle or Escape key — hierarchy clicks, canvas interactions, and Inspector use no longer dismiss it.

**Commit:** `0c5566c` on `main`

## Files Changed

| File | Change |
|------|--------|
| `src/lib/studio/scroll-animator/FixedToolbarPane.svelte` | Removed `handlePointerDown` and document `pointerdown` listener; added `focusToggle()` for Escape focus restoration |
| `tests/e2e/rad-viewer.spec.ts` | Replaced "closes on outside click" test with 6 new persistent-pane tests |
| `AGENTS.md` | Updated lifecycle documentation to reflect persistent pane behavior |

## Root Cause and Dismissal-Policy Change

`FixedToolbarPane.svelte` installed a capture-phase `pointerdown` listener on `document` that called `closePanel()` for any click outside the panel or anchor. Since hierarchy selection necessarily occurs outside both, selecting another object always dismissed the pane. The entire outside-pointer mechanism has been removed — no special-casing of Studio DOM classes.

## Selection/Content State Behavior

- **Camera ScrollAnimator selected:** Pane shows "Camera ScrollAnimator" name, 2 keyframes (0% and 100%)
- **Camera Target ScrollAnimator selected:** Same pane updates in place to show "Camera Target ScrollAnimator" name, 1 keyframe (0%)
- **Non-ScrollAnimator or no selection:** Pane shows "Select one ScrollAnimator" neutral state
- **Returning to a ScrollAnimator:** Content repopulates without close/reopen cycle
- **Percentage:** Remains driven by shared runtime; never resets on selection change

## Explicit Toggle/Escape/Focus Behavior

- **Toolbar toggle:** Opens/closes the pane (only explicit close besides Escape)
- **Escape:** Closes the pane and restores focus to the actual `<button>` inside the anchor wrapper via `focusToggle()` — not the non-focusable anchor div

## Nonzero-Scroll Persistent-Pane Evidence

Test "Scroll Animator persistent pane works at nonzero scroll" scrolls to 50%, opens the pane, switches selection to Camera Target ScrollAnimator, and verifies the panel remains visible, in viewport, with updated content.

## Automated Verification Results

All tests pass:

```
npm run check     — 0 errors, 0 warnings
npm run lint      — clean
npm run test:unit — 135 tests passed (9 files)
npm run test:e2e  — 36 tests passed (all passing)
npm run build     — successful production build
```

### New e2e tests (6):
1. **Pane stays open when switching between animators** — Camera → Target ScrollAnimator, verifies single panel, updated name and keyframe count
2. **Pane stays open when selecting non-ScrollAnimator** — Ctrl+click deselect shows neutral state, then repopulates on re-select
3. **Pane stays open when clicking outside (canvas)** — Canvas click does not dismiss
4. **Pane closes via toolbar toggle** — Toggle close still works
5. **Pane closes on Escape and restores focus to toggle button** — Focus verified on the actual button element
6. **Persistent pane works at nonzero scroll** — 50% scroll, selection switch, panel in viewport with correct content

### Removed test:
- "Scroll Animator panel closes on outside click" — Replaced by the persistent-pane canvas click test (same interaction, inverted expectation)

## Acceptance Audit

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Pane remains open during hierarchy selection, Inspector, canvas clicks | ✅ Verified by 3 new e2e tests |
| 2 | Switching between animators updates name/keyframes in place, one panel | ✅ Verified |
| 3 | Non-ScrollAnimator selection keeps pane open, shows neutral state | ✅ Verified |
| 4 | Returning to ScrollAnimator repopulates without close/reopen | ✅ Verified in 2 tests |
| 5 | Selection changes don't reset percentage or mutate transforms | ✅ Verified (percentage unchanged) |
| 6 | Toolbar toggle and Escape are the only close mechanisms | ✅ Verified |
| 7 | Escape returns focus to actual toggle button | ✅ Verified via aria-label check |
| 8 | Persistent pane at nonzero scroll | ✅ Verified at 50% |
| 9 | Outside-pointer listener and related tests fully removed | ✅ Removed from code and test file |
| 10 | Existing positioning, camera, animation, source-sync, Spark behavior intact | ✅ All 30 pre-existing tests still pass |
| 11 | New e2e tests cover complete selection-switching and explicit close paths | ✅ 6 new tests added |

## Remaining Risks

None identified. The change is narrowly scoped to removing one event listener and updating focus behavior. All existing tests pass, confirming no regression in positioning, camera, animation, or Spark behavior.
