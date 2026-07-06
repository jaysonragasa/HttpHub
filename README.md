# HttpHub

A browser-based HTTP client — a Postman alternative built for a fast, multi-pane workflow. Build and send HTTP requests, inspect responses, and organize work across split workspaces and tab groups, all without leaving a single screen.

## Features

- **Multi-pane layout** — split workspaces and tab groups side-by-side or stacked to view many requests at once.
- **Full request builder** — method, URL, query params, headers, and bodies (JSON, text, form-data with file uploads, x-www-form-urlencoded).
- **Rich response viewer** — Monaco-powered body view with syntax highlighting, plus headers, cookies, status, timing, and size.
- **Cookie chaining** — designate a "cookie parent" tab so new tabs automatically inherit its session cookies.
- **CORS-free requests** — all requests are proxied through a local Express server.
- **Tab organization** — drag-and-drop tabs into colored visual groups; horizontal or collapsible vertical tab bars.
- **Workspaces** — import/export as JSON, collapse to the top bar, and rename inline.
- **Theming** — Dark, Monako, Cyberpunk, and Light themes with adjustable editor font size.
- **Local-first** — all state persists to `localStorage`. No account or backend database.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` if you plan to use upcoming AI features.
3. Start the app:
   ```bash
   npm run dev
   ```
   The app serves at http://localhost:3000.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express + Vite dev server |
| `npm run build` | Build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Type-check with `tsc --noEmit` |

## Architecture

HttpHub is a React 19 + TypeScript + Vite single-page app served by an Express server. The server also exposes a `POST /api/proxy` endpoint that performs requests server-side to bypass browser CORS restrictions.

State is managed with a single `useReducer` store (`src/store.tsx`) and persisted to `localStorage`. The data model is hierarchical: Workspace → Tab Group → Request.

For deeper documentation, see the steering docs in `.kiro/steering/` (product, tech, and structure) and feature specs under `.kiro/specs/`.
