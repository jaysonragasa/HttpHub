import React, { createContext, Dispatch } from 'react';
import { WorkspaceModel, TabGroupModel, RequestModel, KV } from './types';

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
  inheritCookieFrom: '',
  isLoading: false,
});

export const createNewTabGroup = (): TabGroupModel => {
  const req = createNewRequest();
  return {
    id: Math.random().toString(36).substring(7),
    tabs: [req],
    activeTabId: req.id,
  };
};

export const createNewWorkspace = (name: string): WorkspaceModel => ({
  id: Math.random().toString(36).substring(7),
  name,
  tabGroups: [createNewTabGroup()],
  splitDirection: 'row',
});

export const initialState = {
  workspaces: [createNewWorkspace('Workspace 1')],
};

export type Action = 
  | { type: 'ADD_WORKSPACE' }
  | { type: 'REMOVE_WORKSPACE'; workspaceId: string }
  | { type: 'ADD_TAB_GROUP'; workspaceId: string; direction?: 'row' | 'col' }
  | { type: 'REMOVE_TAB_GROUP'; workspaceId: string; groupId: string }
  | { type: 'ADD_TAB'; workspaceId: string; groupId: string }
  | { type: 'REMOVE_TAB'; workspaceId: string; groupId: string; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; workspaceId: string; groupId: string; tabId: string }
  | { type: 'UPDATE_REQUEST'; workspaceId: string; groupId: string; tabId: string; updater: (req: RequestModel) => RequestModel };

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
            return {
              ...w,
              tabGroups: w.tabGroups.map(g => {
                if (g.id === action.groupId) {
                  const newReq = createNewRequest();
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
    default:
      return state;
  }
}

export const AppContext = createContext<{ state: typeof initialState, dispatch: Dispatch<Action> }>({ state: initialState, dispatch: () => {} });
