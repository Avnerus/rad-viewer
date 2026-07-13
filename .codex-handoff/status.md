## Summary

Fixed the dual-`SparkRenderer` routing defect discovered in Codex verification. The previous implementation inverted the override identities: editor-camera renders used `realRenderer` as the `sparkOverride` and real-camera renders had no override at all. This meant the LOD-driving renderer was being updated with Studio editor camera positions, and the non-driving scene renderer handled real-camera renders.

Corrected routing:
- **Editor camera** (`camera.userData.editorCamera === true`) → `sparkOverride = editorRenderer` (`enableDriveLod: false`) — sorts splats for editor view, never drives LOD.
- **Real/default camera** → `sparkOverride = realRenderer` (`enableDriveLod: true`) — drives LOD from real camera position. Shares `lodInstances` to editor renderer after render for the next editor frame.

Both paths use the same `renderWithOverride()` helper with `try/finally` restoration of any pre-existing override value.

## Files changed

| File | Purpose |
|------|---------|
| `src/lib/spark/createSparkStudioRenderer.ts` | Fixed routing: editor → `editorRenderer` override, real → `realRenderer` override. Extracted `renderWithOverride()` helper. Added post-real-render `shareLodInstances()`. Updated module doc comment. |
| `tests/unit/createSparkStudioRenderer.test.ts` | Rewrote camera routing and override restoration tests (23 tests, +2). Tests now assert `sparkOverride` identity *inside* the raw render mock via `originalFn.mockImplementation`. Added error-path restoration for both editor and real camera branches. |
| `AGENTS.md` | Corrected render routing description to reflect editor override = editorRenderer, real override = realRenderer. |

## Acceptance criteria

- **[x]** During raw render for Studio editor camera, `SparkRenderer.sparkOverride` is exactly `editorRenderer` with `enableDriveLod: false`. Verified by `originalFn.mockImplementation` assertion inside render call.
- **[x]** During raw render for real/default camera, `SparkRenderer.sparkOverride` is exactly `realRenderer` with `enableDriveLod: true`. Verified by `originalFn.mockImplementation` assertion inside render call.
- **[x]** Editor-camera rendering cannot drive Spark LOD — `enableDriveLod: false` on editorRenderer.
- **[x]** Real/default-camera rendering is the sole LOD driver — `enableDriveLod: true` on realRenderer.
- **[x]** Editor rendering consumes real renderer's `lodInstances` (shared before editor render) and retains editor-camera sort/view.
- **[x]** Both camera paths restore prior override after success (4 tests) and after exception (2 tests).
- **[x]** Unit tests observe `sparkOverride` *inside* the raw render mock, not after restoration.
- **[x]** Error-path restoration covers both editor and real/default cameras.
- **[x]** Existing lifecycle, profile-option, LOD-sharing, and disposal tests remain green.
- **[x]** `AGENTS.md` accurately describes editor override = editorRenderer, real override = realRenderer.
- **[x]** Status report acknowledges the routing defect and describes the correction.
- **[x]** `npm run test:unit` passes (89/89).
- **[x]** `npm run check` passes (0 errors, 0 warnings).
- **[x]** `npm run lint` passes (0 errors, 0 warnings).
- **[x]** `npm run build` passes.
- **[x]** No end-to-end test created, modified, or run.

## Unit tests

File: `tests/unit/createSparkStudioRenderer.test.ts` (23 tests)

**Camera routing (4 tests):**
- `sets sparkOverride to editorRenderer during editor camera render` — asserts identity and `enableDriveLod: false` inside raw render
- `sets sparkOverride to realRenderer during real/default camera render` — asserts identity and `enableDriveLod: true` inside raw render
- `shares lodInstances from real to editor before editor render`
- `shares lodInstances after real camera render for next editor frame`

**Override restoration (4 tests):**
- `restores sparkOverride after successful editor render` — preserves pre-existing value
- `restores sparkOverride after successful real camera render` — preserves pre-existing value
- `restores sparkOverride when editor render throws` — try/finally on editor path
- `restores sparkOverride when real camera render throws` — try/finally on real path

**Existing tests (15 tests):** creation/options (6), attach idempotence (2), disposal (6), type contract (1) — all remain green.

## Verification

Commands run and results:

```
npm run test:unit   → 89 passed (5 test files)
npm run check       → 0 errors, 0 warnings
npm run lint        → 0 errors, 0 warnings
npm run build       → built in 4.48s, success
```

E2E tests were **not** run per mission instructions.

## Risks or follow-ups

- **None identified.** The corrected routing matches the intended design and Spark's own multi-view pattern. All paths tested with in-render assertions.

## Commit

`ad9a058` pushed to `main`.
