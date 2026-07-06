import React, { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface NodeData {
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

const COLORS = {
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

export default function NetworkGraphViewer({ data, onNodeClick }: { data: any, onNodeClick?: (node: NodeData) => void }) {
  const graphData = useMemo(() => jsonToGraph(data), [data]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (fgRef.current) {
      // Increase repulsion to prevent node overlap
      fgRef.current.d3Force('charge').strength(-300);
      // Increase link distance so labels fit better
      fgRef.current.d3Force('link').distance(80);
    }
  }, [graphData, dimensions]); // Re-run when data or dimensions change

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

  return (
    <div ref={containerRef} className="w-full h-full bg-bg-primary overflow-hidden relative">
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
