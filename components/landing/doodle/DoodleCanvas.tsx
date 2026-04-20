"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DoodleStroke } from "@/lib/db";

interface DoodleCanvasProps {
  initialStrokes: DoodleStroke[];
  onSave: (strokes: DoodleStroke[]) => void;
  onDelete: () => void;
  onClose: () => void;
  dayLabel: string;
}

const PEN_COLOR = "#c96442";
const PEN_WIDTH = 3;

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DoodleStroke, w: number, h: number) {
  if (stroke.points.length < 2) {
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const pts = stroke.points;
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x * w + pts[i + 1].x * w) / 2;
    const midY = (pts[i].y * h + pts[i + 1].y * h) / 2;
    ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x * w, last.y * h);
  ctx.stroke();
}

function renderAll(
  ctx: CanvasRenderingContext2D,
  strokes: DoodleStroke[],
  w: number,
  h: number,
  isDark: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = isDark ? "#1e1d1b" : "#ffffff";
  ctx.fillRect(0, 0, w, h);
  for (const s of strokes) drawStroke(ctx, s, w, h);
}

export function DoodleCanvas({
  initialStrokes,
  onSave,
  onDelete,
  onClose,
  dayLabel,
}: DoodleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<DoodleStroke[]>(initialStrokes);
  const [redoStack, setRedoStack] = useState<DoodleStroke[]>([]);
  const activeStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);
  const [isDark, setIsDark] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      setCanvasSize({ w: Math.round(rect.width * dpr), h: Math.round(rect.height * dpr) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize.w || !canvasSize.h) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderAll(ctx, strokes, canvasSize.w, canvasSize.h, isDark);
  }, [strokes, canvasSize.w, canvasSize.h, isDark]);

  const toNorm = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      isDrawingRef.current = true;
      const p = toNorm(e.clientX, e.clientY);
      activeStrokeRef.current = [p];

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = PEN_COLOR;
      ctx.beginPath();
      ctx.arc(p.x * canvasSize.w, p.y * canvasSize.h, PEN_WIDTH / 2, 0, Math.PI * 2);
      ctx.fill();
    },
    [toNorm, canvasSize.w, canvasSize.h],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const p = toNorm(e.clientX, e.clientY);
      const pts = activeStrokeRef.current;
      pts.push(p);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || pts.length < 2) return;
      const prev = pts[pts.length - 2];
      ctx.strokeStyle = PEN_COLOR;
      ctx.lineWidth = PEN_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(prev.x * canvasSize.w, prev.y * canvasSize.h);
      ctx.lineTo(p.x * canvasSize.w, p.y * canvasSize.h);
      ctx.stroke();
    },
    [toNorm, canvasSize.w, canvasSize.h],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = activeStrokeRef.current;
    if (pts.length === 0) return;
    const newStroke: DoodleStroke = { points: [...pts], color: PEN_COLOR, width: PEN_WIDTH };
    activeStrokeRef.current = [];
    setStrokes((prev) => [...prev, newStroke]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const removed = prev[prev.length - 1];
      setRedoStack((r) => [...r, removed]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const restored = prev[prev.length - 1];
      setStrokes((s) => [...s, restored]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    if (strokes.length === 0) return;
    setRedoStack([]);
    setStrokes([]);
  }, [strokes.length]);

  const handleSave = useCallback(() => {
    onSave(strokes);
  }, [onSave, strokes]);

  const handleDragStart = useCallback((clientY: number) => {
    dragStartYRef.current = clientY;
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (dragStartYRef.current === null) return;
    const delta = Math.max(0, clientY - dragStartYRef.current);
    setDragOffset(delta);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragStartYRef.current === null) return;
    dragStartYRef.current = null;
    if (dragOffset > 120) {
      onClose();
    } else {
      setDragOffset(0);
    }
  }, [dragOffset, onClose]);

  const btnClass =
    "flex items-center justify-center w-10 h-10 rounded-full bg-neutral-800/80 dark:bg-neutral-700/80 text-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-600 transition-colors disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/60 animate-fade-in">
      <div className="flex-1" onClick={onClose} />
      <div
        ref={sheetRef}
        className="relative mx-auto w-full max-w-lg rounded-t-3xl bg-[#1e1d1b] dark:bg-[#1e1d1b] pb-safe shadow-2xl animate-fade-in-up overflow-hidden flex flex-col"
        style={{
          maxHeight: "85dvh",
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragStartYRef.current !== null ? "none" : "transform 0.25s ease-out",
        }}
      >
        {/* Handle bar — drag to dismiss */}
        <div
          className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => { handleDragStart(e.clientY); const move = (ev: MouseEvent) => handleDragMove(ev.clientY); const up = () => { handleDragEnd(); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }}
        >
          <div className="h-1 w-10 rounded-full bg-neutral-600" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2">
          <button type="button" onClick={handleClear} className={btnClass} aria-label="Clear all" disabled={strokes.length === 0}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleUndo} className={btnClass} aria-label="Undo" disabled={strokes.length === 0}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
                <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.06.025Z" clipRule="evenodd" />
              </svg>
            </button>
            <button type="button" onClick={handleRedo} className={btnClass} aria-label="Redo" disabled={redoStack.length === 0}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
                <path fillRule="evenodd" d="M12.207 2.232a.75.75 0 0 0 .025 1.06l4.146 3.958H6.375a5.375 5.375 0 0 0 0 10.75H9.25a.75.75 0 0 0 0-1.5H6.375a3.875 3.875 0 0 1 0-7.75h10.003l-4.146 3.957a.75.75 0 0 0 1.036 1.085l5.5-5.25a.75.75 0 0 0 0-1.085l-5.5-5.25a.75.75 0 0 0-1.06.025Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <button type="button" onClick={handleSave} className={`${btnClass} !bg-[#c96442] !text-white hover:!bg-[#b05530]`} aria-label="Save doodle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <p className="px-4 pb-2 text-xs text-neutral-500 text-center">{dayLabel}</p>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 mx-3 mb-3 rounded-2xl overflow-hidden bg-white dark:bg-[#2a2927]" style={{ touchAction: "none", minHeight: "300px" }}>
          <canvas
            ref={canvasRef}
            className="block w-full h-full cursor-crosshair"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

        {/* Delete button */}
        <div className="px-4 pb-4 flex justify-center">
          <button
            type="button"
            onClick={() => {
              handleClear();
              onDelete();
            }}
            className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
          >
            Delete this doodle
          </button>
        </div>
      </div>
    </div>
  );
}
