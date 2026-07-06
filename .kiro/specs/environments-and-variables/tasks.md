# Implementation Plan

## Overview

This plan implements Environments and Variables in nine task groups, ordered to build from the foundation up: data model first, then the pure resolution library (independently testable), then store wiring, then the send-path integration, then UI, and finally tests and verification. The resolution library (task 2) is the core and is built before any UI so it can be unit tested in isolation.

## Task Dependency Graph

Tasks are grouped into execution waves. Each wave may begin only after every task in the prior waves is complete. Tasks within a wave can run in parallel.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"],
      "description": "Shared data model types; blocks all other work."
    },
    {
      "wave": 2,
      "tasks": ["2", "3"],
      "description": "Pure resolution library and store wiring; independent of each other."
    },
    {
      "wave": 3,
      "tasks": ["4", "5", "8"],
      "description": "Send-path integration (needs 2,3), Environment Manager UI (needs 3), and tests (needs 2,3.2)."
    },
    {
      "wave": 4,
      "tasks": ["6", "7"],
      "description": "Header wiring (needs 5) and token highlighting (needs 2,4)."
    },
    {
      "wave": 5,
      "tasks": ["9"],
      "description": "Full-feature verification after everything else."
    }
  ]
}
```

- Task 1 blocks everything (shared types).
- Tasks 2 and 3 can proceed in parallel after task 1.
- Task 4 needs both 2 and 3. Task 5 needs 3. Task 6 needs 5. Task 7 needs 2 and 4.
- Task 8 needs 2 (and 3.2 for the migration test). Task 9 is last.

## Tasks

- [ ] 1. Add data model types for variables and environments
  - In `src/types.ts`, add `Variable` and `EnvironmentModel` interfaces.
  - Extend `WorkspaceModel` with optional `environments?: EnvironmentModel[]` and `activeEnvironmentId?: string | null`.
  - _Requirements: 1.1, 2.1, 6.2_

- [ ] 2. Build the pure variable resolution library
  - [ ] 2.1 Create `src/lib/variables.ts` with `VariableScope`, `buildScope`, and `resolveString`.
    - Implement the `{{key}}` regex, single-pass replacement, env-over-global precedence, and skipping of disabled variables.
    - _Requirements: 2.4, 3.2, 4.1, 4.2_
  - [ ] 2.2 Implement `resolveRequest` returning a non-mutating resolved clone.
    - Resolve url, enabled params (key+value), enabled headers, json/text body, form-data (key+value), and urlencoded (key+value).
    - _Requirements: 4.1, 4.3, 4.4, 4.5_
  - [ ] 2.3 Implement `inspectTokens` for UI highlighting.
    - _Requirements: 5.1, 5.2_

- [ ] 3. Extend the store with environment and global-variable state
  - [ ] 3.1 Add `globalVariables` to `initialState` with a `loadGlobalVariables()` loader and a `createNewEnvironment` factory.
    - _Requirements: 3.1, 6.1, 6.3_
  - [ ] 3.2 Add migration in `loadWorkspaces()` to default `environments` to `[]` and `activeEnvironmentId` to `null`.
    - _Requirements: 6.2_
  - [ ] 3.3 Add actions `ADD_ENVIRONMENT`, `REMOVE_ENVIRONMENT`, `UPDATE_ENVIRONMENT`, `SET_ACTIVE_ENVIRONMENT`, `UPDATE_GLOBAL_VARIABLES` to the `Action` union and reducer.
    - Persist global variables to `localStorage['httphub_global_variables']` in the reducer (mirror settings handling).
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.5, 3.1, 6.1_

- [ ] 4. Apply resolution in the send path
  - In `RequestPanel.handleSend`, build the scope from global vars + active environment and call `resolveRequest`, then construct the proxy payload from the resolved copy instead of the raw request.
  - Verify the stored request is unchanged after sending.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Build the Environment Manager modal
  - [ ] 5.1 Create `src/components/EnvironmentManager.tsx` with an environment list (plus a "Globals" entry), add/rename/delete controls, and a variable table with enabled, key, value, and secret columns.
    - Mask secret values by default with a reveal toggle.
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.3_
  - [ ] 5.2 Create `src/components/EnvironmentSelector.tsx` dropdown for switching the active environment and opening the manager.
    - _Requirements: 1.4, 1.5_

- [ ] 6. Wire environment UI into the workspace header
  - Add the `EnvironmentSelector` and a manager-open control to `WorkspaceView.tsx` header.
  - Update `handleExport` to strip variables where `secret === true` before serializing.
  - _Requirements: 1.4, 1.6, 2.3, 3.3_

- [ ] 7. Add token highlighting in the request editor
  - Use `inspectTokens` to show resolved-value tooltips on the URL/value fields and color unresolved tokens, plus an "N unresolved" indicator near Send.
  - Update indicators reactively when the active environment changes.
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 8. Set up testing and cover the resolution layer
  - [ ] 8.1 Add Vitest to `package.json`, add a `test` script, and document it in `.kiro/steering/tech.md`.
    - _Requirements: 4.1_
  - [ ] 8.2 Write unit tests for `buildScope`, `resolveString`, `resolveRequest` (including non-mutation), `inspectTokens`, and the workspace migration default.
    - _Requirements: 2.4, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 6.2_

- [ ] 9. Verify the full feature
  - Run `npm run lint` and the new tests; manually confirm environment switching changes the target host, secrets are masked and excluded from exports, and pre-feature workspaces load cleanly.
  - _Requirements: 1.6, 4.5, 6.2_

## Notes

- The `/api/proxy` server contract is unchanged; all resolution happens client-side before the proxy call.
- Keep `KeyValueEditor` unchanged — the variable table is a dedicated component because it needs the secret column and masking.
- No recursive variable expansion in v1 (single-pass) to guarantee termination; revisit if nested variables are requested later.
- If Vitest setup (task 8.1) is deferred, tasks can still ship, but the resolution-layer correctness properties in the design should be manually exercised before merging.
