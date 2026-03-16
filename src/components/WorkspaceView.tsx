import React, { useContext } from 'react';
import { X } from 'lucide-react';
import { AppContext } from '../store';
import { WorkspaceModel } from '../types';
import TabGroupView from './TabGroupView';

export default function WorkspaceView({ workspace }: { workspace: WorkspaceModel }) {
  const { dispatch } = useContext(AppContext);

  return (
    <div className="flex-1 flex flex-col min-w-[300px] bg-[#0f111a] border-r border-gray-800 last:border-r-0">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#141620] border-b border-gray-800">
        <span className="font-semibold text-gray-200 text-sm">{workspace.name}</span>
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => dispatch({ type: 'REMOVE_WORKSPACE', workspaceId: workspace.id })}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Close Workspace"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab Groups Split View */}
      <div className={`flex-1 flex ${workspace.splitDirection === 'col' ? 'flex-col' : 'flex-row'} overflow-hidden`}>
        {workspace.tabGroups.map((group, index) => (
          <React.Fragment key={group.id}>
            <TabGroupView workspaceId={workspace.id} group={group} splitDirection={workspace.splitDirection} />
            {index < workspace.tabGroups.length - 1 && (
              <div className={`${workspace.splitDirection === 'col' ? 'h-1 w-full' : 'w-1 h-full'} bg-gray-800 cursor-resize hover:bg-emerald-500 transition-colors`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
