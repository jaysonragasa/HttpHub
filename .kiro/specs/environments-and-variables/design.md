# Design Document

## Overview

Environments and Variables adds named sets of key/value pairs that resolve `{{token}}` references at request-send time. The feature extends the existing data model, reducer, and `RequestPanel` send logic without changing the `/api/proxy` server contract. Resolution is a pure, client-side transformation applied to a copy of the request immediately before the proxy call.

Two scopes exist:
- **Environment variables** — grouped into named environments, scoped per workspace, one active at a time.
- **Global variables** — application-level, always in scope, persisted separately.

Resolution order is environment (active, enabled) → global (enabled). Unknown tokens are left intact.

## Architecture

### Data flow

```
User edits variables ─► dispatch ─► reducer ─► state ─► localStorage
                                                  │
Send clicked ─► resolveRequest(request, scope) ──┘
                      │ (pure, non-mutating)
                      ▼
              resolved copy ─► POST /api/proxy
```

The stored `RequestModel` is never mutated by resolution. A resolved clone is built and sent.

### Scope assembly

At send time `RequestPanel` builds a `VariableScope` map by layering enabled variables:

```
scope = {}
for each enabled global variable:        scope[key] = value
for each enabled active-env variable:    scope[key] = value   // overrides global
```

Environment variables override globals because the layering applies them last.

## Components and Interfaces

### Type changes (`src/types.ts`)

```typescript
export interface Variable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
}

export interface EnvironmentModel {
  id: string;
  name: string;
  variables: Variable[];
}

// Extend WorkspaceModel
export interface WorkspaceModel {
  // ...existing fields...
  environments?: EnvironmentModel[];      // optional for backward compat
  activeEnvironmentId?: string | null;
}

// Extend the top-level app state (in store.tsx initialState)
// globalVariables: Variable[]
```

`Variable` intentionally mirrors `KV` but is a distinct type so variable-specific fields (`secret`) don't leak into the request KV editor.

### Resolution utility (`src/lib/variables.ts` — new file)

```typescript
export type VariableScope = Record<string, string>;

// Build the resolution map from global + active environment variables.
export function buildScope(
  globals: Variable[],
  activeEnv: EnvironmentModel | undefined
): VariableScope;

// Replace {{key}} tokens in a single string. Unknown/disabled keys left as-is.
export function resolveString(input: string, scope: VariableScope): string;

// Return a resolved deep copy of a request (url, params, headers, body, formData, urlencoded).
export function resolveRequest(req: RequestModel, scope: VariableScope): RequestModel;

// For UI highlighting: list tokens in a string and whether each resolves.
export function inspectTokens(
  input: string,
  scope: VariableScope
): { token: string; key: string; resolved: boolean; value?: string }[];
```

Token grammar: `{{` + key + `}}`, where key is trimmed and matched against the scope by exact key. Regex: `/\{\{\s*([^}\s][^}]*?)\s*\}\}/g`. Resolution is single-pass (no recursive variable-in-variable expansion in v1) to keep behavior predictable and avoid infinite loops.

### Store changes (`src/store.tsx`)

New actions added to the `Action` union:

| Action | Purpose |
| --- | --- |
| `ADD_ENVIRONMENT` | Create an environment in a workspace |
| `REMOVE_ENVIRONMENT` | Delete an environment |
| `UPDATE_ENVIRONMENT` | Rename / replace variables via updater |
| `SET_ACTIVE_ENVIRONMENT` | Set `activeEnvironmentId` on a workspace |
| `UPDATE_GLOBAL_VARIABLES` | Replace global variables via updater |

- `initialState` gains `globalVariables: loadGlobalVariables()`.
- `loadGlobalVariables()` reads `localStorage['httphub_global_variables']`, merges with `[]` default.
- `loadWorkspaces()` maps each workspace to ensure `environments ??= []` and `activeEnvironmentId ??= null` (migration per Requirement 6.2).
- Global variables persist in the reducer case (like settings). Environments persist via the existing debounced workspace auto-save in `App.tsx` (they live on the workspace).
- Add a factory `createNewEnvironment(name): EnvironmentModel`.

### UI components

**`EnvironmentManager.tsx` (new modal)** — opened from a new control in the workspace header (`WorkspaceView.tsx`).
- Left: list of environments + "Globals" pseudo-entry; add/rename/delete controls.
- Right: a variable table reusing the visual style of `KeyValueEditor`, with an extra "secret" toggle and masked value input for secrets.
- Driven entirely by `dispatch`.

**`EnvironmentSelector.tsx` (new)** — a compact dropdown in the workspace header showing the active environment, letting the user switch or open the manager. Lives next to the import/export buttons in `WorkspaceView.tsx`.

