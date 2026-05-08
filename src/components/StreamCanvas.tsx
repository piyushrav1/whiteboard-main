"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type React from "react";
import type { Socket } from "socket.io-client";
import { Minus, Plus } from "lucide-react";
import type { Cursor, Point, Stroke, StrokeStyle } from "@/types/whiteboard";

type RoomState = {
  snapshot: { image: string; strokeCount: number } | null;
  strokes: Stroke[];
  messages: unknown[];
};

type ActiveStroke = {
  strokeID: string;
  author?: { id: string; name: string };
  points: Point[];
  style: StrokeStyle;
  zIndex?: number;
};

type Camera = { x: number; y: number; zoom: number };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const GRID_SIZE = 32;

export function StreamCanvas({
  socket,
  initialState,
  tool,
  roomID,
  onZoomChange
}: {
  socket: Socket | null;
  initialState: RoomState | null;
  tool: { type: string; color: string; width: number };
  roomID: string;
  onZoomChange?: (zoom: number, setZoom: (z: number) => void, resetView: () => void) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const remoteActiveRef = useRef<Map<string, ActiveStroke>>(new Map());
  const localStrokeRef = useRef<ActiveStroke | null>(null);
  const lastEmitRef = useRef(0);
  const queuedPointRef = useRef<Point | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const cursorEmitRef = useRef(0);

  // Shape drawing state
  const shapeStartRef = useRef<Point | null>(null);
  const shapeCurrentRef = useRef<Point | null>(null);

  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; camX: number; camY: number }>({ x: 0, y: 0, camX: 0, camY: 0 });
  const spaceDownRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [zoomDisplay, setZoomDisplay] = useState(100);

  // Convert screen coords to world coords
  function screenToWorld(sx: number, sy: number): Point {
    const cam = cameraRef.current;
    return {
      x: (sx - cam.x) / cam.zoom,
      y: (sy - cam.y) / cam.zoom
    };
  }

  // Schedule a redraw on next animation frame (deduped)
  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redraw();
    });
  }, []);

  useEffect(() => {
    strokesRef.current = initialState?.strokes || [];
    scheduleRedraw();
  }, [initialState, scheduleRedraw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      scheduleRedraw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    return () => observer.disconnect();
  }, [scheduleRedraw]);

  // Keyboard listeners for space-to-pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceDownRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = false;
        isPanningRef.current = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Zoom toward cursor
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));

      const wx = (mx - cam.x) / cam.zoom;
      const wy = (my - cam.y) / cam.zoom;

      cam.zoom = newZoom;
      cam.x = mx - wx * newZoom;
      cam.y = my - wy * newZoom;

      setZoomDisplay(Math.round(newZoom * 100));
      onZoomChange?.(newZoom, setZoom, resetView);
      scheduleRedraw();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [scheduleRedraw]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const start = ({ strokeID, author, point, style }: { strokeID: string; author: Stroke["author"]; point: Point; style: StrokeStyle }) => {
      remoteActiveRef.current.set(strokeID, { strokeID, author, points: [point], style });
      scheduleRedraw();
    };
    const stream = ({ strokeID, point }: { strokeID: string; point: Point }) => {
      const active = remoteActiveRef.current.get(strokeID);
      if (!active) return;
      active.points.push(point);
      scheduleRedraw();
    };
    const end = ({ strokeID, zIndex }: { strokeID: string; zIndex: number }) => {
      const active = remoteActiveRef.current.get(strokeID);
      if (!active) return;
      remoteActiveRef.current.delete(strokeID);
      strokesRef.current = [...strokesRef.current, { ...active, author: active.author || { id: "remote", name: "Remote" }, zIndex }];
      scheduleRedraw();
    };
    const remove = ({ strokeID }: { strokeID: string }) => {
      strokesRef.current = strokesRef.current.filter((stroke) => stroke.strokeID !== strokeID);
      remoteActiveRef.current.delete(strokeID);
      scheduleRedraw();
    };
    const restore = (stroke: Stroke) => {
      strokesRef.current = [...strokesRef.current.filter((item) => item.strokeID !== stroke.strokeID), stroke].sort((a, b) => a.zIndex - b.zIndex);
      scheduleRedraw();
    };
    const clear = () => {
      strokesRef.current = [];
      remoteActiveRef.current.clear();
      scheduleRedraw();
    };
    const cursorMove = (cursor: Cursor) => {
      setCursors((current) => new Map(current).set(cursor.user.id, cursor));
    };
    const cursorLeave = ({ id }: { id: string }) => {
      setCursors((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    };

    socket.on("start-stroke", start);
    socket.on("stream-stroke", stream);
    socket.on("end-stroke", end);
    socket.on("remove-stroke", remove);
    socket.on("restore-stroke", restore);
    socket.on("clear-canvas", clear);
    socket.on("cursor-move", cursorMove);
    socket.on("cursor-leave", cursorLeave);

    return () => {
      socket.off("start-stroke", start);
      socket.off("stream-stroke", stream);
      socket.off("end-stroke", end);
      socket.off("remove-stroke", remove);
      socket.off("restore-stroke", restore);
      socket.off("clear-canvas", clear);
      socket.off("cursor-move", cursorMove);
      socket.off("cursor-leave", cursorLeave);
    };
  }, [socket, scheduleRedraw]);

  // Export listeners
  useEffect(() => {
    const exportPng = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      download(`${roomID}.png`, canvas.toDataURL("image/png"));
    };
    const exportSvg = () => {
      const svg = strokesToSvg(strokesRef.current, canvasRef.current);
      download(`${roomID}.svg`, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    };

    window.addEventListener("whiteboard-export-png", exportPng);
    window.addEventListener("whiteboard-export-svg", exportSvg);
    return () => {
      window.removeEventListener("whiteboard-export-png", exportPng);
      window.removeEventListener("whiteboard-export-svg", exportSvg);
    };
  }, [roomID]);

  /* ── Eraser Helpers ── */
  function eraseAtPoint(pt: Point) {
    const distToSegmentSquared = (p: Point, v: Point, w: Point) => {
      const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
      if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
    };

    const ERASER_RADIUS_WORLD = 15 / cameraRef.current.zoom;
    const radiusSq = ERASER_RADIUS_WORLD * ERASER_RADIUS_WORLD;
    
    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const stroke = strokesRef.current[i];
      let hit = false;
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        if ((p.x - pt.x) ** 2 + (p.y - pt.y) ** 2 <= radiusSq) hit = true;
      } else {
        for (let j = 0; j < stroke.points.length - 1; j++) {
          if (distToSegmentSquared(pt, stroke.points[j], stroke.points[j+1]) <= radiusSq) {
            hit = true;
            break;
          }
        }
      }
      
      if (hit) {
        strokesRef.current.splice(i, 1);
        socket?.emit("remove-stroke", { strokeID: stroke.strokeID });
        scheduleRedraw();
      }
    }
  }

  /* ── Pointer handlers ── */

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    // Middle mouse or space+left or tool=hand -> pan
    if (event.button === 1 || (spaceDownRef.current && event.button === 0) || tool.type === "hand") {
      isPanningRef.current = true;
      panStartRef.current = { x: event.clientX, y: event.clientY, camX: cameraRef.current.x, camY: cameraRef.current.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (!socket || event.button !== 0 || tool.type === "pointer") return;

    const point = screenToWorld(sx, sy);

    if (tool.type === "eraser") {
      eraseAtPoint(point);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const strokeID = crypto.randomUUID();
    const style = {
      color: tool.color,
      width: tool.width
    };
    const active = { strokeID, points: [point], style };
    localStrokeRef.current = active;
    
    if (tool.type === "pencil") {
      lastEmitRef.current = performance.now();
      socket.emit("start-stroke", { strokeID, color: style.color, width: style.width, initialCoords: point });
    } else {
      shapeStartRef.current = point;
      shapeCurrentRef.current = point;
    }
    
    event.currentTarget.setPointerCapture(event.pointerId);
    scheduleRedraw();
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    // Panning
    if (isPanningRef.current) {
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      cameraRef.current.x = panStartRef.current.camX + dx;
      cameraRef.current.y = panStartRef.current.camY + dy;
      scheduleRedraw();
      return;
    }

    const point = screenToWorld(sx, sy);
    maybeEmitCursor(point);

    if (tool.type === "eraser") {
      if (event.buttons === 1) {
        eraseAtPoint(point);
      }
      return;
    }

    const active = localStrokeRef.current;
    if (!active) return;

    if (tool.type === "pencil") {
      active.points.push(point);
      streamPoint(active.strokeID, point);
    } else {
      shapeCurrentRef.current = point;
    }
    
    scheduleRedraw();
  }

  function pointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (tool.type === "eraser") {
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    const active = localStrokeRef.current;
    if (!active || !socket) return;

    if (tool.type === "pencil") {
      flushQueuedPoint(active.strokeID);
    } else if (shapeStartRef.current && shapeCurrentRef.current) {
      // Generate shape points
      const points = generateShapePoints(tool.type, shapeStartRef.current, shapeCurrentRef.current);
      if (points.length > 0) {
        active.points = points;
        socket.emit("start-stroke", { strokeID: active.strokeID, color: active.style.color, width: active.style.width, initialCoords: points[0] });
        points.slice(1).forEach(pt => socket.emit("stream-stroke", { strokeID: active.strokeID, point: pt }));
      }
    }

    localStrokeRef.current = null;
    shapeStartRef.current = null;
    shapeCurrentRef.current = null;
    
    if (active.points.length > 0) {
      strokesRef.current = [...strokesRef.current, { ...active, author: { id: "me", name: "Me" }, zIndex: Date.now() }];
      socket.emit("end-stroke", { strokeID: active.strokeID, snapshot: canvasRef.current?.toDataURL("image/png") });
    }
    
    event.currentTarget.releasePointerCapture(event.pointerId);
    scheduleRedraw();
  }

  function streamPoint(strokeID: string, point: Point) {
    if (!socket) return;
    const now = performance.now();

    if (now - lastEmitRef.current >= 12) {
      socket.emit("stream-stroke", { strokeID, point });
      lastEmitRef.current = now;
      queuedPointRef.current = null;
      return;
    }

    queuedPointRef.current = point;
    if (streamTimerRef.current) return;

    streamTimerRef.current = window.setTimeout(() => {
      streamTimerRef.current = null;
      flushQueuedPoint(strokeID);
    }, 12);
  }

  function flushQueuedPoint(strokeID: string) {
    if (!socket || !queuedPointRef.current) return;
    socket.emit("stream-stroke", { strokeID, point: queuedPointRef.current });
    queuedPointRef.current = null;
    lastEmitRef.current = performance.now();
  }

  function maybeEmitCursor(point: Point) {
    if (!socket) return;
    const now = performance.now();
    if (now - cursorEmitRef.current < 35) return;
    cursorEmitRef.current = now;
    socket.emit("cursor-move", point);
  }

  function emitCursorLeave() {
    if (!socket) return;
    socket.emit("cursor-leave");
  }

  /* ── Drawing ── */

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const cam = cameraRef.current;

    // Reset transform and clear
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, rect.width, rect.height);

    // Draw infinite grid BEFORE applying camera transform (grid in screen space)
    drawInfiniteGrid(context, rect.width, rect.height, cam);

    // Apply camera transform for strokes
    context.save();
    context.translate(cam.x, cam.y);
    context.scale(cam.zoom, cam.zoom);

    strokesRef.current.sort((a, b) => a.zIndex - b.zIndex).forEach((stroke) => drawStroke(context, stroke.points, stroke.style));
    remoteActiveRef.current.forEach((stroke) => drawStroke(context, stroke.points, stroke.style));
    
    if (localStrokeRef.current) {
      if (tool.type === "pencil") {
        drawStroke(context, localStrokeRef.current.points, localStrokeRef.current.style);
      } else if (shapeStartRef.current && shapeCurrentRef.current) {
        const points = generateShapePoints(tool.type, shapeStartRef.current, shapeCurrentRef.current);
        drawStroke(context, points, localStrokeRef.current.style);
      }
    }

    context.restore();
  }

  function drawStroke(context: CanvasRenderingContext2D, points: Point[], style: StrokeStyle) {
    if (points.length === 0) return;
    context.strokeStyle = style.color;
    context.lineWidth = style.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }

  /* ── Zoom controls ── */

  function setZoom(newZoom: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));

    // Zoom toward center
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const wx = (cx - cam.x) / cam.zoom;
    const wy = (cy - cam.y) / cam.zoom;

    cam.zoom = clamped;
    cam.x = cx - wx * clamped;
    cam.y = cy - wy * clamped;

    setZoomDisplay(Math.round(clamped * 100));
    onZoomChange?.(clamped, setZoom, resetView);
    scheduleRedraw();
  }

  function resetView() {
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
    setZoomDisplay(100);
    onZoomChange?.(1, setZoom, resetView);
    scheduleRedraw();
  }

  const cursorStyle = tool.type === "hand" || isPanningRef.current || spaceDownRef.current ? "grab" : tool.type === "pointer" ? "default" : "crosshair";

  return (
    <section ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ cursor: cursorStyle }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onPointerLeave={emitCursorLeave}
      />

      {/* Remote cursors – transformed to screen space */}
      {Array.from(cursors.values()).map((cursor) => {
        const cam = cameraRef.current;
        const sx = cursor.x * cam.zoom + cam.x;
        const sy = cursor.y * cam.zoom + cam.y;
        return (
          <div
            key={cursor.user.id}
            className="pointer-events-none absolute left-0 top-0 rounded-md px-2 py-1 text-xs font-semibold text-white shadow"
            style={{ transform: `translate(${sx}px, ${sy}px)`, backgroundColor: cursor.user.color }}
          >
            {cursor.user.name}
          </div>
        );
      })}


    </section>
  );
}

