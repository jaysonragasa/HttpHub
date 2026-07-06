# Implementation Plan: Resizable Panel Layout

## Overview

This plan implements a user-controlled, resizable request/response layout in `RequestPanel.tsx`, a redesigned bottom tab bar in `ResponsePanel.tsx`, and a Layout_Toggle for switching between stacked and side-by-side orientations. Layout_Preference (orientation + split ratio) is persisted globally on `SettingsModel` via the existing `UPDATE_SETTINGS` reducer flow, with a backward-compatible normalizer at load time.

The work proceeds bottom-up: first the test toolchain, then the type/state model and pure helpers (heavily property-tested), then the load/persistence wiring, then the two component changes, and finally integration. All code is TypeScript/React 19, styled with theme CSS variables only.

## Tasks

- [x] 1. Set up the test toolchain
  - [x] 1.1 Install and configure the Vitest test environment
    - Install and configure Vitest, fast-check, `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` as dev dependencies
    - Add a Vitest config (jsdom environment, globals) and a `"test": "vitest run"` script to `package.json`
    - Document the `npm run test` command in `.kiro/steering/tech.md`
    - Add a minimal smoke test to confirm the runner executes
    - _Requirements: (enables testing for all requirements)_

- [x] 2. Add layout types and settings fields
  - [x] 2.1 Extend the settings type model
    - Add `LayoutOrientation = 'stacked' | 'side-by-side'` to `src/types.ts`
    - Add `layoutOrientation: LayoutOrientation` and `splitRatio: number` to `SettingsModel`
    - _Requirements: 4.3, 1.2, 3.8_

- [x] 3. Implement pure layout helpers in `store.tsx`
  - [x] 3.1 Implement and export `LAYOUT_DEFAULTS`, `DIVIDER_THICKNESS`, `MIN_REGION_PX`, and `clampSplitRatio`
    - Clamp a candidate ratio to the `[minRatio, maxRatio]` window from the 200px minimums; return `0.5` when usable space `< 2 * MIN_REGION_PX`; handle non-finite and out-of-range inputs
    - _Requirements: 1.3, 1.6, 1.7, 1.8, 5.6_

  - [ ]* 3.2 Write property test for `clampSplitRatio`
    - **Property 1: Split ratio clamping keeps both regions within bounds**
    - **Validates: Requirements 1.3, 1.6, 1.7, 1.8, 5.6**

  - [x] 3.3 Implement and export `computeRegionSizes`
    - Return `{ configPx, responsePx }` from a ratio and axis size such that they sum to `axisSize - DIVIDER_THICKNESS`
    - _Requirements: 1.4_

  - [ ]* 3.4 Write property test for `computeRegionSizes`
    - **Property 2: Region sizes exactly partition the usable space**
    - **Validates: Requirements 1.4**

  - [x] 3.5 Implement and export `normalizeLayoutPreference`
    - Accept `unknown`; return a valid `layoutOrientation` and finite `splitRatio` in `[0,1]`, substituting `LAYOUT_DEFAULTS` for missing/invalid/wrong-typed fields
    - _Requirements: 1.2, 3.8, 4.4, 5.1, 5.2, 5.4, 5.5_

  - [ ]* 3.6 Write property test for `normalizeLayoutPreference`
    - **Property 3: Layout preference normalization yields valid values or defaults**
    - **Validates: Requirements 1.2, 3.8, 4.4, 5.1, 5.2, 5.4, 5.5**

  - [x] 3.7 Implement and export `formatSize`
    - Pure B/KB/MB formatter for non-negative byte counts
    - _Requirements: 2.8_

  - [ ]* 3.8 Write property test for `formatSize`
    - **Property 8: Size formatting selects the correct unit**
    - **Validates: Requirements 2.8**

