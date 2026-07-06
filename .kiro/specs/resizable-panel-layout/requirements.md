# Requirements Document

## Introduction

This feature improves the request/response layout inside `RequestPanel.tsx`. Today the request config area (top) and the response area (bottom) are split as two `flex-1` regions, each with a fixed `min-h-[200px]` and separated by a static border, so the user cannot change how the available space is divided.

This feature adds three related capabilities:

1. A draggable divider (grip) between the request config region and the response region so the user can adjust the space allocated to each.
2. A redesigned response section tab bar (Body / Headers / Cookies) styled as a bottom tab bar.
3. A toggle that positions the response region either below the request config region (stacked) or to the right of it (side-by-side), with the divider orientation following the chosen layout.

The user's divider position and layout orientation are persisted so they survive reloads, and existing saved data without these fields loads without error through backward-compatible defaults. The design phase will decide the exact storage scope (per-request, per-tab-group, or global setting); these requirements specify the observable behavior and constraints that any chosen scope must satisfy.

## Glossary

- **Request_Config_Region**: The area inside `RequestPanel` that contains the URL bar's sub-tabs (Params / Headers / Body / Settings) and their content. Currently the top half.
- **Response_Region**: The area inside `RequestPanel` that renders `ResponsePanel` (response body, headers, cookies, and status/time/size metadata). Currently the bottom half.
- **Panel_Divider**: The draggable control (grip/handle) placed between the Request_Config_Region and the Response_Region that lets the user change the relative size of the two regions.
- **Layout_Orientation**: The arrangement of the two regions, either `stacked` (Response_Region below Request_Config_Region) or `side-by-side` (Response_Region to the right of Request_Config_Region).
- **Response_Tab_Bar**: The set of section tabs (Body / Headers / Cookies) inside `ResponsePanel`, to be styled as a bottom tab bar.
- **Layout_Toggle**: The control that switches the Layout_Orientation between `stacked` and `side-by-side`.
- **Split_Ratio**: The proportion of the combined region space allocated to the Request_Config_Region versus the Response_Region, controlled by the Panel_Divider. Expressed as a fraction between 0 and 1 representing the Request_Config_Region's share.
- **Layout_Preference**: The persisted combination of Layout_Orientation and Split_Ratio for a panel.
- **System**: The HttpHub web application.
- **Persistence_Store**: Browser `localStorage`, using existing keys `httphub_workspaces` (workspace/tab/request data) and `httphub_settings` (global settings).
- **Saved_State**: Previously persisted data in the Persistence_Store created before this feature existed and therefore lacking Layout_Preference fields.

## Requirements

### Requirement 1: Draggable Panel Divider

**User Story:** As a developer inspecting requests and responses, I want to drag a divider between the request config and response areas, so that I can give more space to whichever area I am focused on.

#### Acceptance Criteria

1. WHILE both the Request_Config_Region and the Response_Region are displayed in the same panel, THE System SHALL render a Panel_Divider between them, oriented according to the Layout_Orientation (a horizontal divider when stacked, a vertical divider when side-by-side), with a pointer hit target of at least 6 pixels along the divider axis.
2. WHEN no previously retained Split_Ratio exists for the panel, THE System SHALL initialize the Split_Ratio to allocate equal space (0.5) to the Request_Config_Region and the Response_Region.
3. WHEN the user presses the pointer down on the Panel_Divider and moves the pointer, THE System SHALL update the Split_Ratio on each pointer-move event so the boundary between the Request_Config_Region and the Response_Region follows the pointer position, clamped so that neither region falls below its minimum size.
4. WHILE the user is dragging the Panel_Divider, THE System SHALL resize the Request_Config_Region and the Response_Region on each pointer-move event so their combined size equals the available panel space minus the Panel_Divider thickness.
5. WHEN the user releases the pointer after dragging the Panel_Divider, THE System SHALL stop resizing and retain the most recent Split_Ratio.
6. THE System SHALL constrain the Split_Ratio so that the Request_Config_Region is at least 200 pixels along the divider axis.
7. THE System SHALL constrain the Split_Ratio so that the Response_Region is at least 200 pixels along the divider axis.
8. IF the available panel space along the divider axis is less than 400 pixels (the sum of both minimum sizes) plus the Panel_Divider thickness, THEN THE System SHALL hold the Request_Config_Region and the Response_Region each at their 200 pixel minimum and ignore further drag input that would reduce either region below its minimum.
9. WHEN the pointer hovers over the Panel_Divider, THE System SHALL display a resize cursor matching the divider axis (row-resize when stacked, col-resize when side-by-side).

### Requirement 2: Response Region Bottom Tab Bar Styling

**User Story:** As a developer reading responses, I want the response section tabs presented as a bottom tab bar, so that the response area reads as a distinct bottom panel.

#### Acceptance Criteria

1. THE System SHALL render the Response_Tab_Bar at the bottom edge of the Response_Region, below the response content area, containing exactly three tabs labeled Body, Headers, and Cookies in that left-to-right order.
2. WHILE a response is displayed, THE System SHALL display a count indicator next to the Headers tab showing the integer number of response headers, where the count is 0 when no headers are present.
3. WHILE a response is displayed, THE System SHALL display a count indicator next to the Cookies tab showing the integer number of response cookies, where the count is 0 when no cookies are present.
4. WHEN the user selects a tab in the Response_Tab_Bar, THE System SHALL display only the content for the selected tab and mark that tab as active by applying the theme accent color to it while rendering all unselected tabs in the theme secondary text color.
5. WHEN a response is first displayed, THE System SHALL select the Body tab as the active tab by default.
6. IF the Cookies tab is selected and the response contains zero cookies, THEN THE System SHALL display a message indicating that no cookies were received in the response.
7. THE System SHALL style the Response_Tab_Bar using theme CSS variables for background, text, border, and accent colors, and SHALL NOT use hard-coded color values.
8. WHILE the Response_Tab_Bar is shown, THE System SHALL display the response status code with status text, the response time in milliseconds, and the response size with a unit label (B, KB, or MB).

