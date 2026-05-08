"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  Clipboard,
  Download,
  Eraser,
  FileCode2,
  Hand,
  Minus,
  MousePointer2,
  Move,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Square,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { ActiveUsers } from "./ActiveUsers";
import { ChatSidebar } from "./ChatSidebar";
import { StreamCanvas } from "./StreamCanvas";
import type { ChatMessage, Stroke, User } from "@/types/whiteboard";

type RoomState = {
  snapshot: { image: string; strokeCount: number } | null;
  strokes: Stroke[];
  messages: ChatMessage[];
};

export function WhiteboardRoom({ roomID }: { roomID: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [tool, setTool] = useState({ type: "pencil", color: "#111827", width: 4 });
  const [activeMenu, setActiveMenu] = useState<'draw' | 'shape' | null>(null);
  const [copied, setCopied] = useState(false);
  const user = useMemo(readUser, []);

  // Zoom state lifted from StreamCanvas
  const [zoomPercent, setZoomPercent] = useState(100);
  const [zoomFns, setZoomFns] = useState<{
    setZoom: (z: number) => void;
    resetView: () => void;
  } | null>(null);

  const handleZoomChange = useCallback(
    (zoom: number, setZoom: (z: number) => void, resetView: () => void) => {
      setZoomPercent(Math.round(zoom * 100));
      setZoomFns({ setZoom, resetView });
    },
    []
  );

  useEffect(() => {
    const nextSocket = io({ transports: ["websocket"] });
    setSocket(nextSocket);

    nextSocket.emit("join-room", { roomID, user });
    nextSocket.on("room-state", (state: RoomState) => {
      setRoomState(state);
      setMessages(state.messages);
    });
    nextSocket.on("users-update", setUsers);
    nextSocket.on("chat-message", (message: ChatMessage) => {
      setMessages((current) => [...current, message].slice(-120));
    });
    nextSocket.on("room-error", (message: string) => alert(message));

    return () => {
      nextSocket.disconnect();
    };
  }, [roomID, user]);

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      
      const key = e.key.toLowerCase();
      setTool((current) => {
        const next = { ...current };
        if (key === "v") next.type = "pointer";
        else if (key === "h") next.type = "hand";
        else if (key === "p") next.type = "pencil";
        else if (key === "e") next.type = "eraser";
        else if (key === "r") next.type = "rectangle";
        else if (key === "c") next.type = "ellipse";
        else if (key === "a") next.type = "arrow";
        else if (key === "l") next.type = "line";
        return next.type !== current.type ? next : current;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function sendMessage(body: string) {
    socket?.emit("chat-message", { body });
  }

  function copyCode() {
    navigator.clipboard.writeText(roomID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const colors = ["#111827", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

  return (
    <main className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-[#eef2f7]">
      {/* ── Minimal header ── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/95 px-3 md:px-5 z-30 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-slate-900">{roomID}</h1>
              <button
                onClick={copyCode}
                className="flex h-6 w-6 items-center justify-center rounded transition hover:bg-slate-100 text-slate-400 hover:text-teal-600"
                title="Copy room code"
              >
                <Clipboard className={`h-3 w-3 transition-colors ${copied ? "text-teal-600" : ""}`} />
              </button>
            </div>
          </div>
          <div className="hidden h-6 w-px bg-slate-200 md:block" />
          <ActiveUsers users={users} />
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-1.5">
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800 shadow-sm"
            onClick={() => window.dispatchEvent(new Event("whiteboard-export-png"))}
            title="Export PNG"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PNG</span>
          </button>
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            onClick={() => window.dispatchEvent(new Event("whiteboard-export-svg"))}
            title="Export SVG"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">SVG</span>
          </button>
        </div>
      </header>

      {/* ── Canvas area (full remaining space) ── */}
      <div className="relative min-h-0 flex-1">
        <StreamCanvas
          socket={socket}
          initialState={roomState}
          tool={tool}
          roomID={roomID}
          onZoomChange={handleZoomChange}
        />

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── Miro-style floating toolbar (left side) ──      */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="absolute left-3 top-1/2 z-30 -translate-y-1/2 flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
          {/* Drawing tools */}
          <ToolBtn
            active={tool.type === "pointer"}
            onClick={() => { setTool(t => ({ ...t, type: "pointer" })); setActiveMenu(null); }}
            title="Select (V)"
          >
            <MousePointer2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            active={tool.type === "hand"}
            onClick={() => { setTool(t => ({ ...t, type: "hand" })); setActiveMenu(null); }}
            title="Hand / Pan (H)"
          >
            <Hand className="h-4 w-4" />
          </ToolBtn>

          {/* Divider */}
          <div className="mx-auto my-1 h-px w-5 bg-slate-200" />

          {/* Draw Menu Trigger */}
          <div className="relative flex">
            <ToolBtn
              active={["pencil", "eraser"].includes(tool.type)}
              onClick={() => setActiveMenu(activeMenu === "draw" ? null : "draw")}
              title="Drawing Tools (P)"
            >
              {tool.type === "eraser" ? <Eraser className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </ToolBtn>

            {/* Draw Popover */}
            {activeMenu === "draw" && (
              <div className="absolute left-[calc(100%+8px)] top-0 flex w-max rounded-xl border border-slate-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md gap-1">
                <ToolBtn active={tool.type === "pencil"} onClick={() => setTool(t => ({ ...t, type: "pencil" }))} title="Pencil (P)">
                  <Pencil className="h-4 w-4" />
                </ToolBtn>
                <ToolBtn active={tool.type === "eraser"} onClick={() => setTool(t => ({ ...t, type: "eraser" }))} title="Eraser (E)">
                  <Eraser className="h-4 w-4" />
                </ToolBtn>
                
                <div className="mx-1 h-8 w-px self-center bg-slate-200" />
                
                <div className="flex items-center gap-1">
                  {colors.map(c => (
                    <button
                      key={c}
                      onClick={() => setTool(t => ({ ...t, color: c, type: "pencil" }))}
                      className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-110 ${
                        tool.color === c && tool.type === "pencil"
                          ? "border-teal-500 ring-2 ring-teal-200 scale-110"
                          : "border-white shadow-sm"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  {/* Custom color */}
                  <label className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-[10px] font-bold text-slate-400 transition hover:border-slate-400 hover:text-slate-500" title="Custom color">
                    +
                    <input
                      type="color"
                      value={tool.color}
                      onChange={e => setTool(t => ({ ...t, color: e.target.value, type: "pencil" }))}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>

                <div className="mx-1 h-8 w-px self-center bg-slate-200" />

                {/* Brush size */}
                <div className="flex items-center gap-1">
                  {[4, 8, 16].map((w) => (
                    <button
                      key={w}
                      onClick={() => setTool(t => ({ ...t, width: w }))}
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                        tool.width === w ? "bg-slate-200" : "hover:bg-slate-100"
                      }`}
                      title={`${w}px`}
                    >
                      <div
                        className="rounded-full bg-slate-700"
                        style={{ width: Math.max(2, w / 1.5), height: Math.max(2, w / 1.5) }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Shape Menu Trigger */}
          <div className="relative flex">
            <ToolBtn
              active={["rectangle", "ellipse", "arrow", "line"].includes(tool.type)}
              onClick={() => setActiveMenu(activeMenu === "shape" ? null : "shape")}
              title="Shapes (R)"
            >
              {tool.type === "ellipse" ? <Circle className="h-4 w-4" /> : tool.type === "arrow" ? <ArrowRight className="h-4 w-4" /> : tool.type === "line" ? <Minus className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </ToolBtn>

            {/* Shape Popover */}
            {activeMenu === "shape" && (
              <div className="absolute left-[calc(100%+8px)] top-0 flex w-max rounded-xl border border-slate-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md gap-1">
                <ToolBtn active={tool.type === "rectangle"} onClick={() => setTool(t => ({ ...t, type: "rectangle" }))} title="Rectangle (R)">
                  <Square className="h-4 w-4" />
                </ToolBtn>
                <ToolBtn active={tool.type === "ellipse"} onClick={() => setTool(t => ({ ...t, type: "ellipse" }))} title="Ellipse (C)">
                  <Circle className="h-4 w-4" />
                </ToolBtn>
                <ToolBtn active={tool.type === "arrow"} onClick={() => setTool(t => ({ ...t, type: "arrow" }))} title="Arrow (A)">
                  <ArrowRight className="h-4 w-4" />
                </ToolBtn>
                <ToolBtn active={tool.type === "line"} onClick={() => setTool(t => ({ ...t, type: "line" }))} title="Line (L)">
                  <Minus className="h-4 w-4" />
                </ToolBtn>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-auto my-1 h-px w-5 bg-slate-200" />

          {/* Actions */}
          <ToolBtn
            active={false}
            onClick={() => socket?.emit("undo-request")}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            active={false}
            onClick={() => socket?.emit("redo-request")}
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </ToolBtn>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
            onClick={() => {
              if (confirm("Clear the entire canvas?")) {
                socket?.emit("clear-canvas");
              }
            }}
            title="Clear Canvas"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── Floating zoom controls (bottom center) ──       */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md">
          <button
            onClick={() => zoomFns?.setZoom((zoomPercent / 100) / 1.25)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          <input
            type="range"
            min={10}
            max={500}
            value={zoomPercent}
            onChange={e => zoomFns?.setZoom(Number(e.target.value) / 100)}
            className="w-32 cursor-pointer accent-teal-600"
          />

          <button
            onClick={() => zoomFns?.setZoom((zoomPercent / 100) * 1.25)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => zoomFns?.resetView()}
            className="ml-0.5 min-w-[3rem] rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
            title="Reset to 100%"
          >
            {zoomPercent}%
          </button>
        </div>
      </div>

      {/* Floating chat (renders its own toggle button + panel) */}
      <ChatSidebar messages={messages} onSend={sendMessage} me={user.name} />
    </main>
  );
}

/* ── Toolbar button component ── */
function ToolBtn({
  active,
  onClick,
  title,
  children
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        active
          ? "bg-teal-50 text-teal-600 shadow-sm ring-1 ring-teal-200"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function readUser() {
  if (typeof window === "undefined") return { id: "server", name: "Guest", color: "#2563eb" };

  try {
    const saved = JSON.parse(localStorage.getItem("whiteboard-user") || "{}");
    const user = {
      id: saved.id || crypto.randomUUID(),
      name: saved.name || "",
      color: saved.color || "#2563eb"
    };
    localStorage.setItem("whiteboard-user", JSON.stringify(user));
    return user;
  } catch {
    const user = { id: crypto.randomUUID(), name: "Guest", color: "#2563eb" };
    localStorage.setItem("whiteboard-user", JSON.stringify(user));
    return user;
  }
}
