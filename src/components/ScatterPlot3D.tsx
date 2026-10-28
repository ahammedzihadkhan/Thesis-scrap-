import React, { useRef, useEffect, useState } from 'react';
import { CustomerRFMTD, PersonaType } from '../rfm/types';
import { PERSONA_METAS } from '../rfm/mlClustering';
import { RotateCcw, ZoomIn, ZoomOut, Info } from 'lucide-react';

interface ScatterPlot3DProps {
  customers: CustomerRFMTD[];
  currencySymbol: string;
}

export const ScatterPlot3D: React.FC<ScatterPlot3DProps> = ({ customers, currencySymbol }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rotation angles in radians
  const [rotX, setRotX] = useState<number>(0.28);
  const [rotY, setRotY] = useState<number>(-0.45);
  const [zoom, setZoom] = useState<number>(0.95);
  const [hoveredCustomer, setHoveredCustomer] = useState<{
    customer: CustomerRFMTD;
    x: number;
    y: number;
  } | null>(null);

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Compute normalized 3D coordinates for points
  // X = Recency, Y = Frequency, Z = Monetary
  const points = React.useMemo(() => {
    if (customers.length === 0) return [];

    let minR = Infinity, maxR = -Infinity;
    let minF = Infinity, maxF = -Infinity;
    let minM = Infinity, maxM = -Infinity;

    for (const c of customers) {
      if (c.recency < minR) minR = c.recency;
      if (c.recency > maxR) maxR = c.recency;
      if (c.frequency < minF) minF = c.frequency;
      if (c.frequency > maxF) maxF = c.frequency;
      if (c.monetary < minM) minM = c.monetary;
      if (c.monetary > maxM) maxM = c.monetary;
    }

    const rangeR = maxR - minR || 1;
    const rangeF = maxF - minF || 1;
    const rangeM = maxM - minM || 1;

    return customers.map((c) => {
      // Map to [-1, 1] cube
      const nx = ((c.recency - minR) / rangeR) * 2 - 1;
      const ny = ((c.frequency - minF) / rangeF) * 2 - 1;
      const nz = ((c.monetary - minM) / rangeM) * 2 - 1;

      const personaMeta = c.persona ? PERSONA_METAS[c.persona] : null;
      const color = personaMeta ? personaMeta.color : '#3b82f6';

      return {
        customer: c,
        x: nx,
        y: ny,
        z: nz,
        color,
      };
    });
  }, [customers]);

  // Render 3D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const baseScale = Math.min(width, height) * 0.35 * zoom;

    // Rotation matrices
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    const project = (x: number, y: number, z: number) => {
      // Y rotation
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;

      // X rotation
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      // Perspective projection
      const cameraDistance = 3.2;
      const fov = cameraDistance / (cameraDistance + z2);

      return {
        screenX: centerX + x1 * baseScale * fov,
        screenY: centerY - y2 * baseScale * fov, // Invert Y for standard math orientation
        depth: z2,
        fov,
      };
    };

    // Draw 3D Bounding Box Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e2e8f0';

    const corners = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ];

    const projectedCorners = corners.map(([x, y, z]) => project(x, y, z));

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Back face
      [4, 5], [5, 6], [6, 7], [7, 4], // Front face
      [0, 4], [1, 5], [2, 6], [3, 7], // Connecting edges
    ];

    for (const [start, end] of edges) {
      ctx.beginPath();
      ctx.moveTo(projectedCorners[start].screenX, projectedCorners[start].screenY);
      ctx.lineTo(projectedCorners[end].screenX, projectedCorners[end].screenY);
      ctx.stroke();
    }

    // Draw Axis Labels
    const axisLabels = [
      { text: 'Recency (R) →', pos: [1.2, -1, -1] },
      { text: '↑ Frequency (F)', pos: [-1, 1.25, -1] },
      { text: '⤢ Monetary (M)', pos: [-1, -1, 1.3] },
    ];

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#64748b';
    for (const axis of axisLabels) {
      const p = project(axis.pos[0], axis.pos[1], axis.pos[2]);
      ctx.fillText(axis.text, p.screenX - 20, p.screenY);
    }

    // Project all customer points and sort by depth (Painter's algorithm)
    const projectedPoints = points.map((p) => {
      const proj = project(p.x, p.y, p.z);
      return {
        ...p,
        screenX: proj.screenX,
        screenY: proj.screenY,
        depth: proj.depth,
        fov: proj.fov,
      };
    });

    projectedPoints.sort((a, b) => b.depth - a.depth);

    // Draw points
    for (const p of projectedPoints) {
      const radius = Math.max(2.5, Math.min(6, 4 * p.fov));
      ctx.beginPath();
      ctx.arc(p.screenX, p.screenY, radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }, [points, rotX, rotY, zoom]);

  // Handle Mouse Drag for 3D rotation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      setRotY((prev) => prev + dx * 0.008);
      setRotX((prev) => Math.max(-1.4, Math.min(1.4, prev + dy * 0.008)));

      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover detection
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check nearest point
    const baseScale = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.35 * zoom;
    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    let closest: { customer: CustomerRFMTD; x: number; y: number } | null = null;
    let minDistance = 14; // hover tolerance px

    for (const p of points) {
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const cameraDistance = 3.2;
      const fov = cameraDistance / (cameraDistance + z2);

      const sx = centerX + x1 * baseScale * fov;
      const sy = centerY - y2 * baseScale * fov;

      const dist = Math.hypot(mouseX - sx, mouseY - sy);
      if (dist < minDistance) {
        minDistance = dist;
        closest = {
          customer: p.customer,
          x: sx,
          y: sy,
        };
      }
    }

    setHoveredCustomer(closest);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const resetView = () => {
    setRotX(0.28);
    setRotY(-0.45);
    setZoom(0.95);
  };

  return (
    <div className="relative w-full h-[460px] bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden select-none">
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          3D Interactive Scatter Space
        </span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
          Drag to rotate • Scroll to zoom
        </span>
      </div>

      <div className="absolute top-3 right-4 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-slate-200 shadow-xs">
        <button
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          title="Zoom in"
          aria-label="Zoom in 3D scatter"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          title="Zoom out"
          aria-label="Zoom out 3D scatter"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          title="Reset 3D camera"
          aria-label="Reset 3D camera"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Hover Tooltip */}
      {hoveredCustomer && (
        <div
          className="absolute pointer-events-none z-20 bg-slate-900/95 text-white text-xs rounded-lg p-2.5 shadow-xl border border-slate-700 min-w-[200px]"
          style={{
            left: `${Math.min(hoveredCustomer.x + 12, 340)}px`,
            top: `${Math.min(hoveredCustomer.y + 12, 320)}px`,
          }}
        >
          <div className="font-semibold text-white border-b border-slate-700 pb-1 mb-1.5 flex justify-between items-center">
            <span>{hoveredCustomer.customer.customerKey}</span>
            {hoveredCustomer.customer.isGuest && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                Guest
              </span>
            )}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mb-1">
            {hoveredCustomer.customer.persona}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-300 text-[10px]">
            <div>Recency (R):</div>
            <div className="font-semibold text-right">{hoveredCustomer.customer.recency} days</div>
            <div>Frequency (F):</div>
            <div className="font-semibold text-right">{hoveredCustomer.customer.frequency} orders</div>
            <div>Monetary (M):</div>
            <div className="font-semibold text-right">
              {currencySymbol}{hoveredCustomer.customer.monetary.toLocaleString()}
            </div>
            <div>Inter-Purchase (T):</div>
            <div className="font-semibold text-right">{hoveredCustomer.customer.interPurchaseTime} days</div>
            <div>Basket Depth (D):</div>
            <div className="font-semibold text-right">{hoveredCustomer.customer.basketDepth} SKUs</div>
          </div>
        </div>
      )}

      {/* Persona Legend on Bottom Left */}
      <div className="absolute bottom-3 left-4 z-10 flex flex-wrap gap-2 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-xs">
        {Object.values(PERSONA_METAS).map((meta) => (
          <div key={meta.type} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: meta.color }}
            />
            <span className="text-[11px] font-medium text-slate-700">{meta.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
