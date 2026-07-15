# Final Follow-up Mission: Close Overlay Test and Reporting Gaps

## Objective

Preserve the now-correct production implementation and close the remaining verification defects. This mission is primarily tests and documentation: make the fixed-overlay regression incapable of false positives, individually verify every requested Studio pane/dropdown, distinguish native pointer evidence from synthetic events, and produce a final status report that is actually the last repository action.

## Verified Remaining Problems

1. The overlay e2e test silently skips a pane when it is absent after scrolling:

```ts
const at50 = rectsAt50.find((p) => p.title === pane.title)
if (at50) {
  // assertions
}
```

If a pane disappears—the exact regression under test—`at50` is undefined and the test passes. Presence and identity must be asserted before coordinate comparisons.

2. The mission required independent coverage of the toolbar, Scene Hierarchy, Inspector, Static State, Default Camera preview, and Scroll Animator dropdown. The test/manual report verifies only three `.tp-dfwv` roots. Static State and Default Camera were not opened, and the Scroll Animator tooltip was not included. The status lists this as a risk but marks the overall acceptance item complete.

3. `AGENTS.md` now says toolbar controls “block normal pointer clicks” and recommends synthetic `dispatchEvent`, while the passing e2e camera-toggle test uses a native Playwright click. Synthetic events prove handlers, not human pointer actionability. Document the real distinction accurately.

4. Commit `2ab4bc5` modified `AGENTS.md` after `.codex-handoff/status.md`, again violating the required final-report ordering. The final report must include the current tree and be the last modification before commit/push.

## Files Likely Involved

- `tests/e2e/rad-viewer.spec.ts`
- `AGENTS.md`
- `.codex-handoff/status.md`
- Production Svelte/CSS only if a stable semantic selector is genuinely necessary; otherwise do not alter production code

## Required Work

### 1. Make overlay regression assertions strict

- Open/enable all requested UI before the baseline measurement:
  - main Threlte Studio toolbar;
  - Scene Hierarchy;
  - Inspector;
  - Static State pane/dialog, if this installed Studio build exposes it;
  - Default Camera preview;
  - Scroll Animator dropdown/tooltip.
- Identify each expected element semantically by its title, heading, accessible label, or a narrowly added stable test marker. Do not rely on array index or generic first match.
- The Scroll Animator tooltip is not necessarily `.tp-dfwv`; capture its actual outer viewport-positioned element.
- Capture a record keyed by unique expected identity at top, 50%, and near-bottom scroll.
- At every scroll position, assert:
  - every expected key still exists;
  - there are no duplicate keys;
  - the expected/open pane set is unchanged;
  - each pane is visible and intersects the viewport;
  - `top` and `left` remain within a small tolerance of baseline.
- Never guard a required assertion with `if (found)`. Fail clearly when an expected pane disappears.

Critical shape:

```ts
for (const expected of expectedPaneNames) {
  const baseline = atTop.get(expected)
  const middle = at50.get(expected)
  const bottom = at95.get(expected)
  expect(baseline, `${expected} missing at top`).toBeDefined()
  expect(middle, `${expected} missing at 50%`).toBeDefined()
  expect(bottom, `${expected} missing at 95%`).toBeDefined()
  // compare required rectangles; no optional branch
}
```

- If Static State is genuinely absent from this installed/configured Studio build, prove that from the installed extension/configuration and report it as not applicable rather than silently omitting it. Do not claim it verified.

### 2. Verify native pointer actionability honestly

- Automated stub e2e should continue using native Playwright `.click()` for the editor-camera toggle and Scroll Animator open/close control.
- With the real Baby Yoda RAD, attempt normal pointer interaction through `playwright-cli click` (or the equivalent real pointer command) for both controls.
- Do not use `.click()` in page evaluation, `dispatchEvent`, forced clicks, temporary CSS changes, or element hiding as evidence of pointer actionability.
- If the real WebGL session still stalls the automation tool, report that exact limitation. A synthetic event may be separately documented only as handler-level diagnostics, not as a successful pointer test.
- Correct `AGENTS.md` so it does not categorically claim canvas-overlay controls block normal clicks. Prefer native clicks; describe evaluate/dispatch only as a last-resort diagnostic for a known tool/GPU stall and clearly state what it does not verify.