### Requirement 3: Layout Orientation Toggle

**User Story:** As a developer comparing a request and its response, I want to switch the response area between below and beside the request config, so that I can use whichever arrangement fits my screen and task.

#### Acceptance Criteria

1. THE System SHALL render a Layout_Toggle within the request panel that remains visible and operable, with its icon reflecting the action it will perform.
2. WHEN the user activates the Layout_Toggle while the Layout_Orientation is `stacked`, THE System SHALL change the Layout_Orientation to `side-by-side` within 500 milliseconds.
3. WHEN the user activates the Layout_Toggle while the Layout_Orientation is `side-by-side`, THE System SHALL change the Layout_Orientation to `stacked` within 500 milliseconds.
4. WHILE the Layout_Orientation is `stacked`, THE System SHALL position the Response_Region directly below the Request_Config_Region and orient the Panel_Divider horizontally.
5. WHILE the Layout_Orientation is `side-by-side`, THE System SHALL position the Response_Region directly to the right of the Request_Config_Region and orient the Panel_Divider vertically.
6. WHEN the Layout_Orientation changes, THE System SHALL keep the URL bar (including its current value) and the Send control visible and operable.
7. WHEN the Layout_Orientation changes, THE System SHALL preserve the currently displayed response content and the request's input data without re-sending the request or reloading the response.
8. WHEN no Layout_Orientation is stored for a panel, THE System SHALL use `stacked` as the initial Layout_Orientation.
9. THE System SHALL style the Layout_Toggle using theme CSS variables and a lucide-react icon consistent with the other controls rendered in the Request_Config_Region.

### Requirement 4: Persistence of Layout Preference

**User Story:** As a developer who customizes the panel layout, I want my divider position and orientation remembered, so that I do not have to readjust the layout after every reload.

#### Acceptance Criteria

1. WHEN the user changes the Layout_Orientation to one of the supported values (`stacked` or `side-by-side`), THE System SHALL store the updated Layout_Orientation in the Persistence_Store within 1 second of the change.
2. WHEN the user changes the Split_Ratio via the Panel_Divider, THE System SHALL store the updated Split_Ratio in the Persistence_Store within 1 second of the change.
3. WHEN the System reloads with a Layout_Preference present in the Persistence_Store and containing a Layout_Orientation equal to `stacked` or `side-by-side` and a valid Split_Ratio, THE System SHALL render the panel using the stored Layout_Orientation and Split_Ratio.
4. IF the System reloads and the Layout_Preference is absent, unparseable, or contains a Layout_Orientation or Split_Ratio outside the supported values, THEN THE System SHALL render the panel using a default Layout_Orientation of `stacked` and a default Split_Ratio of 0.5.
5. IF storing a Layout_Preference change to the Persistence_Store fails, THEN THE System SHALL retain the current in-memory Layout_Orientation and Split_Ratio so that the active layout is unchanged, AND THE System SHALL surface an indication that the layout preference could not be saved.
6. THE System SHALL persist Layout_Preference changes through the same `dispatch` and reducer flow used for existing state mutations.
7. THE System SHALL store Layout_Preference data within the existing Persistence_Store keys (`httphub_workspaces` or `httphub_settings`) without introducing a separate storage key.

### Requirement 5: Backward-Compatible Migration of Existing Data

**User Story:** As an existing user with saved workspaces, I want the app to keep working after this feature is added, so that my previously saved requests load without errors or data loss.

#### Acceptance Criteria

1. WHEN the System loads Saved_State that lacks a Layout_Orientation value, THE System SHALL apply a default Layout_Orientation of `stacked`.
2. WHEN the System loads Saved_State that lacks a Split_Ratio value, THE System SHALL apply a default Split_Ratio of 0.5, allocating 50% of the available space to the Request_Config_Region and 50% to the Response_Region.
3. WHEN the System loads Saved_State that lacks Layout_Preference fields, THE System SHALL load all other previously saved request, tab, and workspace data with every field value identical to its stored value.
4. IF the Persistence_Store contains a Layout_Orientation value outside the set {`stacked`, `side-by-side`}, THEN THE System SHALL apply the default Layout_Orientation of `stacked`.
5. IF the Persistence_Store contains a Split_Ratio value that is non-numeric, less than 0, or greater than 1, THEN THE System SHALL apply the default Split_Ratio of 0.5.
6. IF the Persistence_Store contains a Split_Ratio value within the range 0 to 1 inclusive that would violate the minimum size constraints in Requirement 1, THEN THE System SHALL clamp the Split_Ratio to the nearest value within the bounds defined by those minimum size constraints.
7. IF the Persistence_Store contains Saved_State that cannot be parsed, THEN THE System SHALL load with all Layout_Preference fields set to their default values (Layout_Orientation `stacked`, Split_Ratio 0.5) and continue without aborting the load operation.
