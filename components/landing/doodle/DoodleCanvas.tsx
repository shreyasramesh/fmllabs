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

const THICKNESS_OPTIONS = [1.5, 3, 5, 8];
const ERASER_COLOR = "__eraser__";

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DoodleStroke, w: number, h: number, dpr: number, bgColor: string) {
  const isEraser = stroke.color === ERASER_COLOR;
  const scaledWidth = stroke.width * dpr;
  if (stroke.points.length < 2) {
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.fillStyle = isEraser ? bgColor : stroke.color;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, Math.max(scaledWidth / 2, 1.5 * dpr), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  ctx.strokeStyle = isEraser ? bgColor : stroke.color;
  ctx.lineWidth = scaledWidth;
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

function renderAll(ctx: CanvasRenderingContext2D, strokes: DoodleStroke[], w: number, h: number, isDark: boolean, dpr: number) {
  const bg = isDark ? "#1e1d1b" : "#ffffff";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  for (const s of strokes) drawStroke(ctx, s, w, h, dpr, bg);
}

export function DoodleCanvas({ initialStrokes, onSave, onDelete, onClose, dayLabel }: DoodleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<DoodleStroke[]>(initialStrokes);
  const [redoStack, setRedoStack] = useState<DoodleStroke[]>([]);
  const activeStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);
  const [isDark, setIsDark] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const dprRef = useRef(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const [penColor, setPenColor] = useState("#c96442");
  const [penWidth, setPenWidth] = useState(THICKNESS_OPTIONS[1]);
  const [isEraser, setIsEraser] = useState(false);

  const activeColor = isEraser ? ERASER_COLOR : penColor;
  const activeWidth = isEraser ? THICKNESS_OPTIONS[3] : penWidth;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const rect = container.getBoundingClientRect();
      dprRef.current = window.devicePixelRatio || 1;
      setCanvasSize({ w: Math.round(rect.width * dprRef.current), h: Math.round(rect.height * dprRef.current) });
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
    renderAll(ctx, strokes, canvasSize.w, canvasSize.h, isDark, dprRef.current);
  }, [strokes, canvasSize.w, canvasSize.h, isDark]);

  const toNorm = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;
    const p = toNorm(e.clientX, e.clientY);
    activeStrokeRef.current = [p];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scaledW = activeWidth * dprRef.current;
    const bg = isDark ? "#1e1d1b" : "#ffffff";
    ctx.fillStyle = isEraser ? bg : penColor;
    ctx.beginPath();
    ctx.arc(p.x * canvasSize.w, p.y * canvasSize.h, Math.max(scaledW / 2, 1.5 * dprRef.current), 0, Math.PI * 2);
    ctx.fill();
  }, [toNorm, canvasSize.w, canvasSize.h, penColor, activeWidth, isEraser, isDark]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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
    const scaledW = activeWidth * dprRef.current;
    const bg = isDark ? "#1e1d1b" : "#ffffff";
    ctx.strokeStyle = isEraser ? bg : penColor;
    ctx.lineWidth = scaledW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x * canvasSize.w, prev.y * canvasSize.h);
    ctx.lineTo(p.x * canvasSize.w, p.y * canvasSize.h);
    ctx.stroke();
  }, [toNorm, canvasSize.w, canvasSize.h, penColor, activeWidth, isEraser, isDark]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = activeStrokeRef.current;
    if (pts.length === 0) return;
    const newStroke: DoodleStroke = { points: [...pts], color: activeColor, width: activeWidth };
    activeStrokeRef.current = [];
    setStrokes((prev) => [...prev, newStroke]);
    setRedoStack([]);
  }, [activeColor, activeWidth]);

  const handleUndo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      setRedoStack((r) => [...r, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      setStrokes((s) => [...s, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    if (strokes.length === 0) return;
    setRedoStack([]);
    setStrokes([]);
  }, [strokes.length]);

  const handleSave = useCallback(() => { onSave(strokes); }, [onSave, strokes]);

  const handleDragStart = useCallback((clientY: number) => { dragStartYRef.current = clientY; }, []);
  const handleDragMove = useCallback((clientY: number) => {
    if (dragStartYRef.current === null) return;
    setDragOffset(Math.max(0, clientY - dragStartYRef.current));
  }, []);
  const handleDragEnd = useCallback(() => {
    if (dragStartYRef.current === null) return;
    dragStartYRef.current = null;
    if (dragOffset > 120) onClose(); else setDragOffset(0);
  }, [dragOffset, onClose]);

  const handleSpectrumPick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hue = Math.round(x * 360);
    const hex = hslToHex(hue, 0.65, 0.50);
    setPenColor(hex);
    setIsEraser(false);
  }, []);

  const spectrumRef = useRef(false);
  const onSpectrumDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    spectrumRef.current = true;
    handleSpectrumPick(e);
  }, [handleSpectrumPick]);
  const onSpectrumMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!spectrumRef.current) return;
    handleSpectrumPick(e);
  }, [handleSpectrumPick]);
  const onSpectrumUp = useCallback(() => { spectrumRef.current = false; }, []);

  const topBtnClass = "flex items-center justify-center w-9 h-9 rounded-full bg-neutral-800/80 dark:bg-neutral-700/80 text-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-600 transition-colors disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/60 animate-fade-in">
      <div className="flex-1" onClick={onClose} />
      <div
        className="relative mx-auto w-full max-w-lg rounded-t-3xl bg-[#1e1d1b] pb-safe shadow-2xl animate-fade-in-up overflow-hidden flex flex-col"
        style={{
          maxHeight: "92dvh",
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragStartYRef.current !== null ? "none" : "transform 0.25s ease-out",
        }}
      >
        {/* Handle */}
        <div
          className="flex justify-center pt-2 pb-0.5 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => { handleDragStart(e.clientY); const mv = (ev: MouseEvent) => handleDragMove(ev.clientY); const up = () => { handleDragEnd(); window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up); }}
        >
          <div className="h-1 w-10 rounded-full bg-neutral-600" />
        </div>

        {/* Top toolbar */}
        <div className="flex items-center justify-between px-3 py-1">
          <button type="button" onClick={handleClear} className={topBtnClass} aria-label="Clear all" disabled={strokes.length === 0}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handleUndo} className={topBtnClass} aria-label="Undo" disabled={strokes.length === 0}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.06.025Z" clipRule="evenodd" />
              </svg>
            </button>
            <button type="button" onClick={handleRedo} className={topBtnClass} aria-label="Redo" disabled={redoStack.length === 0}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M12.207 2.232a.75.75 0 0 0 .025 1.06l4.146 3.958H6.375a5.375 5.375 0 0 0 0 10.75H9.25a.75.75 0 0 0 0-1.5H6.375a3.875 3.875 0 0 1 0-7.75h10.003l-4.146 3.957a.75.75 0 0 0 1.036 1.085l5.5-5.25a.75.75 0 0 0 0-1.085l-5.5-5.25a.75.75 0 0 0-1.06.025Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <button type="button" onClick={handleSave} className={`${topBtnClass} !bg-[#c96442] !text-white hover:!bg-[#b05530]`} aria-label="Save">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <p className="px-4 pb-0.5 text-[11px] text-neutral-500 text-center">{dayLabel}</p>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 mx-2.5 rounded-2xl overflow-hidden bg-white dark:bg-[#2a2927]" style={{ touchAction: "none", minHeight: "200px" }}>
          <canvas
            ref={canvasRef}
            className="block w-full h-full"
            style={{ touchAction: "none", cursor: isEraser ? "cell" : "crosshair" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

        {/* Bottom tools */}
        <div className="shrink-0 px-3 pt-2 pb-2 space-y-2">
          {/* Color spectrum bar */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-8 rounded-full overflow-hidden cursor-crosshair"
              style={{
                background: "linear-gradient(to right, hsl(0,65%,50%), hsl(30,65%,50%), hsl(60,65%,50%), hsl(120,65%,50%), hsl(180,65%,50%), hsl(240,65%,50%), hsl(300,65%,50%), hsl(360,65%,50%))",
                touchAction: "none",
              }}
              onPointerDown={onSpectrumDown}
              onPointerMove={onSpectrumMove}
              onPointerUp={onSpectrumUp}
              onPointerCancel={onSpectrumUp}
              onPointerLeave={onSpectrumUp}
            />
            {/* Current color + black/white quick picks */}
            <div className="flex items-center gap-1">
              <span className="w-7 h-7 rounded-full border-2 border-neutral-600" style={{ backgroundColor: penColor }} />
              <button type="button" onClick={() => { setPenColor("#1a1a1a"); setIsEraser(false); }} className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-neutral-600" aria-label="Black" />
              <button type="button" onClick={() => { setPenColor("#f5f4ed"); setIsEraser(false); }} className="w-6 h-6 rounded-full bg-[#f5f4ed] border border-neutral-600" aria-label="White" />
            </div>
          </div>

          {/* Thickness + eraser row */}
          <div className="flex items-center justify-center gap-2.5">
            {THICKNESS_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setPenWidth(t); setIsEraser(false); }}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                  penWidth === t && !isEraser ? "bg-neutral-600 ring-1 ring-neutral-400" : "bg-neutral-800/60 hover:bg-neutral-700"
                }`}
                aria-label={`Thickness ${t}`}
              >
                <span className="rounded-full" style={{ width: `${Math.max(4, t * 2.2)}px`, height: `${Math.max(4, t * 2.2)}px`, backgroundColor: penColor }} />
              </button>
            ))}
            <div className="w-px h-5 bg-neutral-700 mx-0.5" />
            <button
              type="button"
              onClick={() => setIsEraser((v) => !v)}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${isEraser ? "bg-neutral-600 ring-1 ring-neutral-400" : "bg-neutral-800/60 hover:bg-neutral-700"}`}
              aria-label="Eraser"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-neutral-300">
                <path d="M8.785 9.896l3.11-3.111 4.148 4.148-3.11 3.11-4.148-4.147Z" />
                <path fillRule="evenodd" d="M3.545 12.033a2.75 2.75 0 0 1 0-3.889l5.6-5.6a2.75 2.75 0 0 1 3.889 0l4.422 4.422a2.75 2.75 0 0 1 0 3.89l-5.6 5.599a2.75 2.75 0 0 1-3.89 0l-4.42-4.422Zm1.06-2.828a1.25 1.25 0 0 0 0 1.768l4.421 4.42a1.25 1.25 0 0 0 1.768 0l5.6-5.6a1.25 1.25 0 0 0 0-1.767l-4.422-4.421a1.25 1.25 0 0 0-1.768 0l-5.6 5.6Z" clipRule="evenodd" />
              </svg>
            </button>
            <button type="button" onClick={() => { handleClear(); onDelete(); }} className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-800/60 hover:bg-red-900/60 transition-colors" aria-label="Delete doodle">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-red-400">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