**`RequestPanel.tsx` changes** — in `handleSend`, before building the proxy payload:
```typescript
const ws = state.workspaces.find(w => w.id === workspaceId);
const activeEnv = ws?.environments?.find(e => e.id === ws.activeEnvironmentId);
const scope = buildScope(state.globalVariables, activeEnv);
const resolved = resolveRequest(request, scope);
// use `resolved` for url/headers/body construction instead of `request`
```
All existing send logic then operates on `resolved`. No change to the values stored in state.

**Token highlighting (Requirement 5)** — a lightweight overlay/title approach: render a `title` attribute on the URL input showing resolved preview, and color unresolved tokens. A full inline-highlight editor is out of scope for v1; the design favors a tooltip + a small "N unresolved" badge near the Send button to keep the change contained.

### Reusing `KeyValueEditor`

The variable table is similar but needs a `secret` column and masking, so it is implemented as a small dedicated table inside `EnvironmentManager` rather than overloading `KeyValueEditor`. This keeps `KeyValueEditor` focused on request KV pairs per the structure guidelines.

## Data Models

```
AppState
├── workspaces: WorkspaceModel[]
│   └── (each) environments: EnvironmentModel[]   // new
│       └── variables: Variable[]                  // new
│       activeEnvironmentId: string | null         // new
├── settings: SettingsModel
└── globalVariables: Variable[]                     // new, app-level
```

Persistence keys:
- `httphub_workspaces` — now includes `environments` and `activeEnvironmentId` (secrets stripped only on explicit export, not on autosave — autosave keeps secrets so they survive reload).
- `httphub_global_variables` — new key for global variables.

Export stripping: `WorkspaceView.handleExport` filters out variables where `secret === true` before serializing.

## Error Handling

- **Unknown token**: `resolveString` leaves the literal `{{token}}` in place; never throws.
- **Malformed token** (e.g. `{{ }}`): regex requires a non-empty key, so it is ignored and left literal.
- **Missing environment fields on load**: migration in `loadWorkspaces` defaults to empty arrays / null.
- **Corrupt `localStorage` JSON**: existing try/catch pattern returns defaults; `loadGlobalVariables` follows the same pattern.
- **Duplicate keys**: last-write in scope assembly wins (env over global); within one set, the later entry wins — documented behavior, no error.

## Testing Strategy

No test runner is configured today. Recommend setting up **Vitest** (aligns with Vite) and adding it to `package.json` + `tech.md`. Priority unit tests for the pure resolution layer (`src/lib/variables.ts`):

1. `resolveString` replaces known tokens, leaves unknown tokens literal.
2. `buildScope` applies env-over-global precedence and skips disabled variables.
3. `resolveRequest` resolves url, params (key+value), headers, json/text body, form-data, urlencoded, and does not mutate the input.
4. `inspectTokens` flags resolved vs unresolved correctly.
5. Migration: a pre-feature workspace object loads with empty `environments` and null `activeEnvironmentId`.

Manual verification: switch environments and confirm a request hits different hosts; confirm secrets are masked in the manager and absent from an exported JSON file; confirm `npm run lint` passes.

## Correctness Properties

These invariants must hold for any implementation and guide the unit tests.

### Property 1: Non-mutation
`resolveRequest(req, scope)` never mutates `req` or any nested array/object; it returns a deep-resolved clone. The stored request definition is identical before and after a send.

**Validates: Requirements 4.5**

### Property 2: Idempotent on literals
A string with no tokens is returned unchanged by `resolveString`.

**Validates: Requirements 4.2**

### Property 3: Unknown tokens preserved
For any token whose key is not an enabled in-scope variable, the literal `{{key}}` text is preserved in the output. Resolution never throws on unknown or malformed tokens.

**Validates: Requirements 4.2**

### Property 4: Precedence
When a key exists as both an enabled environment variable and an enabled global variable, `buildScope` resolves it to the environment value. Disabled variables never appear in the scope.

**Validates: Requirements 2.4, 3.2**

### Property 5: Single-pass termination
Resolution does not re-expand values produced by a previous substitution (no recursive expansion), guaranteeing termination regardless of variable contents.

**Validates: Requirements 4.1**

### Property 6: Coverage
Every user-facing request field that is sent to the proxy (url, enabled params, enabled headers, active body in all body types) is subject to resolution; disabled params/headers are excluded both from sending and from resolution.

**Validates: Requirements 4.1, 4.3, 4.4**

### Property 7: Migration safety
Loading a workspace persisted before this feature yields `environments = []` and `activeEnvironmentId = null` with no thrown error, and `loadGlobalVariables` returns `[]` on missing or corrupt storage.

**Validates: Requirements 6.2, 6.3**

### Property 8: Export safety
An exported workspace JSON contains no variable where `secret === true`.

**Validates: Requirements 1.6, 2.3, 3.3**