/* ── Helpers ── */

function generateShapePoints(type: string, start: Point, end: Point): Point[] {
  const points: Point[] = [];
  
  if (type === "line") {
    points.push(start, end);
  } else if (type === "rectangle") {
    points.push(
      start,
      { x: end.x, y: start.y },
      end,
      { x: start.x, y: end.y },
      start
    );
  } else if (type === "ellipse") {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      points.push({
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle)
      });
    }
  } else if (type === "arrow") {
    points.push(start, end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 20;
    // Draw back one side of the arrowhead, then to tip, then other side
    points.push(
      {
        x: end.x - headLen * Math.cos(angle - Math.PI / 6),
        y: end.y - headLen * Math.sin(angle - Math.PI / 6)
      },
      end,
      {
        x: end.x - headLen * Math.cos(angle + Math.PI / 6),
        y: end.y - headLen * Math.sin(angle + Math.PI / 6)
      }
    );
  }
  
  return points;
}

function drawInfiniteGrid(ctx: CanvasRenderingContext2D, width: number, height: number, cam: Camera) {
  // 3-tier adaptive grid: minor (32px), medium (160px), major (800px) in world-space
  const levels = [
    { worldSize: 32,  color: [226, 232, 240], maxOpacity: 0.45 },  // minor — light
    { worldSize: 160, color: [203, 213, 225], maxOpacity: 0.55 },  // medium
    { worldSize: 800, color: [148, 163, 184], maxOpacity: 0.40 },  // major — darker
  ];

  for (const level of levels) {
    const screenStep = level.worldSize * cam.zoom;

    // Skip if lines would be too dense (< 6px apart) or too sparse (> 4000px)
    if (screenStep < 6 || screenStep > 4000) continue;

    // Fade in when lines are 6–24px apart, full opacity above 24px
    const fadeT = Math.min(1, Math.max(0, (screenStep - 6) / 18));
    const opacity = fadeT * level.maxOpacity;
    if (opacity < 0.02) continue;

    const offsetX = cam.x % screenStep;
    const offsetY = cam.y % screenStep;

    ctx.strokeStyle = `rgba(${level.color[0]}, ${level.color[1]}, ${level.color[2]}, ${opacity})`;
    ctx.lineWidth = screenStep > 100 ? 1 : 0.5;

    ctx.beginPath();
    for (let x = offsetX; x < width; x += screenStep) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = offsetY; y < height; y += screenStep) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }

  // Origin crosshair — draw a subtle axis marker at (0,0) for orientation
  const ox = cam.x;
  const oy = cam.y;
  if (ox > -2 && ox < width + 2 && oy > -2 && oy < height + 2) {
    ctx.strokeStyle = "rgba(94, 234, 212, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, Math.max(0, oy - 20));
    ctx.lineTo(ox, Math.min(height, oy + 20));
    ctx.moveTo(Math.max(0, ox - 20), oy);
    ctx.lineTo(Math.min(width, ox + 20), oy);
    ctx.stroke();
  }
}

function strokesToSvg(strokes: Stroke[], canvas: HTMLCanvasElement | null) {
  const rect = canvas?.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect?.width || 1200));
  const height = Math.max(1, Math.round(rect?.height || 800));
  const paths = strokes
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((stroke) => {
      const points = stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${stroke.style.color}" stroke-width="${stroke.style.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${paths}</svg>`;
}

function download(filename: string, href: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}
