import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { hierarchy, tree } from 'd3-hierarchy';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronsUpDown, 
  ChevronsDownUp, 
  Maximize2, 
  Minimize2,
  FolderTree,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

export interface TreeNodeData {
  id: string;
  name: string;
  val?: number;
  color?: string;
  path: (string | number)[];
}

interface RawTreeNode {
  id: string;
  name: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  valueStr: string;
  fullValue: any;
  path: (string | number)[];
  childCount?: number;
  children?: RawTreeNode[];
  _allChildren?: RawTreeNode[];
  isCollapsed?: boolean;
}

const TYPE_CONFIG: Record<string, { color: string; label: string; textClass: string; bgClass: string }> = {
  object: { color: '#8b5cf6', label: 'Object', textClass: 'text-purple-400', bgClass: 'bg-purple-900/40 border-purple-500/30' },
  array: { color: '#3b82f6', label: 'Array', textClass: 'text-blue-400', bgClass: 'bg-blue-900/40 border-blue-500/30' },
  string: { color: '#10b981', label: 'String', textClass: 'text-emerald-400', bgClass: 'bg-emerald-900/40 border-emerald-500/30' },
  number: { color: '#f59e0b', label: 'Number', textClass: 'text-amber-400', bgClass: 'bg-amber-900/40 border-amber-500/30' },
  boolean: { color: '#ef4444', label: 'Boolean', textClass: 'text-rose-400', bgClass: 'bg-rose-900/40 border-rose-500/30' },
  null: { color: '#9ca3af', label: 'Null', textClass: 'text-gray-400', bgClass: 'bg-gray-800/40 border-gray-600/30' },
};

let counter = 0;

function buildRawTree(data: any, name = 'root', path: (string | number)[] = [], depth = 0, defaultExpandDepth = 2): RawTreeNode {
  const id = `node_${counter++}`;

  if (data === null) {
    return {
      id,
      name,
      type: 'null',
      valueStr: 'null',
      fullValue: null,
      path,
    };
  }

  if (Array.isArray(data)) {
    const allChildren = data.map((item, idx) =>
      buildRawTree(item, `[${idx}]`, [...path, idx], depth + 1, defaultExpandDepth)
    );
    const shouldCollapse = depth >= defaultExpandDepth && allChildren.length > 0;
    return {
      id,
      name,
      type: 'array',
      valueStr: `Array(${data.length})`,
      fullValue: data,
      path,
      childCount: data.length,
      _allChildren: allChildren,
      children: shouldCollapse ? undefined : allChildren,
      isCollapsed: shouldCollapse,
    };
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    const allChildren = keys.map(key =>
      buildRawTree(data[key], key, [...path, key], depth + 1, defaultExpandDepth)
    );
    const shouldCollapse = depth >= defaultExpandDepth && allChildren.length > 0;
    return {
      id,
      name,
      type: 'object',
      valueStr: `{${keys.length}}`,
      fullValue: data,
      path,
      childCount: keys.length,
      _allChildren: allChildren,
      children: shouldCollapse ? undefined : allChildren,
      isCollapsed: shouldCollapse,
    };
  }

  if (typeof data === 'string') {
    return {
      id,
      name,
      type: 'string',
      valueStr: `"${data.length > 25 ? data.substring(0, 25) + '...' : data}"`,
      fullValue: data,
      path,
    };
  }

  if (typeof data === 'number') {
    return {
      id,
      name,
      type: 'number',
      valueStr: String(data),
      fullValue: data,
      path,
    };
  }

  if (typeof data === 'boolean') {
    return {
      id,
      name,
      type: 'boolean',
      valueStr: String(data),
      fullValue: data,
      path,
    };
  }

  return {
    id,
    name,
    type: 'null',
    valueStr: String(data),
    fullValue: data,
    path,
  };
}

function cloneAndToggle(node: RawTreeNode, targetId: string): RawTreeNode {
  if (node.id === targetId && node._allChildren && node._allChildren.length > 0) {
    const willCollapse = !node.isCollapsed;
    return {
      ...node,
      isCollapsed: willCollapse,
      children: willCollapse ? undefined : node._allChildren,
    };
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map(c => cloneAndToggle(c, targetId)),
    };
  }
  return node;
}

function setAllCollapseState(node: RawTreeNode, collapse: boolean): RawTreeNode {
  const hasChildren = node._allChildren && node._allChildren.length > 0;
  if (!hasChildren) return node;

  const updatedChildren = node._allChildren!.map(child => setAllCollapseState(child, collapse));
  return {
    ...node,
    _allChildren: updatedChildren,
    isCollapsed: collapse,
    children: collapse ? undefined : updatedChildren,
  };
}

const CARD_WIDTH = 195;
const CARD_HEIGHT = 36;
const HORIZONTAL_GAP = 245;
const VERTICAL_GAP = 48;

