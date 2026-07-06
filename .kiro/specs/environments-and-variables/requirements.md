# Requirements Document

## Introduction

HttpHub currently has no way to reuse values across requests. URLs, tokens, and IDs must be retyped in every tab, and secrets are stored in plain text inside each request. This feature introduces **Environments and Variables**: named sets of key/value pairs that can be referenced anywhere in a request using `{{variable}}` syntax and resolved at send time.

This is the foundational feature that later capabilities (auth helpers, request chaining, scripting) will build on. Variables come in two scopes: **environment variables** (switchable named sets, e.g. "Local", "Staging", "Production") and **global variables** (always available regardless of selected environment). Secret variables are masked in the UI and excluded from workspace exports.

Variables resolve against the existing `{{...}}` token syntax across the URL, query params, headers, and all body types. Resolution happens in `RequestPanel` before the request is handed to `/api/proxy`, so the server contract is unchanged.

## Requirements

### Requirement 1: Manage environments

**User Story:** As an API tester, I want to create and switch between named environments, so that I can run the same requests against local, staging, and production targets without editing each request.

#### Acceptance Criteria

1. WHEN the user opens the environment manager THEN the system SHALL display all environments belonging to the active workspace.
2. WHEN the user creates a new environment with a name THEN the system SHALL add it to the active workspace and persist it to `localStorage`.
3. WHEN the user renames or deletes an environment THEN the system SHALL update the workspace state and persist the change.
4. WHEN the user selects an environment as active THEN the system SHALL store the active environment id on the workspace and use its variables for resolution.
5. WHEN no environment is selected THEN the system SHALL resolve only global variables and leave environment tokens unresolved.
6. WHEN a workspace is exported THEN the system SHALL include its environments except for variables marked secret.

### Requirement 2: Edit variables within an environment

**User Story:** As an API tester, I want to add key/value variables to an environment, so that I can reference them in requests.

#### Acceptance Criteria

1. WHEN the user adds a variable with a key and value THEN the system SHALL store it on the selected environment.
2. WHEN the user toggles a variable's enabled state THEN the system SHALL exclude disabled variables from resolution.
3. WHEN the user marks a variable as secret THEN the system SHALL mask its value in the UI by default and exclude it from exports.
4. IF two enabled variables in scope share the same key THEN the system SHALL resolve using the environment variable over the global variable.
5. WHEN the user edits a variable THEN the system SHALL persist the change to `localStorage`.

### Requirement 3: Manage global variables

**User Story:** As an API tester, I want global variables that are available in every environment, so that I can store values shared across all targets.

#### Acceptance Criteria

1. WHEN the user edits global variables THEN the system SHALL persist them at the application level (independent of any single environment).
2. WHEN resolving a token THEN the system SHALL check enabled environment variables first, then enabled global variables.
3. WHEN a global variable is marked secret THEN the system SHALL mask it and exclude it from workspace exports.

### Requirement 4: Resolve variables at send time

**User Story:** As an API tester, I want `{{variable}}` tokens replaced with their values when I send a request, so that I can parameterize URLs, headers, and bodies.

#### Acceptance Criteria

1. WHEN a request is sent THEN the system SHALL replace every `{{key}}` token in the URL, enabled query params, enabled headers, and the active body with the resolved variable value before calling the proxy.
2. WHEN a token references an unknown or disabled variable THEN the system SHALL leave the token text unchanged and SHALL NOT throw.
3. WHEN resolving form-data or urlencoded bodies THEN the system SHALL resolve tokens in both keys and values.
4. WHEN a token appears inside a JSON or text body THEN the system SHALL perform plain string substitution without parsing the body.
5. WHEN resolution completes THEN the system SHALL send only resolved values to `/api/proxy` and SHALL NOT mutate the stored request definition.

### Requirement 5: Surface variables in the editor

**User Story:** As an API tester, I want to see which tokens resolve and which don't, so that I can catch typos before sending.

#### Acceptance Criteria

1. WHEN the user hovers a `{{token}}` in a URL or value field THEN the system SHALL show the resolved value or an "unresolved" indicator.
2. WHEN a token is unresolved THEN the system SHALL visually distinguish it (e.g. color) from resolved tokens.
3. WHEN the active environment changes THEN the system SHALL update token indicators without requiring a reload.

### Requirement 6: Persistence and migration

**User Story:** As a returning user, I want my environments and variables to survive reloads, so that I don't lose configuration.

#### Acceptance Criteria

1. WHEN environments or global variables change THEN the system SHALL persist them to `localStorage`.
2. WHEN the app loads a workspace saved before this feature existed THEN the system SHALL default missing environment fields to empty collections without error.
3. WHEN global variables are loaded THEN the system SHALL merge them with defaults to tolerate missing keys.

## Glossary

- **Variable**: A named key/value pair (`{{key}}` → value) used in request substitution. May be enabled/disabled and optionally marked secret.
- **Environment**: A named, switchable collection of variables scoped to a workspace (e.g. "Local", "Staging", "Production"). One environment per workspace can be active at a time.
- **Global Variable**: A variable available in every environment, persisted at the application level independent of any single environment.
- **Active Environment**: The environment currently selected for a workspace; its variables take precedence over global variables during resolution.
- **Secret Variable**: A variable whose value is masked in the UI and excluded from workspace exports.
- **Token**: A `{{key}}` reference embedded in a request field that is replaced with its resolved value at send time.
- **Resolution**: The send-time process of replacing tokens with variable values against the assembled scope, without mutating the stored request.
- **Scope**: The merged map of enabled global and active-environment variables used to resolve tokens (environment overrides global).
- **Unresolved Token**: A token whose key matches no enabled in-scope variable; left as literal text.
