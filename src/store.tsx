import React, { createContext, Dispatch, useEffect, useReducer } from 'react';
import { WorkspaceModel, TabGroupModel, RequestModel, KV, SettingsModel, LayoutOrientation } from './types';

export const createNewRequest = (): RequestModel => ({
  id: Math.random().toString(36).substring(7),
  name: 'Untitled Request',
  method: 'GET',
  url: '',
  headers: [
    { id: Math.random().toString(36).substring(7), key: 'Cache-Control', value: 'no-cache', enabled: true },
    { id: Math.random().toString(36).substring(7), key: 'Postman-Token', value: '<calculated when request is sent>', enabled: true },
    { id: Math.random().toString(36).substring(7), key: 'Host', value: '<calculated when request is sent>', enabled: true },
    { id: Math.random().toString(36).substring(7), key: 'User-Agent', value: 'PostmanRuntime/7.51.1', enabled: true },
    { id: Math.random().toString(36).substring(7), key: 'Accept', value: '*/*', enabled: true },
    { id: Math.random().toString(36).substring(7), key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true },
    { id: Math.random().toString(36).substring(7), key: 'Connection', value: 'keep-alive', enabled: true },
    { id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true }
  ],
  params: [{ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true }],
  bodyType: 'none',
  body: '',
  formData: [{ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true, type: 'text' }],
  urlencoded: [{ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true }],
  inheritCookieFrom: '',
  isLoading: false,
});

export const createNewTabGroup = (): TabGroupModel => {
  const req = createNewRequest();
  return {
    id: Math.random().toString(36).substring(7),
    tabs: [req],
    activeTabId: req.id,
    visualGroups: [],
    tabMode: 'horizontal',
    isVerticalExpanded: false,
    isVerticalPinned: false,
    verticalWidth: 250,
  };
};

export const createNewWorkspace = (name: string): WorkspaceModel => ({
  id: Math.random().toString(36).substring(7),
  name,
  tabGroups: [createNewTabGroup()],
  splitDirection: 'row',
});

export const defaultSettings: SettingsModel = {
  fontSize: 14,
  theme: 'dark',
  layoutOrientation: 'stacked',
  splitRatio: 0.5,
};

// ----- Layout helpers -------------------------------------------------------
// Pure layout logic lives here alongside the reducer and persistence helpers,
// matching the existing loadSettings/loadWorkspaces precedent.

export const LAYOUT_DEFAULTS = {
  layoutOrientation: 'stacked' as LayoutOrientation,
  splitRatio: 0.5,
};
export const DIVIDER_THICKNESS = 6; // px
export const MIN_REGION_PX = 200; // px

/**
 * Clamp a candidate split ratio to the [minRatio, maxRatio] window implied by
 * the 200px minimums for each region.
 *
 * - usable = axisSize - thickness
 * - minRatio = MIN_REGION_PX / usable; maxRatio = 1 - (MIN_REGION_PX / usable)
 * - When usable < 2 * MIN_REGION_PX the bounds cross and neither region can be
 *   honored, so we return 0.5 (the view layer pins both regions at 200px).
 * - Non-finite inputs (NaN, ±Infinity) and out-of-range inputs are clamped to
 *   the nearest in-bounds value.
 */
export function clampSplitRatio(
  ratio: number,
  axisSize: number,
  thickness: number = DIVIDER_THICKNESS
): number {
  const usable = axisSize - thickness;

  // Not enough usable space to honor both 200px minimums: pin at 0.5.
  if (!Number.isFinite(usable) || usable < 2 * MIN_REGION_PX) {
    return 0.5;
  }

  const minRatio = MIN_REGION_PX / usable;
  const maxRatio = 1 - minRatio;

  // Non-finite candidate ratio: fall back to the centered default, then clamp
  // it into the (already valid) window.
  const candidate = Number.isFinite(ratio) ? ratio : 0.5;

  if (candidate < minRatio) return minRatio;
  if (candidate > maxRatio) return maxRatio;
  return candidate;
}

/**
 * Compute the pixel size of each region from a (clamped) ratio and axis size.
 *
 * To guarantee the two regions exactly partition the usable space with no
 * floating-point drift, configPx is computed as `usable * ratio` and responsePx
 * as `usable - configPx`, so `configPx + responsePx === axisSize - thickness`
 * holds exactly for all inputs.
 */
