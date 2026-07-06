# Requirements Document

## Introduction

HttpHub today supports only HTTP requests: each tab holds a `RequestModel` (method, URL, headers, body) sent through the Express `POST /api/proxy` endpoint. This feature adds **WebSocket support** as a second connection type that the user selects per tab. A WebSocket tab lets the user open a persistent connection to a `ws://` or `wss://` endpoint, send messages, and watch incoming messages stream in real time, then close the connection.

The connection type is a per-tab setting: an HTTP tab behaves exactly as today, while a WebSocket tab swaps the request/response UI for a connection bar (URL + connect/disconnect), a message composer, and a live message log. Connection type, WebSocket URL, and composed message draft persist with the tab in `localStorage` like other request data; the live connection and the message log are runtime-only and are not persisted.

Because browsers cannot attach custom headers to a native WebSocket handshake, the design phase will decide whether the WebSocket connection is opened directly from the browser or relayed through the Express server (mirroring the HTTP proxy). These requirements specify the observable behavior either approach must satisfy.

## Glossary

- **System**: The HttpHub web application (client plus its Express server).
- **Connection_Type**: A per-tab setting selecting how the tab operates, one of `http` or `websocket`.
- **WebSocket_Tab**: A tab whose Connection_Type is `websocket`.
- **HTTP_Tab**: A tab whose Connection_Type is `http`, behaving as the application does today.
- **WS_Endpoint**: The WebSocket URL (`ws://` or `wss://` scheme) the WebSocket_Tab connects to.
- **WS_Connection**: The live WebSocket connection associated with a WebSocket_Tab.
- **Connection_State**: The lifecycle state of a WS_Connection, one of `disconnected`, `connecting`, `connected`, or `closing`.
- **Message_Composer**: The input area in a WebSocket_Tab where the user types an outgoing message.
- **Outgoing_Message**: A message the user sends over the WS_Connection.
- **Incoming_Message**: A message received from the WS_Endpoint over the WS_Connection.
- **Message_Log**: The ordered, runtime-only list of sent and received messages and connection events shown in a WebSocket_Tab.
- **Connection_Bar**: The control area in a WebSocket_Tab containing the WS_Endpoint input and the connect/disconnect control.
- **Persistence_Store**: Browser `localStorage`, using the existing `httphub_workspaces` key for tab data.
- **Tab_Model**: The per-tab data structure (`RequestModel` in `src/types.ts`) extended by this feature.

## Requirements

### Requirement 1: Per-Tab Connection Type Selection

**User Story:** As an API tester, I want to choose whether a tab is an HTTP request or a WebSocket connection, so that I can work with both protocols without leaving HttpHub.

#### Acceptance Criteria

1. THE System SHALL provide a control in each tab that accepts exactly two Connection_Type values: `http` or `websocket`, and SHALL reject any other value.
2. WHEN a tab is created, THE System SHALL set its Connection_Type to `http`.
3. WHEN the user sets a tab's Connection_Type to `websocket`, THE System SHALL display the WebSocket_Tab interface consisting of the Connection_Bar, Message_Composer, and Message_Log for that tab, while preserving that tab's previously entered data.
4. WHEN the user sets a tab's Connection_Type to `http`, THE System SHALL display the HTTP_Tab request interface for that tab, while preserving that tab's previously entered data.
5. WHEN a tab's Connection_Type changes, THE System SHALL persist the updated Connection_Type for that tab to the Persistence_Store as part of the tab's Tab_Model.
6. WHEN the application loads a tab from the Persistence_Store, THE System SHALL restore that tab's Connection_Type to the persisted value, and IF no persisted Connection_Type exists for that tab, THEN THE System SHALL set its Connection_Type to `http`.
7. THE System SHALL display a Connection_Type indicator in each tab's label area that renders a distinct, visible marker for `websocket` tabs that differs from the marker shown for `http` tabs, such that an observer can identify each tab's Connection_Type from the tab label area alone.
8. IF a Connection_Type value other than `http` or `websocket` is supplied for a tab, THEN THE System SHALL reject the change, retain the tab's current Connection_Type, and present an error indication to the user.

### Requirement 2: Establishing a WebSocket Connection

**User Story:** As an API tester, I want to connect to a WebSocket endpoint, so that I can start exchanging messages with it.

#### Acceptance Criteria

1. THE System SHALL provide a WS_Endpoint input and a connect control in the Connection_Bar of a WebSocket_Tab.
2. WHEN the user activates the connect control AND the WS_Endpoint is a non-empty URL using the `ws://` or `wss://` scheme, THE System SHALL attempt to open a WS_Connection and set the Connection_State to `connecting`.
3. IF the user activates the connect control while the WS_Endpoint is empty or is not a valid URL using the `ws://` or `wss://` scheme, THEN THE System SHALL not attempt a connection, SHALL keep the Connection_State at `disconnected`, and SHALL present a validation error indication.
4. WHEN a WS_Connection opens successfully, THE System SHALL set the Connection_State to `connected` and record the successful connection in the Message_Log.
5. WHEN a connection attempt fails, THE System SHALL set the Connection_State to `disconnected` and record the failure in the Message_Log.
6. IF the Connection_State remains `connecting` for longer than 10 seconds, THEN THE System SHALL abort the attempt, set the Connection_State to `disconnected`, and record the timeout in the Message_Log.
7. THE System SHALL reflect the current Connection_State in the Connection_Bar.
8. WHILE the Connection_State is `connected`, THE System SHALL present the connect control as a disconnect control as defined in Requirement 4.

