import React, { useReducer, useState } from 'react';
import { Plus, LayoutGrid, Settings, Maximize2 } from 'lucide-react';
import { reducer, initialState, AppContext } from './store';
import WorkspaceView from './components/WorkspaceView';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply theme and font size to the root element
  const themeClass = `theme-${state.settings.theme}`;
  
  // Auto-save workspaces when they change
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem('httphub_workspaces', JSON.stringify(state.workspaces));
      } catch (e) {
        console.error('Failed to auto-save workspaces', e);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [state.workspaces]);

  // Apply theme to body for portals (like context menus)
  React.useEffect(() => {
    document.body.className = themeClass;
  }, [themeClass]);

  const visibleWorkspaces = state.workspaces.filter(ws => !ws.isCollapsed);
  const collapsedWorkspaces = state.workspaces.filter(ws => ws.isCollapsed);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className={`w-full h-full ${themeClass}`}>
        <div 
          className="flex flex-col h-screen bg-bg-primary text-text-primary font-sans overflow-hidden"
          style={{ 
            '--editor-font-size': `${state.settings.fontSize}px`,
            // Explicitly map theme variables to ensure inheritance
            '--color-bg-primary': `var(--theme-bg-primary)`,
            '--color-bg-secondary': `var(--theme-bg-secondary)`,
            '--color-bg-tertiary': `var(--theme-bg-tertiary)`,
            '--color-border-primary': `var(--theme-border-primary)`,
            '--color-text-primary': `var(--theme-text-primary)`,
            '--color-text-secondary': `var(--theme-text-secondary)`,
            '--color-text-accent': `var(--theme-text-accent)`,
            '--color-accent-primary': `var(--theme-accent-primary)`,
            '--color-accent-hover': `var(--theme-accent-hover)`,
          } as React.CSSProperties}
        >
          {/* Top Navigation */}
          <header className="flex items-center justify-between px-4 py-2 bg-bg-tertiary border-b border-border-primary">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-text-accent font-bold text-lg shrink-0">
                <LayoutGrid size={20} />
                <span>HttpHub</span>
              </div>
              
              {collapsedWorkspaces.length > 0 && (
                <div className="flex items-center space-x-2 ml-4 border-l border-border-primary pl-4 overflow-x-auto no-scrollbar">
                  {collapsedWorkspaces.map(ws => (
                    <button
                      key={ws.id}
                      onClick={() => dispatch({ type: 'UPDATE_WORKSPACE_DATA', workspaceId: ws.id, data: { isCollapsed: false } })}
                      className="flex items-center space-x-1 px-2 py-1 bg-bg-secondary hover:bg-bg-primary border border-border-primary rounded text-xs text-text-secondary hover:text-text-primary transition-colors shrink-0"
                      title={`Restore ${ws.name}`}
                    >
                      <span className="truncate max-w-[100px]">{ws.name}</span>
                      <Maximize2 size={12} className="ml-1" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 shrink-0">

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary transition-colors"
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={() => dispatch({ type: 'ADD_WORKSPACE' })}
                className="flex items-center space-x-1 px-3 py-1.5 bg-accent-primary hover:bg-accent-hover text-white rounded-md text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                <span>New Workspace</span>
              </button>
            </div>
          </header>

          {/* Workspaces Split View */}
          <main className="flex-1 flex overflow-hidden">
            {visibleWorkspaces.map((ws, index) => (
              <React.Fragment key={ws.id}>
                <WorkspaceView workspace={ws} />
                {index < visibleWorkspaces.length - 1 && (
                  <div className="w-1 bg-border-primary cursor-col-resize hover:bg-accent-hover transition-colors" />
                )}
              </React.Fragment>
            ))}
            {visibleWorkspaces.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-text-secondary">
                No active workspaces open. Click "New Workspace" or restore a collapsed one from the top bar.
              </div>
            )}
          </main>
        </div>
        {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      </div>
    </AppContext.Provider>
  );
}
