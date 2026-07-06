import React, { useContext, useRef, useState } from 'react';
import { X, Download, Upload, Minimize2 } from 'lucide-react';
import { AppContext } from '../store';
import { WorkspaceModel } from '../types';
import TabGroupView from './TabGroupView';

export default function WorkspaceView({ workspace }: { workspace: WorkspaceModel }) {
  const { dispatch } = useContext(AppContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const dataStr = JSON.stringify(workspace, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `workspace-${workspace.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data && data.tabGroups) {
          dispatch({ type: 'UPDATE_WORKSPACE_DATA', workspaceId: workspace.id, data });
        } else {
          alert('Invalid workspace file format.');
        }
      } catch (err) {
        alert('Failed to parse file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(workspace.name);

  const saveRename = () => {
    if (editingName.trim() && editingName !== workspace.name) {
      dispatch({ type: 'UPDATE_WORKSPACE_DATA', workspaceId: workspace.id, data: { name: editingName.trim() } });
    }
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col min-w-[300px] bg-bg-primary border-r border-border-primary last:border-r-0">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border-primary">
        {isEditing ? (
          <input
            autoFocus
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={e => e.key === 'Enter' && saveRename()}
            className="font-semibold text-sm bg-bg-tertiary text-text-primary px-1 py-0.5 rounded outline-none min-w-0"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span 
            className="font-semibold text-text-primary text-sm cursor-text hover:text-accent-primary transition-colors" 
            onDoubleClick={() => {
              setEditingName(workspace.name);
              setIsEditing(true);
            }}
            title="Double click to rename"
          >
            {workspace.name}
          </span>
        )}
        <div className="flex items-center space-x-1 shrink-0">
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
            title="Import Workspace"
          >
            <Upload size={14} />
          </button>
          <button 
            onClick={handleExport}
            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
            title="Export Workspace"
          >
            <Download size={14} />
          </button>
          <div className="w-px h-4 bg-border-primary mx-1"></div>
          <button 
            onClick={() => dispatch({ type: 'UPDATE_WORKSPACE_DATA', workspaceId: workspace.id, data: { isCollapsed: true } })}
            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
            title="Collapse Workspace"
          >
            <Minimize2 size={14} />
          </button>
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
