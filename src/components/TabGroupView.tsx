import React, { useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, X, SplitSquareHorizontal, SplitSquareVertical, MoreVertical, LayoutPanelLeft, LayoutPanelTop, Pin, PinOff, ChevronRight, ChevronLeft, FolderPlus } from 'lucide-react';
import { AppContext } from '../store';
import { TabGroupModel, RequestModel, VisualTabGroup } from '../types';
import RequestPanel from './RequestPanel';

export default function TabGroupView({ workspaceId, group, splitDirection }: { workspaceId: string, group: TabGroupModel, splitDirection: 'row'|'col' }) {
  const { dispatch } = useContext(AppContext);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuConfig, setMenuConfig] = useState<{ type: 'tab' | 'group', id: string, x: number, y: number } | null>(null);
  const [isHoveringVertical, setIsHoveringVertical] = useState(false);
  const [resizing, setResizing] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);

  const activeTab = group.tabs.find(t => t.id === group.activeTabId);
  const isVertical = group.tabMode === 'vertical';
  const isExpanded = isVertical && (group.isVerticalPinned || isHoveringVertical || resizing || menuConfig !== null || editingTabId !== null);
  const sidebarWidth = isExpanded ? group.verticalWidth : 48;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      const newWidth = Math.max(150, Math.min(600, e.clientX - (sidebarRef.current?.getBoundingClientRect().left || 0)));
      dispatch({ type: 'UPDATE_TAB_GROUP', workspaceId, groupId: group.id, updater: g => ({ ...g, verticalWidth: newWidth }) });
    };
    const handleMouseUp = () => setResizing(false);
    
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, dispatch, workspaceId, group.id]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setMenuConfig(null);
    };
    
    if (menuConfig) {
      document.addEventListener('click', handleGlobalClick);
    }
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [menuConfig]);

  const handleMenuClick = (e: React.MouseEvent, type: 'tab' | 'group', id: string) => {
    e.stopPropagation();
    if (menuConfig?.id === id && menuConfig?.type === type) {
      setMenuConfig(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 4;
    
    if (x + 192 > window.innerWidth) {
      x = window.innerWidth - 192 - 8;
    }
    if (y + 200 > window.innerHeight) {
      y = rect.top - 200 - 4;
    }
    
    setMenuConfig({ type, id, x, y });
  };

  const handleRename = (tab: RequestModel) => {
    setEditingTabId(tab.id);
    setEditingName(tab.customName || tab.name || 'Untitled Request');
    setMenuConfig(null);
  };

  const saveRename = (tabId: string) => {
    dispatch({ type: 'UPDATE_REQUEST', workspaceId, groupId: group.id, tabId, updater: r => ({ ...r, customName: editingName }) });
    setEditingTabId(null);
  };

  const createVisualGroup = (tabId: string) => {
    const newGroupId = Math.random().toString(36).substring(7);
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    dispatch({ 
      type: 'UPDATE_TAB_GROUP', 
      workspaceId, 
      groupId: group.id, 
      updater: g => ({
        ...g,
        visualGroups: [...g.visualGroups, { id: newGroupId, name: 'New Group', color, collapsed: false }]
      })
    });
    
    dispatch({ 
      type: 'UPDATE_REQUEST', 
      workspaceId, 
      groupId: group.id, 
      tabId, 
      updater: r => ({ ...r, visualGroupId: newGroupId }) 
    });
    setMenuConfig(null);
  };

  const assignToGroup = (tabId: string, vGroupId: string | undefined) => {
    dispatch({ 
      type: 'UPDATE_REQUEST', 
      workspaceId, 
      groupId: group.id, 
      tabId, 
      updater: r => ({ ...r, visualGroupId: vGroupId }) 
    });
    setMenuConfig(null);
  };

  const toggleGroupCollapse = (vGroupId: string) => {
    dispatch({ 
      type: 'UPDATE_TAB_GROUP', 
      workspaceId, 
      groupId: group.id, 
      updater: g => ({
        ...g,
        visualGroups: g.visualGroups.map(vg => vg.id === vGroupId ? { ...vg, collapsed: !vg.collapsed } : vg)
      })
    });
  };

  const renameGroup = (vGroupId: string, newName: string) => {
    dispatch({ 
      type: 'UPDATE_TAB_GROUP', 
      workspaceId, 
      groupId: group.id, 
      updater: g => ({
        ...g,
        visualGroups: g.visualGroups.map(vg => vg.id === vGroupId ? { ...vg, name: newName } : vg)
      })
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    if (type === 'group') {
      const sourceGroup = groupedTabs[source.index]?.group;
      if (!sourceGroup) return;
      
      const newGroupedTabs = Array.from(groupedTabs);
      const [removed] = newGroupedTabs.splice(source.index, 1);
      newGroupedTabs.splice(destination.index, 0, removed);
      
      const groupAfter = newGroupedTabs[destination.index + 1]?.group;
      
      const newGroups = Array.from(group.visualGroups);
      const sourceIdx = newGroups.findIndex(g => g.id === sourceGroup.id);
      if (sourceIdx === -1) return;
      
      newGroups.splice(sourceIdx, 1);
      
      let destIdx = newGroups.length;
      if (groupAfter) {
        destIdx = newGroups.findIndex(g => g.id === groupAfter.id);
        if (destIdx === -1) destIdx = newGroups.length;
      }
      
      newGroups.splice(destIdx, 0, sourceGroup);
      
      dispatch({
        type: 'UPDATE_TAB_GROUP',
        workspaceId,
        groupId: group.id,
        updater: g => ({ ...g, visualGroups: newGroups })
      });
      return;
    }

    if (type === 'tab') {
      const sourceGroupId = source.droppableId === 'ungrouped' ? undefined : source.droppableId.replace('group-', '');
      const destGroupId = destination.droppableId === 'ungrouped' ? undefined : destination.droppableId.replace('group-', '');
      
      const sourceTabs = sourceGroupId 
        ? group.tabs.filter(t => t.visualGroupId === sourceGroupId)
        : group.tabs.filter(t => !t.visualGroupId);
        
      const draggedTab = sourceTabs[source.index];
      if (!draggedTab) return;

      const newTabs = Array.from(group.tabs);
      const draggedTabIndex = newTabs.findIndex(t => t.id === draggedTab.id);
      newTabs.splice(draggedTabIndex, 1);
      
      const updatedTab = { ...draggedTab, visualGroupId: destGroupId };
      
      const destTabs = destGroupId
        ? newTabs.filter(t => t.visualGroupId === destGroupId)
        : newTabs.filter(t => !t.visualGroupId);
        
      if (destination.index === 0) {
        if (destTabs.length === 0) {
          newTabs.push(updatedTab);
        } else {
          const firstDestTabIndex = newTabs.findIndex(t => t.id === destTabs[0].id);
          newTabs.splice(firstDestTabIndex, 0, updatedTab);
        }
      } else {
        const prevTab = destTabs[destination.index - 1];
        if (prevTab) {
          const prevTabIndex = newTabs.findIndex(t => t.id === prevTab.id);
          newTabs.splice(prevTabIndex + 1, 0, updatedTab);
        } else {
          newTabs.push(updatedTab);
        }
      }
      
      dispatch({
        type: 'UPDATE_TAB_GROUP',
        workspaceId,
        groupId: group.id,
        updater: g => ({ ...g, tabs: newTabs })
      });
    }
  };

  // Group tabs
  const groupedTabs: { group?: VisualTabGroup, tabs: RequestModel[] }[] = [];
  const ungroupedTabs = group.tabs.filter(t => !t.visualGroupId);
  
  group.visualGroups.forEach(vg => {
    const tabsInGroup = group.tabs.filter(t => t.visualGroupId === vg.id);
    if (tabsInGroup.length > 0) {
      groupedTabs.push({ group: vg, tabs: tabsInGroup });
    }
  });
  
  if (ungroupedTabs.length > 0) {
    groupedTabs.push({ tabs: ungroupedTabs });
  }

  const renderTab = (tab: RequestModel, index: number, inGroup: boolean = false) => {
    const isActive = group.activeTabId === tab.id;
    const tabName = tab.customName || tab.name || 'Untitled Request';
    
    return (
      // @ts-ignore - key is a valid React prop
      <Draggable key={tab.id} draggableId={tab.id} index={index}>
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', workspaceId, groupId: group.id, tabId: tab.id })}
            className={`relative flex items-center space-x-2 py-2 cursor-pointer group/tab ${
              isVertical ? 'w-full border-b border-border-primary/50' : 'px-3 min-w-[120px] max-w-[200px] border-r border-border-primary h-full shrink-0'
            } ${
              isActive 
                ? (isVertical ? 'bg-bg-secondary text-accent-primary border-l-2 border-l-accent-primary' : 'bg-bg-primary text-accent-primary border-t-2 border-t-accent-primary') 
                : (isVertical ? 'text-text-secondary hover:bg-bg-tertiary border-l-2 border-l-transparent' : 'text-text-secondary hover:bg-bg-tertiary border-t-2 border-t-transparent')
            } ${inGroup && isVertical ? (isExpanded ? 'pl-6 pr-3' : 'px-0') : (isVertical ? 'px-3' : '')} ${snapshot.isDragging ? 'shadow-lg z-50 bg-bg-tertiary' : ''}`}
          >
            <span className={`text-[10px] font-bold ${getMethodColor(tab.method)} ${isVertical && !isExpanded ? 'w-full text-center' : 'w-8 text-center shrink-0'}`}>{tab.method}</span>
            
            {(!isVertical || isExpanded) && (
              <>
                {editingTabId === tab.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => saveRename(tab.id)}
                    onKeyDown={e => e.key === 'Enter' && saveRename(tab.id)}
                    className="flex-1 bg-bg-tertiary text-text-primary text-xs px-1 py-0.5 rounded outline-none w-full min-w-0"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-xs truncate flex-1" onDoubleClick={() => handleRename(tab)}>{tabName}</span>
                )}
                
                <div className="flex items-center opacity-0 group-hover/tab:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => handleMenuClick(e, 'tab', tab.id)}
                    className="p-0.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary mr-1"
                  >
                    <MoreVertical size={12} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'REMOVE_TAB', workspaceId, groupId: group.id, tabId: tab.id });
                    }}
                    className="p-0.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary"
                  >
                    <X size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  const renderTabBar = () => (
    <div 
      ref={sidebarRef}
      className={`flex ${isVertical ? 'flex-col h-full bg-bg-primary border-r border-border-primary relative transition-all duration-200 ease-in-out z-10' : 'items-center bg-bg-tertiary border-b border-border-primary overflow-x-auto no-scrollbar'}`}
      style={{ width: isVertical ? sidebarWidth : 'auto' }}
      onMouseEnter={() => isVertical && setIsHoveringVertical(true)}
      onMouseLeave={() => isVertical && setIsHoveringVertical(false)}
    >
      {/* Vertical Mode Header */}
      {isVertical && (
        <div className="flex items-center justify-between p-2 border-b border-border-primary h-10 shrink-0">
          {isExpanded && <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Requests</span>}
          <div className="flex items-center space-x-1 ml-auto">
            {isExpanded && (
              <button 
                onClick={() => dispatch({ type: 'UPDATE_TAB_GROUP', workspaceId, groupId: group.id, updater: g => ({ ...g, isVerticalPinned: !g.isVerticalPinned }) })}
                className={`p-1 rounded ${group.isVerticalPinned ? 'text-accent-primary bg-accent-primary/10' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'}`}
                title={group.isVerticalPinned ? "Unpin" : "Pin open"}
              >
                {group.isVerticalPinned ? <Pin size={14} /> : <PinOff size={14} />}
              </button>
            )}
            <button 
              onClick={() => dispatch({ type: 'ADD_TAB', workspaceId, groupId: group.id })}
              className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
              title="New Tab"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="groups" type="group" direction={isVertical ? 'vertical' : 'horizontal'}>
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`${isVertical ? 'flex-1 overflow-y-auto overflow-x-hidden' : 'flex items-center h-full'}`}
            >
              {groupedTabs.map((gt, i) => (
                // @ts-ignore - key is a valid React prop
                <Draggable key={gt.group?.id || 'ungrouped'} draggableId={gt.group?.id || 'ungrouped'} index={i} isDragDisabled={!gt.group}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`${isVertical ? 'flex flex-col w-full' : 'flex items-center h-full'}`}
                    >
                      {gt.group && (!isVertical || isExpanded) && (
                        <div {...provided.dragHandleProps} className={`group relative flex items-center px-2 py-1 ${isVertical ? 'mt-2 mb-1' : 'mx-1 border border-border-primary rounded-full bg-bg-secondary shrink-0'}`}>
                          <button onClick={() => gt.group && toggleGroupCollapse(gt.group.id)} className="flex items-center space-x-1 flex-1 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: gt.group.color }}></div>
                            <span className="text-[11px] font-medium text-text-primary truncate" style={{ color: gt.group.color }}>{gt.group.name}</span>
                          </button>
                          <button 
                            onClick={(e) => handleMenuClick(e, 'group', gt.group!.id)}
                            className="p-0.5 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary ml-1 opacity-0 hover:opacity-100 group-hover:opacity-100"
                          >
                            <MoreVertical size={12} />
                          </button>
                        </div>
                      )}
                      {gt.group && isVertical && !isExpanded && (
                        <div {...provided.dragHandleProps} className="flex justify-center py-2 cursor-grab">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gt.group.color }}></div>
                        </div>
                      )}
                      
                      <Droppable droppableId={gt.group ? `group-${gt.group.id}` : 'ungrouped'} type="tab" direction={isVertical ? 'vertical' : 'horizontal'}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`${isVertical ? 'flex flex-col w-full min-h-[4px]' : 'flex items-center h-full min-w-[4px]'} ${snapshot.isDraggingOver ? 'bg-bg-secondary/50' : ''}`}
                          >
                            {(!gt.group || !gt.group.collapsed) && gt.tabs.map((tab, index) => renderTab(tab, index, !!gt.group))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Resizer for Vertical Mode */}
      {isVertical && isExpanded && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-primary/50 z-20"
          onMouseDown={(e) => {
            e.preventDefault();
            setResizing(true);
            const startX = e.clientX;
            const startWidth = group.verticalWidth;
            
            const onMouseMove = (e: MouseEvent) => {
              const newWidth = Math.max(150, Math.min(400, startWidth + (e.clientX - startX)));
              dispatch({ type: 'UPDATE_TAB_GROUP', workspaceId, groupId: group.id, updater: g => ({ ...g, verticalWidth: newWidth }) });
            };
            
            const onMouseUp = () => {
              setResizing(false);
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          }}
        />
      )}

      {/* Horizontal Mode Toolbar */}
      {!isVertical && (
        <div className="flex items-center px-2 space-x-1 shrink-0 ml-auto border-l border-border-primary pl-2">
          <button 
            onClick={() => dispatch({ type: 'ADD_TAB', workspaceId, groupId: group.id })}
            className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary"
            title="New Tab"
          >
            <Plus size={14} />
          </button>
          <div className="w-px h-4 bg-border-primary mx-1"></div>
          <button 
            onClick={() => dispatch({ type: 'UPDATE_TAB_GROUP', workspaceId, groupId: group.id, updater: g => ({ ...g, tabMode: 'vertical' }) })}
            className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary"
            title="Vertical Tabs"
          >
            <LayoutPanelLeft size={14} />
          </button>
          <button 
            onClick={() => dispatch({ type: 'ADD_TAB_GROUP', workspaceId, direction: 'row' })}
            className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary"
            title="Split Right"
          >
            <SplitSquareHorizontal size={14} />
          </button>
          <button 
            onClick={() => dispatch({ type: 'ADD_TAB_GROUP', workspaceId, direction: 'col' })}
            className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary"
            title="Split Down"
          >
            <SplitSquareVertical size={14} />
          </button>
          <button 
            onClick={() => dispatch({ type: 'REMOVE_TAB_GROUP', workspaceId, groupId: group.id })}
            className="p-1.5 hover:bg-red-900/50 rounded text-text-secondary hover:text-red-400"
            title="Close Split"
          >
            <X size={14} />
          </button>
        </div>
      )}
      
      {/* Vertical Mode Bottom Toolbar */}
      {isVertical && (
        <div className="flex items-center justify-center p-2 border-t border-border-primary">
          <button 
            onClick={() => dispatch({ type: 'UPDATE_TAB_GROUP', workspaceId, groupId: group.id, updater: g => ({ ...g, tabMode: 'horizontal' }) })}
            className="p-1.5 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary w-full flex justify-center"
            title="Horizontal Tabs"
          >
            <LayoutPanelTop size={14} />
          </button>
        </div>
      )}
    </div>
  );

  const renderMenuPortal = () => {
    if (!menuConfig) return null;

    let content = null;

    if (menuConfig.type === 'tab') {
      const tab = group.tabs.find(t => t.id === menuConfig.id);
      if (!tab) return null;
      content = (
        <>
          <button onClick={() => handleRename(tab)} className="w-full text-left px-4 py-1.5 text-xs text-text-primary hover:bg-accent-hover hover:text-white">Rename</button>
          <div className="border-t border-border-primary my-1"></div>
          <div className="px-4 py-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Add to Group</div>
          <button onClick={() => createVisualGroup(tab.id)} className="w-full text-left px-4 py-1.5 text-xs text-text-primary hover:bg-accent-hover hover:text-white flex items-center">
            <Plus size={12} className="mr-2" /> New Group
          </button>
          {group.visualGroups.map(vg => (
            <button key={vg.id} onClick={() => assignToGroup(tab.id, vg.id)} className="w-full text-left px-4 py-1.5 text-xs text-text-primary hover:bg-accent-hover hover:text-white flex items-center">
              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: vg.color }}></div>
              {vg.name}
            </button>
          ))}
          {tab.visualGroupId && (
            <>
              <div className="border-t border-border-primary my-1"></div>
              <button onClick={() => assignToGroup(tab.id, undefined)} className="w-full text-left px-4 py-1.5 text-xs text-text-primary hover:bg-red-600 hover:text-white">Remove from Group</button>
            </>
          )}
        </>
      );
    } else if (menuConfig.type === 'group') {
      const vg = group.visualGroups.find(g => g.id === menuConfig.id);
      if (!vg) return null;
      content = (
        <>
          <button 
            onClick={() => {
              const newName = prompt('Enter new group name:', vg.name);
              if (newName) renameGroup(vg.id, newName);
              setMenuConfig(null);
            }} 
            className="w-full text-left px-4 py-1.5 text-xs text-text-primary hover:bg-accent-hover hover:text-white"
          >
            Rename Group
          </button>
          <div className="border-t border-border-primary my-1"></div>
          <button 
            onClick={() => {
              // Remove group from all tabs
              group.tabs.forEach(t => {
                if (t.visualGroupId === vg.id) {
                  assignToGroup(t.id, undefined);
                }
              });
              // Remove group
              dispatch({ 
                type: 'UPDATE_TAB_GROUP', 
                workspaceId, 
                groupId: group.id, 
                updater: g => ({ ...g, visualGroups: g.visualGroups.filter(v => v.id !== vg.id) }) 
              });
              setMenuConfig(null);
            }} 
            className="w-full text-left px-4 py-1.5 text-xs text-text-primary hover:bg-red-600 hover:text-white"
          >
            Delete Group
          </button>
        </>
      );
    }

    return createPortal(
      <div 
        className="fixed w-48 bg-bg-tertiary border border-border-primary rounded shadow-xl z-[9999] py-1" 
        style={{ top: menuConfig.y, left: menuConfig.x }}
        onClick={e => e.stopPropagation()}
      >
        {content}
      </div>,
      document.body
    );
  };

  return (
    <div className={`flex-1 flex ${isVertical ? 'flex-row' : 'flex-col'} min-w-[200px] min-h-[200px] bg-bg-primary overflow-hidden`}>
      {renderTabBar()}

      {/* Active Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-0">
        {activeTab ? (
          <RequestPanel workspaceId={workspaceId} groupId={group.id} request={activeTab} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
            No active tab. Click + to create a new request.
          </div>
        )}
      </div>
      {renderMenuPortal()}
    </div>
  );
}

function getMethodColor(method: string) {
  switch (method) {
    case 'GET': return 'text-green-500';
    case 'POST': return 'text-yellow-500';
    case 'PUT': return 'text-blue-500';
    case 'DELETE': return 'text-red-500';
    case 'PATCH': return 'text-purple-500';
    default: return 'text-text-secondary';
  }
}
