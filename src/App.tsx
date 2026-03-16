import React, { useReducer } from 'react';
import { Plus, LayoutGrid } from 'lucide-react';
import { reducer, initialState, AppContext } from './store';
import WorkspaceView from './components/WorkspaceView';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="flex flex-col h-screen bg-[#0f111a] text-gray-300 font-sans overflow-hidden">
        {/* Top Navigation */}
        <header className="flex items-center justify-between px-4 py-2 bg-[#1a1d27] border-b border-gray-800">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-lg">
              <LayoutGrid size={20} />
              <span>HttpHub</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => dispatch({ type: 'ADD_WORKSPACE' })}
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              <span>New Workspace</span>
            </button>
          </div>
        </header>

        {/* Workspaces Split View */}
        <main className="flex-1 flex overflow-hidden">
          {state.workspaces.map((ws, index) => (
            <React.Fragment key={ws.id}>
              <WorkspaceView workspace={ws} />
              {index < state.workspaces.length - 1 && (
                <div className="w-1 bg-gray-800 cursor-col-resize hover:bg-emerald-500 transition-colors" />
              )}
            </React.Fragment>
          ))}
          {state.workspaces.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              No workspaces open. Click "New Workspace" to start.
            </div>
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
}
