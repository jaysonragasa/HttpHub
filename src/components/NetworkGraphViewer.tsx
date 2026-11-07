import React, { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Network } from 'lucide-react';

export interface NodeData {
  id: string;
  name: string;
  val: number;
  color: string;
  path: (string | number)[];
}

interface LinkData {
  source: string;
  target: string;
  name: string;
}

interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

const COLORS: Record<string, string> = {
  object: '#8b5cf6', // purple
  array: '#3b82f6', // blue
  string: '#10b981', // green
  number: '#f59e0b', // orange
  boolean: '#ef4444', // red
  null: '#6b7280', // gray
};

function jsonToGraph(json: any): GraphData {
  const nodes: NodeData[] = [];
  const links: LinkData[] = [];
  let idCounter = 0;

  function traverse(obj: any, parentId: string | null = null, linkLabel: string = '', path: (string | number)[] = []) {
    const currentId = `node_${idCounter++}`;
    
    let label = '';
    let color = COLORS.null;
    let size = 1;

    if (Array.isArray(obj)) {
      label = 'Array';
      color = COLORS.array;
      size = 3;
    } else if (obj !== null && typeof obj === 'object') {
      label = 'Object';
      color = COLORS.object;
      size = 3;
    } else if (typeof obj === 'string') {
      label = `"${obj.length > 30 ? obj.substring(0, 30) + '...' : obj}"`;
      color = COLORS.string;
    } else if (typeof obj === 'number') {
      label = String(obj);
      color = COLORS.number;
    } else if (typeof obj === 'boolean') {
      label = String(obj);
      color = COLORS.boolean;
    } else if (obj === null) {
      label = 'null';
      color = COLORS.null;
    }

    nodes.push({ id: currentId, name: label, val: size, color, path });

    if (parentId !== null) {
      links.push({ source: parentId, target: currentId, name: linkLabel });
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, currentId, `[${index}]`, [...path, index]);
      });
    } else if (obj !== null && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        traverse(value, currentId, key, [...path, key]);
      });
    }
  }

  traverse(json);
  return { nodes, links };
}

export default function NetworkGraphViewer({ 
  data, 
  onNodeClick,
  isFullscreen,
  onToggleFullscreen
}: { 
  data: any; 
  onNodeClick?: (node: NodeData) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const graphData = useMemo(() => jsonToGraph(data), [data]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (fgRef.current) {
      // Increase repulsion to prevent node overlap
      fgRef.current.d3Force('charge')?.strength(-300);
      // Increase link distance so labels fit better
      fgRef.current.d3Force('link')?.distance(80);
    }
  }, [graphData, dimensions]);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleZoomIn = () => {
    if (!fgRef.current) return;
    const currentZoom = fgRef.current.zoom();
    fgRef.current.zoom(currentZoom * 1.3, 300);
  };

  const handleZoomOut = () => {
    if (!fgRef.current) return;
    const currentZoom = fgRef.current.zoom();
    fgRef.current.zoom(currentZoom / 1.3, 300);
  };

  const handleZoomToFit = () => {
    if (!fgRef.current) return;
    fgRef.current.zoomToFit(400, 30);
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-bg-primary overflow-hidden relative select-none">
      {/* Floating Controls Bar */}
      <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 bg-bg-secondary/90 backdrop-blur-md border border-border-primary rounded-lg p-1 shadow-lg">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={handleZoomToFit}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Reset View / Fit to Screen"
        >
          <RotateCcw size={15} />
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
          <Network size={13} className="text-accent-primary" />
          <span>{graphData.nodes.length} nodes, {graphData.links.length} links</span>
        </div>
        <div className="h-3 w-px bg-border-primary" />
        <div className="flex items-center space-x-2">
          {Object.entries(COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeColor="color"
          linkColor={() => '#4b5563'}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0}
          nodeRelSize={4}
          onNodeClick={(node: any) => onNodeClick && onNodeClick(node)}
          // @ts-ignore
          linkCanvasObjectMode={() => 'after'}
          // @ts-ignore
          linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const start = link.source;
            const end = link.target;

            if (typeof start !== 'object' || typeof end !== 'object') return;

            const label = link.name;
            if (!label) return;

            const fontSize = 4;
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

            const textPos = Object.assign(
              { ...start },
              ['x', 'y'].reduce((acc, c) => {
                // @ts-ignore
                acc[c] = start[c] + (end[c] - start[c]) / 2;
                return acc;
              }, {})
            );

            // Calculate angle for text rotation
            let angle = Math.atan2(end.y - start.y, end.x - start.x);
            // Keep text upright
            if (angle > Math.PI / 2) angle -= Math.PI;
            else if (angle < -Math.PI / 2) angle += Math.PI;

            ctx.save();
            // @ts-ignore
            ctx.translate(textPos.x, textPos.y);
            ctx.rotate(angle);

            ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
            ctx.fillRect(
              -bckgDimensions[0] / 2,
              -bckgDimensions[1] / 2,
              bckgDimensions[0],
              bckgDimensions[1]
            );

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#e5e7eb'; // text-gray-200
            ctx.fillText(label, 0, 0);

            ctx.restore();
          }}
        />
      )}
    </div>
  );
}
