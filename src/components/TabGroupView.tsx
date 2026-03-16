import React, { useContext } from 'react';
import { Plus, X, SplitSquareHorizontal, SplitSquareVertical } from 'lucide-react';
import { AppContext } from '../store';
import { TabGroupModel } from '../types';
import RequestPanel from './RequestPanel';

export default function TabGroupView({ workspaceId, group, splitDirection }: { workspaceId: string, group: TabGroupModel, splitDirection: 'row'|'col' }) {
  const { dispatch } = useContext(AppContext);

  const activeTab = group.tabs.find(t => t.id === group.activeTabId);

  return (
    <div className="flex-1 flex flex-col min-w-[200px] min-h-[200px] bg-[#0f111a] overflow-hidden">
      {/* Tabs Header */}
      <div className="flex items-center bg-[#1a1d27] border-b border-gray-800 overflow-x-auto no-scrollbar">
        {group.tabs.map(tab => (
          <div 
            key={tab.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', workspaceId, groupId: group.id, tabId: tab.id })}
            className={`flex items-center space-x-2 px-3 py-2 border-r border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] group ${
              group.activeTabId === tab.id ? 'bg-[#0f111a] text-emerald-400 border-t-2 border-t-emerald-500' : 'text-gray-400 hover:bg-[#222634] border-t-2 border-t-transparent'
            }`}
          >
            <span className={`text-[10px] font-bold ${getMethodColor(tab.method)}`}>{tab.method}</span>
            <span className="text-xs truncate flex-1">{tab.name || 'Untitled Request'}</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'REMOVE_TAB', workspaceId, groupId: group.id, tabId: tab.id });
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex items-center px-2 space-x-1">
          <button 
            onClick={() => dispatch({ type: 'ADD_TAB', workspaceId, groupId: group.id })}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="New Tab"
          >
            <Plus size={14} />
          </button>
          <div className="w-px h-4 bg-gray-700 mx-1"></div>
          <button 
            onClick={() => dispatch({ type: 'ADD_TAB_GROUP', workspaceId, direction: 'row' })}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Split Right"
          >
            <SplitSquareHorizontal size={14} />
          </button>
          <button 
            onClick={() => dispatch({ type: 'ADD_TAB_GROUP', workspaceId, direction: 'col' })}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Split Down"
          >
            <SplitSquareVertical size={14} />
          </button>
          {/* Close Tab Group Button */}
          <button 
            onClick={() => dispatch({ type: 'REMOVE_TAB_GROUP', workspaceId, groupId: group.id })}
            className="p-1.5 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400"
            title="Close Split"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <RequestPanel workspaceId={workspaceId} groupId={group.id} request={activeTab} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            No active tab. Click + to create a new request.
          </div>
        )}
      </div>
    </div>
  );
}

function getMethodColor(method: string) {
  switch (method) {
    case 'GET': return 'text-green-400';
    case 'POST': return 'text-yellow-400';
    case 'PUT': return 'text-blue-400';
    case 'DELETE': return 'text-red-400';
    case 'PATCH': return 'text-purple-400';
    default: return 'text-gray-400';
  }
}
