# Technology Stack

## Frameworks & Libraries

- **React 19** with function components and hooks. No class components.
- **TypeScript** (~5.8, strict typing expected). Type definitions live in `src/types.ts`.
- **Vite 6** for bundling and dev serving (via middleware mode inside Express).
- **Express 4** (`server.ts`) — serves the app and exposes the `/api/proxy` endpoint.
- **Tailwind CSS 4** (`@tailwindcss/vite` plugin) for styling. Theme colors are CSS variables, not hard-coded Tailwind palette classes.
- **@monaco-editor/react** — read-only code viewer for response bodies with syntax highlighting.
- **@hello-pangea/dnd** — drag-and-drop for tabs and visual groups.
- **lucide-react** — icon set.
- **clsx** + **tailwind-merge** — conditional class composition (available; prefer for complex className logic).
- **@google/genai** — installed but currently UNUSED. Reserved for future AI features. Wire up via `GEMINI_API_KEY`.

## State Management

- Single `useReducer` in `src/store.tsx` with a typed `Action` union. No Redux, no Zustand.
- All mutations go through `dispatch`. Reducer cases return new immutable state (spread copies, never mutate).
- `UPDATE_REQUEST` and `UPDATE_TAB_GROUP` take an `updater` function for flexible nested updates.
- State shape: `{ workspaces: WorkspaceModel[], settings: SettingsModel }`.

## Persistence

- `localStorage` only. Keys: `httphub_workspaces` and `httphub_settings`.
- Workspaces auto-save on change (debounced 1s in `App.tsx`). Settings save synchronously in the reducer.
- There is no server-side database. Keep new persistent state in `localStorage` unless a feature explicitly needs a backend.

## The Proxy Server

- `POST /api/proxy` accepts `{ method, url, headers, body, bodyType }` and performs the actual `fetch` server-side to bypass CORS.
- Handles `form-data` (including base64-encoded file uploads rebuilt into a `FormData`/`Blob`), `x-www-form-urlencoded`, and raw JSON/text bodies.
- Captures `set-cookie` via `getSetCookie()` and returns response status, timing, size, headers, cookies, and body.
- Binary responses are returned base64-encoded; JSON/text are decoded to string.

## Common Commands

```bash
npm install        # install dependencies
npm run dev        # start Express + Vite on http://localhost:3000
npm run start      # same as dev (tsx server.ts)
npm run build      # vite build -> dist/
npm run preview    # preview built output
npm run lint       # tsc --noEmit (type check only)
npm run test       # vitest run (Vitest, single-run; jsdom + fast-check)
```

The test runner is **Vitest** (aligns with the Vite toolchain), with **fast-check** for property-based tests and `@testing-library/react` + `jsdom` for component tests. Tests run once (not watch mode) via `npm run test`. Config lives in `vite.config.ts` (`test` field); global setup is `src/test/setup.ts`.

## Environment Variables

- `GEMINI_API_KEY` — read in `vite.config.ts` and injected as `process.env.GEMINI_API_KEY`. Copy `.env.example` to `.env.local`.
- `DISABLE_HMR` — set to `true` to disable hot module reload.
- `NODE_ENV=production` — switches `server.ts` to serve static `dist/`.

## Conventions

- IDs are generated with `Math.random().toString(36).substring(7)`. Reuse this pattern for new entities (or centralize a helper if it becomes common).
- Keep the proxy as the single network egress point; don't add direct `fetch` calls to external URLs from the client.
- Prefer adding fields to existing models in `types.ts` over creating parallel data structures.