export function computeRegionSizes(
  ratio: number,
  axisSize: number,
  thickness: number = DIVIDER_THICKNESS
): { configPx: number; responsePx: number } {
  const usable = axisSize - thickness;
  const configPx = usable * ratio;
  const responsePx = usable - configPx;
  return { configPx, responsePx };
}

/**
 * Validate/normalize a possibly-corrupt persisted preference into safe values.
 *
 * Accepts `unknown` (null, undefined, primitives, or arbitrary objects) and
 * never throws. Falls back to LAYOUT_DEFAULTS for missing, wrong-typed,
 * out-of-range, non-finite, or unknown-orientation fields:
 * - layoutOrientation not in {'stacked', 'side-by-side'} -> 'stacked'
 * - splitRatio non-numeric, non-finite, < 0, or > 1 -> 0.5
 */
export function normalizeLayoutPreference(
  raw: unknown
): { layoutOrientation: LayoutOrientation; splitRatio: number } {
  const source =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const orientation = source.layoutOrientation;
  const layoutOrientation: LayoutOrientation =
    orientation === 'stacked' || orientation === 'side-by-side'
      ? orientation
      : LAYOUT_DEFAULTS.layoutOrientation;

  const ratio = source.splitRatio;
  const splitRatio =
    typeof ratio === 'number' &&
    Number.isFinite(ratio) &&
    ratio >= 0 &&
    ratio <= 1
      ? ratio
      : LAYOUT_DEFAULTS.splitRatio;

  return { layoutOrientation, splitRatio };
}

