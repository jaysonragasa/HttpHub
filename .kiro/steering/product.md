# Product Overview

HttpHub is a browser-based HTTP client — a Postman alternative focused on a fast, multi-pane workflow. Users build and send HTTP requests, inspect responses, and organize work across split workspaces and tab groups.

## Core Value

- **Multi-pane productivity**: Multiple workspaces and tab groups can be split side-by-side or stacked, so several requests are visible at once. This is the primary differentiator over Postman's single-request focus.
- **Cookie chaining**: A request can inherit cookies received by another request (e.g. log in once, reuse the session across tabs). One tab per workspace can be designated the "cookie parent" so new tabs auto-inherit.
- **CORS-free requests**: All requests are proxied through a local Express server, so the browser's CORS restrictions don't apply.
- **Local-first**: All state (workspaces, tabs, settings) persists to `localStorage`. No account or backend database required.

## Key Concepts

- **Workspace**: Top-level container with a name. Holds one or more tab groups. Can be collapsed to the top bar or split alongside other workspaces. Exportable/importable as JSON.
- **Tab Group**: A panel containing request tabs with its own active tab. Groups can be split horizontally or vertically within a workspace, and tabs can be shown as a horizontal bar or a collapsible vertical sidebar.
- **Visual Group**: A colored, named, collapsible grouping of tabs within a tab group (organizational only, drag-and-drop reorderable).
- **Request**: A single HTTP request (method, URL, params, headers, body) plus its last response.

## Target Users

Developers and QA engineers who test APIs and want to view and compare multiple requests/responses simultaneously without switching tabs.

## Product Principles

- Speed and visibility over feature bloat — keep multiple requests on screen.
- Local-first and zero-config — works immediately after `npm run dev`.
- Match familiar Postman terminology where it lowers the learning curve, but don't copy its single-pane limitations.
