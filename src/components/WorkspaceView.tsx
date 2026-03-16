import React, { useContext } from 'react';
import { X } from 'lucide-react';
import { AppContext } from '../store';
import { WorkspaceModel } from '../types';
import TabGroupView from './TabGroupView';

export default function WorkspaceView({ workspace }: { workspace: WorkspaceModel }) {
  const { dispatch } = useContext(AppContext);

  return (
    <div className="flex-1 flex flex-col min-w-[300px] bg-bg-primary border-r border-border-primary last:border-r-0">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border-primary">
        <span className="font-semibold text-text-primary text-sm">{workspace.name}</span>
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => dispatch({ type: 'REMOVE_WORKSPACE', workspaceId: workspace.id })}
            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
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
              <div className={`${workspace.splitDirection === 'col' ? 'h-1 w-full' : 'w-1 h-full'} bg-border-primary cursor-resize hover:bg-accent-hover transition-colors`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