### Requirement 3: Sending and Receiving Messages

**User Story:** As an API tester, I want to send messages and see replies in real time, so that I can exercise a WebSocket API.

#### Acceptance Criteria

1. WHILE the Connection_State is `connected`, THE System SHALL allow the user to send an Outgoing_Message whose content is the text typed in the Message_Composer, up to a maximum of 100,000 characters.
2. WHEN the user sends an Outgoing_Message, THE System SHALL transmit it over the WS_Connection and append it to the Message_Log as an entry with direction `outgoing` within 200 milliseconds of the send action.
3. WHEN the user sends an Outgoing_Message, THE System SHALL clear the Message_Composer of all text after the Outgoing_Message has been appended to the Message_Log.
4. IF the user attempts to send an Outgoing_Message while the Message_Composer is empty or contains only whitespace characters, THEN THE System SHALL not transmit any Outgoing_Message and SHALL leave the Message_Log unchanged.
5. WHEN an Incoming_Message arrives over the WS_Connection, THE System SHALL append it to the Message_Log as an entry with direction `incoming` within 200 milliseconds of arrival.
6. THE System SHALL maintain Message_Log entries in ascending chronological order by the time each entry was appended.
7. THE System SHALL display for each Message_Log entry its direction (`outgoing`, `incoming`, or `system`) and a timestamp showing hours, minutes, and seconds.
8. WHILE the Connection_State is not `connected`, THE System SHALL prevent the user from sending an Outgoing_Message and SHALL leave the Message_Log unchanged.
9. IF transmission of an Outgoing_Message over the WS_Connection fails, THEN THE System SHALL append a `system` direction entry to the Message_Log indicating the send failure and SHALL retain the unsent text in the Message_Composer.

### Requirement 4: Closing a WebSocket Connection

**User Story:** As an API tester, I want to close a WebSocket connection, so that I can end the session cleanly.

#### Acceptance Criteria

1. WHILE the Connection_State is `connected` or `connecting`, THE System SHALL display a disconnect control.
2. WHEN the user activates the disconnect control WHILE the Connection_State is `connected`, THE System SHALL begin closing the WS_Connection and set the Connection_State to `closing`.
3. WHEN the WS_Connection finishes closing, THE System SHALL set the Connection_State to `disconnected` and release all resources associated with that WS_Connection so that no further messages are processed for it.
4. WHEN a tab, workspace, or the application containing an open WS_Connection is closed, THE System SHALL close that WS_Connection and release all resources associated with it so that no further messages are processed for it.
5. WHEN the user activates the disconnect control WHILE the Connection_State is `connecting`, THE System SHALL abort the pending connection attempt, set the Connection_State to `disconnected`, and release all resources associated with that WS_Connection.
6. IF the WS_Connection has not finished closing within 5 seconds of the Connection_State entering `closing`, THEN THE System SHALL force-terminate the WS_Connection, set the Connection_State to `disconnected`, release all associated resources, and record the forced closure in the Message_Log.
7. WHEN the WS_Endpoint closes the connection, THE System SHALL set the Connection_State to `disconnected`, release all resources associated with that WS_Connection, and record the closure together with the closure reason reported by the WS_Endpoint in the Message_Log.

### Requirement 5: Persistence and Runtime State Separation

**User Story:** As a returning user, I want my WebSocket tab configuration saved but not stale runtime data, so that I can reconnect without confusion.

#### Acceptance Criteria

1. WHEN a WebSocket_Tab's WS_Endpoint or Message_Composer draft changes, THE System SHALL write the WebSocket_Tab's Connection_Type, WS_Endpoint, and Message_Composer draft to the Persistence_Store within 1 second of the most recent change.
2. THE System SHALL NOT write the WS_Connection, Connection_State, or Message_Log to the Persistence_Store.
3. WHEN the application reloads, THE System SHALL render each restored WebSocket_Tab with its persisted WS_Endpoint and Message_Composer draft, a Connection_State equal to `disconnected`, and a Message_Log containing zero entries.
4. WHEN the application loads a persisted Tab_Model that has no Connection_Type field, THE System SHALL load it as an HTTP_Tab and SHALL render the remaining tabs and workspaces without interruption.
5. IF a persisted Tab_Model fails to parse or is missing required fields, THEN THE System SHALL substitute default field values for the affected tab, SHALL retain all successfully parsed tabs, and SHALL continue loading without surfacing an unhandled error.