- [x] 4. Wire layout preference into load and persistence
  - [x] 4.1 Normalize layout fields in `loadSettings`
    - Route the parsed settings object through `normalizeLayoutPreference` in addition to the existing default spread; ensure unparseable blobs fall back to defaults without throwing
    - _Requirements: 4.4, 5.1, 5.2, 5.4, 5.5, 5.7_

  - [x] 4.2 Persist layout changes through the `UPDATE_SETTINGS` reducer with error handling
    - Persist updated settings synchronously to `httphub_settings`; on `setItem` failure retain in-memory settings and set a transient non-persisted `settingsPersistError` flag; clear the flag on next successful save
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7_

  - [ ]* 4.3 Write property test for save/load round-trip
    - **Property 4: Valid layout preference survives a save/load round-trip**
    - **Validates: Requirements 4.3**

  - [ ]* 4.4 Write property test for immediate persistence via reducer
    - **Property 5: Layout changes are persisted immediately**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 4.5 Write property test for orientation change data preservation
    - **Property 10: Orientation change preserves request and response data**
    - **Validates: Requirements 3.7**

  - [ ]* 4.6 Write property test for workspace field preservation on load
    - **Property 11: Loading workspaces preserves all stored fields**
    - **Validates: Requirements 5.3**

  - [ ]* 4.7 Write property test for loader resilience to unparseable storage
    - **Property 12: Loaders are resilient to unparseable storage**
    - **Validates: Requirements 4.4, 5.7**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the resizable layout in `RequestPanel.tsx`
  - [x] 6.1 Render regions, divider, and orientation-aware flex container
    - Read `layoutOrientation` and `splitRatio` from `state.settings`; switch container between `flex-col`/`flex-row`; render Request_Config_Region and Response_Region with `flexBasis` from the ratio and `min-width/height: 200px` guards; render the Panel_Divider with `role="separator"`, correct `aria-orientation`, ≥6px hit target, and row/col resize cursor
    - _Requirements: 1.1, 1.9, 3.4, 3.5_

  - [ ]* 6.2 Write example tests for divider presence and orientation
    - Assert `role="separator"`, `aria-orientation`, cursor class, and `flex-col`/`flex-row` + divider axis per orientation
    - _Requirements: 1.1, 1.9, 3.4, 3.5_

  - [x] 6.3 Implement the pointer-drag interaction
    - Measure the container with a `ref` + `getBoundingClientRect()` and a `ResizeObserver`; hold live ratio in local state during drag; on each `pointermove` compute and `clampSplitRatio` the ratio; use `setPointerCapture`; on `pointerup` dispatch a single `UPDATE_SETTINGS` to commit; fall back to stored ratio before first measurement
    - _Requirements: 1.3, 1.4, 1.5, 1.8_

  - [ ]* 6.4 Write example test for the pointer lifecycle
    - Simulate pointerdown → move → up; assert dispatch occurs on release and the committed ratio is retained
    - _Requirements: 1.5_

  - [x] 6.5 Add the Layout_Toggle control
    - Render a theme-styled lucide-react toggle button near the URL/Send controls whose icon reflects the action; dispatch `UPDATE_SETTINGS` to flip orientation on click; render the `settingsPersistError` indicator (lucide `AlertTriangle` with tooltip) when set
    - _Requirements: 3.1, 3.2, 3.3, 3.9, 4.5_

  - [ ]* 6.6 Write property test for the orientation toggle
    - **Property 9: Orientation toggle is an involution**
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 6.7 Write example tests for toggle behavior and data preservation
    - Assert toggle icon reflects action (R3.1), URL value + Send remain visible/operable across toggle (R3.6), and the save-failure indicator appears when `setItem` throws (R4.5)
    - _Requirements: 3.1, 3.6, 4.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Redesign the Response_Tab_Bar in `ResponsePanel.tsx`
  - [x] 8.1 Move the tab bar to the bottom and render counts + metadata
    - Reorder DOM/flex so the tab bar sits below the content; keep Body/Headers/Cookies order; show Headers count = `Object.keys(response.headers).length` and Cookies count = `response.cookies?.length ?? 0`; render status+status text, time (ms), and size via `formatSize`; style with theme CSS variables only (no hard-coded colors); show empty-cookies message when Cookies selected with zero cookies; default to Body active
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 8.2 Write property test for tab count indicators
    - **Property 6: Tab count indicators equal their collection sizes**
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 8.3 Write property test for selected tab content and styling
    - **Property 7: Selected tab shows only its content with correct active styling**
    - **Validates: Requirements 2.4**

  - [ ]* 8.4 Write example tests for tab bar layout and metadata
    - Assert bottom position and Body/Headers/Cookies order (R2.1), Body active by default (R2.5), empty-cookies message (R2.6), and status/time/size metadata presence (R2.8)
    - _Requirements: 2.1, 2.5, 2.6, 2.8_

- [x] 9. Integration and verification
  - [x] 9.1 Wire and verify the end-to-end layout round-trip
    - Confirm `RequestPanel` and `ResponsePanel` are connected through the store; verify a render → drag → toggle → re-mount cycle restores the persisted layout from `localStorage`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 9.2 Write integration test for the store round-trip
    - Render `RequestPanel`, drag the divider, toggle orientation, re-mount reading from `localStorage`, and assert the restored layout matches
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 9.3 Add convention/smoke checks
    - Assert no hard-coded hex colors in modified components (R2.7, R3.9), only `httphub_settings`/`httphub_workspaces` keys are written (R4.7), and layout changes flow through `dispatch`/`UPDATE_SETTINGS` (R4.6)
    - _Requirements: 2.7, 3.9, 4.6, 4.7_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation.
- Property tests (Properties 1-12) validate universal correctness properties over generated inputs; example/component tests cover DOM structure, styling, and pointer-lifecycle wiring.
- All pure helpers live in `store.tsx` alongside the reducer and persistence functions (no separate module), matching the existing `loadSettings`/`loadWorkspaces` precedent.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["3.1", "3.3", "3.5", "3.7"] },
    { "id": 2, "tasks": ["3.2", "3.4", "3.6", "3.8", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "6.1", "8.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "8.2", "8.3", "8.4"] },
    { "id": 5, "tasks": ["6.4", "6.5"] },
    { "id": 6, "tasks": ["6.6", "6.7", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] }
  ]
}
```