export default function TreeGraphViewer({
  data,
  onNodeClick,
  isFullscreen,
  onToggleFullscreen,
}: {
  data: any;
  onNodeClick?: (node: TreeNodeData) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeData, setTreeData] = useState<RawTreeNode | null>(null);
  const [transform, setTransform] = useState({ x: 50, y: 250, k: 0.9 });
  const [hoveredNode, setHoveredNode] = useState<{ node: RawTreeNode; x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialTransformX: 0, initialTransformY: 0 });

  // Initialize tree
  useEffect(() => {
    counter = 0;
    const initialTree = buildRawTree(data, 'root', [], 0, 2);
    setTreeData(initialTree);
  }, [data]);

  // Compute D3 Tree Layout
  const { rootHierarchy, totalVisibleNodes, bounds } = useMemo(() => {
    if (!treeData) return { rootHierarchy: null, totalVisibleNodes: 0, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };

    const h = hierarchy(treeData, d => d.children);
    const treeLayout = tree<RawTreeNode>().nodeSize([VERTICAL_GAP, HORIZONTAL_GAP]);
    treeLayout(h);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    let count = 0;
    h.each(d => {
      count++;
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    });

    return {
      rootHierarchy: h,
      totalVisibleNodes: count,
      bounds: { minX, maxX, minY, maxY },
    };
  }, [treeData]);

  // Auto-center on initial mount or full data change
  const fitView = useCallback(() => {
    if (!containerRef.current || !rootHierarchy) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const widthSpan = bounds.maxY - bounds.minY + CARD_WIDTH + 80;
    const heightSpan = bounds.maxX - bounds.minX + CARD_HEIGHT + 80;

    const scaleX = clientWidth / widthSpan;
    const scaleY = clientHeight / heightSpan;
    const k = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.2);

    const x = 50;
    const y = clientHeight / 2 - ((bounds.minX + bounds.maxX) / 2) * k;

    setTransform({ x, y, k });
  }, [rootHierarchy, bounds]);

  useEffect(() => {
    if (treeData && containerRef.current) {
      fitView();
    }
  }, [treeData, fitView]);

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-node-btn')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialTransformX: transform.x,
      initialTransformY: transform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setTransform(prev => ({
      ...prev,
      x: dragStartRef.current.initialTransformX + dx,
      y: dragStartRef.current.initialTransformY + dy,
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setTransform(prev => {
      const newK = Math.max(0.15, Math.min(2.5, prev.k * zoomFactor));
      return {
        x: mouseX - (mouseX - prev.x) * (newK / prev.k),
        y: mouseY - (mouseY - prev.y) * (newK / prev.k),
        k: newK,
      };
    });
  };

  const zoomIn = () => {
    setTransform(prev => ({ ...prev, k: Math.min(2.5, prev.k * 1.25) }));
  };

  const zoomOut = () => {
    setTransform(prev => ({ ...prev, k: Math.max(0.15, prev.k / 1.25) }));
  };

  const handleExpandAll = () => {
    if (!treeData) return;
    setTreeData(setAllCollapseState(treeData, false));
  };

  const handleCollapseAll = () => {
    if (!treeData) return;
    setTreeData(setAllCollapseState(treeData, true));
  };

  const handleToggleNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!treeData) return;
    setTreeData(cloneAndToggle(treeData, nodeId));
  };

  const handleCardClick = (d: any) => {
    if (onNodeClick) {
      onNodeClick({
        id: d.data.id,
        name: d.data.name,
        color: TYPE_CONFIG[d.data.type]?.color || '#9ca3af',
        path: d.data.path,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className="w-full h-full bg-bg-primary overflow-hidden relative select-none cursor-grab active:cursor-grabbing font-sans"
    >
      {/* Floating Controls Bar */}
      <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 bg-bg-secondary/90 backdrop-blur-md border border-border-primary rounded-lg p-1 shadow-lg">
        <button
          onClick={zoomIn}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={zoomOut}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={fitView}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Reset View / Fit to Screen"
        >
          <RotateCcw size={15} />
        </button>

        <div className="h-4 w-px bg-border-primary mx-0.5" />

        <button
          onClick={handleExpandAll}
          className="flex items-center space-x-1 px-2 py-1 text-xs rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Expand All Nodes"
        >
          <ChevronsUpDown size={13} />
          <span>Expand All</span>
        </button>
        <button
          onClick={handleCollapseAll}
          className="flex items-center space-x-1 px-2 py-1 text-xs rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Collapse All Nodes"
        >
          <ChevronsDownUp size={13} />
          <span>Collapse All</span>
        </button>

        {onToggleFullscreen && (
          <>
            <div className="h-4 w-px bg-border-primary mx-0.5" />
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
              title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </>
        )}
      </div>

      {/* Legend & Stats Bottom Bar */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center space-x-3 bg-bg-secondary/90 backdrop-blur-md border border-border-primary rounded-lg px-3 py-1.5 text-xs text-text-secondary shadow-md">
        <div className="flex items-center space-x-1 font-mono">
          <FolderTree size={13} className="text-accent-primary" />
          <span>{totalVisibleNodes} visible nodes</span>
        </div>
        <div className="h-3 w-px bg-border-primary" />
        <div className="flex items-center space-x-2">
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <div key={type} className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas for Tree */}
      <svg className="w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="link-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4b5563" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6b7280" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
          className="pointer-events-auto"
        >
          {/* Connecting Curved Links */}
          {rootHierarchy &&
            rootHierarchy.links().map((link, idx) => {
              const startX = link.source.y + CARD_WIDTH;
              const startY = link.source.x;
              const endX = link.target.y;
              const endY = link.target.x;
              const midX = (startX + endX) / 2;
              const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

              return (
                <path
                  key={`link_${idx}`}
                  d={d}
                  fill="none"
                  stroke="url(#link-grad)"
                  strokeWidth={1.5}
                  className="transition-colors duration-200"
                />
              );
            })}

          {/* Tree Node Cards */}
          {rootHierarchy &&
            rootHierarchy.descendants().map(d => {
              const node = d.data;
              const config = TYPE_CONFIG[node.type] || TYPE_CONFIG.null;
              const isContainer = node.type === 'object' || node.type === 'array';
              const hasChildren = (node._allChildren?.length || 0) > 0;
              const posX = d.y;
              const posY = d.x - CARD_HEIGHT / 2;

              return (
                <g
                  key={node.id}
                  transform={`translate(${posX}, ${posY})`}
                  onClick={() => handleCardClick(d)}
                  onMouseEnter={() => setHoveredNode({ node, x: posX, y: posY })}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer group"
                >
                  {/* Card Container */}
                  <rect
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    rx={6}
                    ry={6}
                    className="fill-bg-secondary stroke-border-primary group-hover:stroke-accent-primary transition-all shadow-sm"
                    strokeWidth={1.2}
                  />

                  {/* Left Color Indicator Pill */}
                  <rect
                    x={0}
                    y={0}
                    width={4}
                    height={CARD_HEIGHT}
                    rx={2}
                    ry={2}
                    fill={config.color}
                  />

                  {/* Card Content (Key : Value) */}
                  <g transform="translate(10, 0)">
                    {/* Key Name */}
                    <text
                      x={0}
                      y={22}
                      className="fill-text-primary font-medium text-[12px] group-hover:fill-accent-hover transition-colors"
                      style={{ maxWidth: '80px' }}
                    >
                      {node.name.length > 12 ? node.name.substring(0, 11) + '…' : node.name}
                      <tspan className="fill-text-secondary font-normal">: </tspan>
                    </text>

                    {/* Value Preview */}
                    <text
                      x={75}
                      y={22}
                      fill={config.color}
                      className="font-mono text-[11px]"
                    >
                      {node.valueStr.length > 12 ? node.valueStr.substring(0, 11) + '…' : node.valueStr}
                    </text>
                  </g>

                  {/* Expand / Collapse Button on Container Nodes */}
                  {isContainer && hasChildren && (
                    <g
                      transform={`translate(${CARD_WIDTH - 28}, 7)`}
                      onClick={e => handleToggleNode(e, node.id)}
                      className="interactive-node-btn cursor-pointer"
                    >
                      <rect
                        width={22}
                        height={22}
                        rx={4}
                        ry={4}
                        className={`transition-colors ${
                          node.isCollapsed
                            ? 'fill-accent-primary/20 stroke-accent-primary'
                            : 'fill-bg-tertiary stroke-border-primary hover:fill-bg-primary'
                        }`}
                        strokeWidth={1}
                      />
                      {node.isCollapsed ? (
                        <text
                          x={11}
                          y={15}
                          textAnchor="middle"
                          className="fill-accent-primary font-bold text-[10px]"
                        >
                          +{node.childCount}
                        </text>
                      ) : (
                        <text
                          x={11}
                          y={15}
                          textAnchor="middle"
                          className="fill-text-secondary font-bold text-[12px]"
                        >
                          −
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      </svg>

      {/* Hover Info Tooltip */}
      {hoveredNode && (
        <div
          className="absolute z-30 pointer-events-none bg-bg-secondary/95 border border-border-primary rounded-md p-2.5 shadow-xl text-xs backdrop-blur-sm max-w-sm font-sans"
          style={{
            left: Math.min(
              window.innerWidth - 260,
              Math.max(10, hoveredNode.x * transform.k + transform.x + CARD_WIDTH + 10)
            ),
            top: Math.max(10, hoveredNode.y * transform.k + transform.y - 10),
          }}
        >
          <div className="flex items-center space-x-1.5 mb-1 text-[11px] font-mono text-text-secondary">
            <span>Path:</span>
            <span className="text-accent-primary font-semibold">
              ${hoveredNode.node.path.map(p => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('')}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-text-primary">
            <span className="font-semibold">{hoveredNode.node.name}:</span>
            <span className="font-mono text-emerald-400 break-all">
              {typeof hoveredNode.node.fullValue === 'object'
                ? hoveredNode.node.valueStr
                : JSON.stringify(hoveredNode.node.fullValue)}
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-border-primary text-[10px] text-text-secondary flex justify-between">
            <span className="capitalize">{hoveredNode.node.type}</span>
            <span className="text-accent-primary/80">Click to locate in editor</span>
          </div>
        </div>
      )}
    </div>
  );
}