### 3. Keep the status and acceptance audit truthful

- Report each pane separately with top/50%/95% coordinates.
- Mark each requested item met, not applicable with evidence, blocked, or not met.
- Do not mark “all relevant panes verified” if any requested pane remains unopened or inferred only from a shared CSS class.
- Include native pointer results separately for stub e2e and real-RAD manual automation.
- Include commits `bff86c7`, `3bd45b2`, `2ab4bc5`, and this final correction as applicable.

## Constraints

- Preserve the correct CameraControls defaults (`0.05`, `0.05`, `true`) and unattached-by-default semantics.
- Preserve declarative `<T is={camera} makeDefault />` ownership and camera off/on/off behavior.
- Preserve the semantic `<h2>` and hidden generated title row.
- Preserve the user's origin-only, URL-only `SparkSplats` API.
- Do not change ScrollAnimator playback, keyframes, transaction guard, GSAP/ScrollTrigger, CameraTarget look-at, Spark renderers, or LOD routing.
- Do not reintroduce free navigation.
- Do not patch/deep-import dependencies or broadly restyle Studio/Tweakpane.
- Do not weaken tests to accommodate missing elements.
- Avoid production changes unless a stable selector is required.

## Acceptance Criteria

- [ ] The overlay e2e test fails if any expected pane disappears at either later scroll position.
- [ ] Toolbar, Scene Hierarchy, Inspector, Default Camera, and Scroll Animator dropdown are each opened, uniquely identified, visibility-checked, and coordinate-checked at top/50%/95%.
- [ ] Static State is either tested the same way or explicitly proven unavailable/not applicable in this build.
- [ ] Expected pane identity/set equality is asserted; no required check is conditional on a successful `.find()`.
- [ ] Native Playwright clicks verify editor-camera and Scroll Animator controls in automated e2e.
- [ ] Real Baby Yoda session native-pointer results are reported honestly; synthetic events are not presented as pointer evidence.
- [ ] `AGENTS.md` accurately describes native clicks versus the optional diagnostic fallback.
- [ ] All existing production fixes and the user's SparkSplats change remain intact.
- [ ] The final status audit contains no claim contradicted by its risks/evidence.
- [ ] `.codex-handoff/status.md` is the last modification before the final commit/push.

Re-check every acceptance item before finalizing.

## Tests to Run

Update the e2e test and run:

```bash
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Use `https://avner.us/baby_yoda-lod.rad` for the final real-browser pointer and coordinate verification. Trust actual test outcomes; do not convert failures into optional branches.

## Things Pi Must Not Change

- Any correct runtime behavior from `3bd45b2`.
- CameraControls bridge values/API.
- Camera and CameraTarget hierarchy.
- SparkSplats origin/API simplification.
- ScrollAnimator source-sync/interpolation architecture.
- Unrelated UI, dependencies, configuration, or tests.

## AGENTS.md Update

Update only the manual Playwright guidance necessary to state:

- native pointer commands are the preferred interaction proof;
- synthetic evaluate/dispatch is diagnostic-only and does not prove hit testing/actionability;
- any recurring real-RAD GPU/tool limitation must be described conditionally, not as an inherent canvas-overlay behavior.

Keep the existing accurate architecture and feature information concise.

## Expected Completion Report

Rewrite `.codex-handoff/status.md` with:

1. Summary and complete commit list.
2. Changed files.
3. Explanation of the former false-positive test and strict replacement.
4. Per-element top/50%/95% rectangle and visibility evidence.
5. Static State availability/testing evidence.
6. Native pointer results for stub e2e and real Baby Yoda automation, with synthetic diagnostics clearly separated if used.
7. Exact automated test results.
8. Acceptance audit with no inference presented as verification.
9. Remaining risks.

Always write `status.md` as the **last action** before committing and pushing. After writing it, do not run verification, edit `AGENTS.md`, or make any other modification. Commit all work and push the current branch.
