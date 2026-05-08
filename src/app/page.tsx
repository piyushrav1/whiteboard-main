"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");
  const accent = useMemo(() => randomColor(), []);

  async function createRoom() {
    setBusy("create");
    setError("");

    try {
      saveUser(name, accent);
      const response = await fetch("/api/rooms", { method: "POST" });
      if (!response.ok) throw new Error("Could not create a room");
      const data = await response.json();
      router.push(`/room/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) return setError("Enter a 6-digit room code");

    setBusy("join");
    setError("");

    try {
      saveUser(name, accent);
      const response = await fetch(`/api/rooms?code=${clean}`);
      const data = await response.json();
      if (!response.ok || !data.exists) throw new Error("Room not found");
      router.push(`/room/${clean}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that room");
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Stream-Sync</p>
            <h1 className="max-w-2xl text-5xl font-semibold leading-tight text-slate-950 md:text-7xl">
              Collaborative whiteboard
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Sketch together with live strokes, named cursors, persistent chat, undo history, snapshots, and exports.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
            <label className="text-sm font-medium text-slate-700" htmlFor="name">
              Display name
            </label>
            <input
              id="name"
              className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              maxLength={32}
              placeholder="Ada"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <button
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              disabled={busy !== null}
              onClick={createRoom}
            >
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create room
            </button>

            <div className="my-5 h-px bg-slate-200" />

            <form onSubmit={joinRoom}>
              <label className="text-sm font-medium text-slate-700" htmlFor="code">
                Join with code
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="code"
                  inputMode="numeric"
                  className="h-12 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-lg tracking-[0.28em] outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white transition hover:bg-teal-700 disabled:opacity-60"
                  disabled={busy !== null}
                  aria-label="Join room"
                >
                  {busy === "join" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                </button>
              </div>
            </form>

            {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function saveUser(name: string, color: string) {
  const current = JSON.parse(localStorage.getItem("whiteboard-user") || "{}");
  localStorage.setItem("whiteboard-user", JSON.stringify({ id: current.id || crypto.randomUUID(), name: name.trim() || "Guest", color }));
}

function randomColor() {
  const colors = ["#0f766e", "#2563eb", "#be123c", "#7c3aed", "#ca8a04", "#0891b2"];
  return colors[Math.floor(Math.random() * colors.length)];
}