/**
 * Format a non-negative byte count into a human-readable size string with a
 * unit label.
 *
 * - bytes < 1024            -> `${bytes} B`
 * - bytes < 1024^2          -> `${(bytes / 1024).toFixed(2)} KB`
 * - bytes >= 1024^2         -> `${(bytes / (1024 * 1024)).toFixed(2)} MB`
 *
 * The numeric portion is always a parseable number; multiplying it back by its
 * unit factor recovers the original byte count within display rounding.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const loadSettings = (): SettingsModel => {
  try {
    const saved = localStorage.getItem('httphub_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = { ...defaultSettings, ...parsed };
      const { layoutOrientation, splitRatio } = normalizeLayoutPreference(parsed);
      return { ...merged, layoutOrientation, splitRatio };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return defaultSettings;
};

const loadWorkspaces = (): WorkspaceModel[] => {
  try {
    const saved = localStorage.getItem('httphub_workspaces');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load workspaces', e);
  }
  return [createNewWorkspace('Workspace 1')];
};

export const initialState = {
  workspaces: loadWorkspaces(),
  settings: loadSettings(),
  // Transient, non-persisted flag: set when a settings save to localStorage
  // fails so the UI can surface a non-blocking indicator. Never written to
  // localStorage; cleared on the next successful save.
  settingsPersistError: false,
};

export type Action = 
  | { type: 'ADD_WORKSPACE' }
  | { type: 'REMOVE_WORKSPACE'; workspaceId: string }
  | { type: 'ADD_TAB_GROUP'; workspaceId: string; direction?: 'row' | 'col' }
  | { type: 'REMOVE_TAB_GROUP'; workspaceId: string; groupId: string }
  | { type: 'ADD_TAB'; workspaceId: string; groupId: string }
  | { type: 'REMOVE_TAB'; workspaceId: string; groupId: string; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; workspaceId: string; groupId: string; tabId: string }
  | { type: 'UPDATE_REQUEST'; workspaceId: string; groupId: string; tabId: string; updater: (req: RequestModel) => RequestModel }
  | { type: 'UPDATE_TAB_GROUP'; workspaceId: string; groupId: string; updater: (group: TabGroupModel) => TabGroupModel }
  | { type: 'UPDATE_SETTINGS'; updater: (settings: SettingsModel) => SettingsModel }
  | { type: 'SET_COOKIE_PARENT'; workspaceId: string; tabId: string | null }
  | { type: 'UPDATE_WORKSPACE_DATA'; workspaceId: string; data: Partial<WorkspaceModel> };

export function reducer(state: typeof initialState, action: Action): typeof initialState {
  switch (action.type) {
    case 'ADD_WORKSPACE':
      return { ...state, workspaces: [...state.workspaces, createNewWorkspace(`Workspace ${state.workspaces.length + 1}`)] };
    case 'REMOVE_WORKSPACE':
      return { ...state, workspaces: state.workspaces.filter(w => w.id !== action.workspaceId) };
    case 'ADD_TAB_GROUP': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return { ...w, tabGroups: [...w.tabGroups, createNewTabGroup()], splitDirection: action.direction || w.splitDirection };
          }
          return w;
        })
      };
    }
    case 'REMOVE_TAB_GROUP': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return { ...w, tabGroups: w.tabGroups.filter(g => g.id !== action.groupId) };
          }
          return w;
        })
      };
    }
    case 'ADD_TAB': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            const parentTab = w.tabGroups.flatMap(g => g.tabs).find(t => t.isCookieParent);
            return {
              ...w,
              tabGroups: w.tabGroups.map(g => {
                if (g.id === action.groupId) {
                  const newReq = createNewRequest();
                  if (parentTab) {
                    newReq.inheritCookieFrom = parentTab.id;
                  }
                  return { ...g, tabs: [...g.tabs, newReq], activeTabId: newReq.id };
                }
                return g;
              })
            };
          }
          return w;
        })
      };
    }
    case 'REMOVE_TAB': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return {
              ...w,
              tabGroups: w.tabGroups.map(g => {
                if (g.id === action.groupId) {
                  const newTabs = g.tabs.filter(t => t.id !== action.tabId);
                  return { ...g, tabs: newTabs, activeTabId: g.activeTabId === action.tabId ? (newTabs[0]?.id || null) : g.activeTabId };
                }
                return g;
              })
            };
          }
          return w;
        })
      };
    }
    case 'SET_ACTIVE_TAB': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return {
              ...w,
              tabGroups: w.tabGroups.map(g => {
                if (g.id === action.groupId) {
                  return { ...g, activeTabId: action.tabId };
                }
                return g;
              })
            };
          }
          return w;
        })
      };
    }
    case 'UPDATE_REQUEST': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return {
              ...w,
              tabGroups: w.tabGroups.map(g => {
                if (g.id === action.groupId) {
                  return {
                    ...g,
                    tabs: g.tabs.map(t => {
                      if (t.id === action.tabId) {
                        return action.updater(t);
                      }
                      return t;
                    })
                  };
                }
                return g;
              })
            };
          }
          return w;
        })
      };
    }
    case 'UPDATE_TAB_GROUP': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return {
              ...w,
              tabGroups: w.tabGroups.map(g => {
                if (g.id === action.groupId) {
                  return action.updater(g);
                }
                return g;
              })
            };
          }
          return w;
        })
      };
    }
    case 'UPDATE_SETTINGS': {
      const newSettings = action.updater(state.settings);
      try {
        localStorage.setItem('httphub_settings', JSON.stringify(newSettings));
        // Successful save: clear any prior persist-error flag (R4.5 last clause).
        return { ...state, settings: newSettings, settingsPersistError: false };
      } catch (e) {
        console.error('Failed to save settings', e);
        // Persist failed: retain the new in-memory settings so the active layout
        // is unchanged (R4.5 first clause) and surface the error (R4.5 second clause).
        return { ...state, settings: newSettings, settingsPersistError: true };
      }
    }
    case 'SET_COOKIE_PARENT': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return {
              ...w,
              tabGroups: w.tabGroups.map(g => ({
                ...g,
                tabs: g.tabs.map(t => ({
                  ...t,
                  isCookieParent: t.id === action.tabId
                }))
              }))
            };
          }
          return w;
        })
      };
    }
    case 'UPDATE_WORKSPACE_DATA': {
      return {
        ...state,
        workspaces: state.workspaces.map(w => {
          if (w.id === action.workspaceId) {
            return { ...w, ...action.data, id: w.id };
          }
          return w;
        })
      };
    }
    default:
      return state;
  }
}

export const AppContext = createContext<{ state: typeof initialState, dispatch: Dispatch<Action> }>({ state: initialState, dispatch: () => {} });
