# Project Structure

## Root Layout

```
HttpHub/
├── server.ts            # Express server + /api/proxy endpoint + Vite middleware
├── index.html           # Vite entry HTML
├── vite.config.ts       # Vite + Tailwind + React config, env injection
├── tsconfig.json
├── package.json
├── .env.example         # Template for .env.local (GEMINI_API_KEY)
├── metadata.json
└── src/
    ├── main.tsx         # React root mount
    ├── App.tsx          # Top-level layout, theme application, workspace split view, auto-save
    ├── store.tsx        # Reducer, actions, factory functions, AppContext, persistence
    ├── types.ts         # All shared TypeScript interfaces/types
    ├── index.css        # Tailwind import + theme CSS variables + scrollbar styles
    └── components/
        ├── WorkspaceView.tsx    # One workspace: header, import/export, tab-group split layout
        ├── TabGroupView.tsx     # Tab bar (horizontal/vertical), visual groups, DnD, context menus
        ├── RequestPanel.tsx     # URL bar, method, params/headers/body/settings tabs, send logic
        ├── ResponsePanel.tsx    # Response body (Monaco)/headers/cookies, status/time/size meta
        ├── KeyValueEditor.tsx   # Reusable enabled/key/value table (params, headers, form data)
        └── SettingsModal.tsx    # Theme + font size settings
```

## Component Hierarchy

```
App
└── WorkspaceView (per workspace)
    └── TabGroupView (per tab group, split)
        └── RequestPanel (active tab)
            ├── KeyValueEditor (params / headers / form-data / urlencoded)
            └── ResponsePanel
```

## Data Model Hierarchy

```
WorkspaceModel
├── tabGroups: TabGroupModel[]
│   ├── tabs: RequestModel[]          # the requests
│   ├── visualGroups: VisualTabGroup[] # colored organizational groupings
│   └── activeTabId
└── splitDirection: 'row' | 'col'
```

See `src/types.ts` for the authoritative definitions.

## Where Things Go

- **New shared type** → `src/types.ts`.
- **New global state / action** → add to the `Action` union and `reducer` in `src/store.tsx`; add a factory function if it's a new entity.
- **New reusable UI control** → `src/components/`. Keep it presentational and driven by props + `dispatch`.
- **New request-building feature** (auth, scripts, etc.) → extend `RequestModel` and surface a sub-tab in `RequestPanel.tsx`.
- **New response view** → add a tab in `ResponsePanel.tsx`.
- **New theme** → add a `.theme-*` block in `src/index.css` and an option in `SettingsModal.tsx` + the `SettingsModel['theme']` union.
- **Server-side request handling** → `server.ts` (`/api/proxy`). Add new endpoints here if needed.

## Patterns to Follow

- Components read state via `useContext(AppContext)` and mutate via `dispatch`.
- Pass `workspaceId` / `groupId` / `tabId` down so dispatched actions can target the right slice.
- Use the `updater` callback form for `UPDATE_REQUEST` / `UPDATE_TAB_GROUP`.
- Style with theme CSS variables (`bg-bg-primary`, `text-text-primary`, `border-border-primary`, `accent-primary`, etc.) — never hard-code hex colors in components.
- Sync derived state carefully: `RequestPanel` keeps `url` and `params` in sync bidirectionally; follow that precedent for any new two-way bindings.
