"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import type { ChatMessage } from "@/types/whiteboard";

export function ChatSidebar({
  messages,
  onSend,
  me
}: {
  messages: ChatMessage[];
  onSend: (body: string) => void;
  me: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [unread, setUnread] = useState(0);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Track unread messages
  useEffect(() => {
    if (open) {
      // When panel is open, mark all as seen
      setUnread(0);
      setLastSeenCount(messages.length);
    } else {
      // When closed, count new messages since last seen
      const newCount = messages.length - lastSeenCount;
      if (newCount > 0) {
        setUnread(newCount);
      }
    }
  }, [messages.length, open, lastSeenCount]);

  // Auto-scroll when open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [messages, open]);

  function toggle() {
    setOpen((prev) => {
      if (!prev) {
        // Opening: mark all read
        setUnread(0);
        setLastSeenCount(messages.length);
      }
      return !prev;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    onSend(body);
    setBody("");
  }

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={toggle}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 ease-out ${
          open
            ? "bg-slate-800 text-white scale-90 rotate-90"
            : "bg-teal-600 text-white hover:bg-teal-700 hover:shadow-2xl hover:scale-105"
        }`}
        title={open ? "Close chat" : "Open chat"}
        style={{ boxShadow: open ? undefined : "0 8px 32px rgba(13,148,136,0.35)" }}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}

        {/* ── Notification badge ── */}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md animate-bounce-in">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* ── Backdrop (mobile) ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={toggle}
      />

      {/* ── Floating chat panel ── */}
      <aside
        className={`fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl transition-all duration-300 ease-out ${
          open
            ? "opacity-100 translate-y-0 scale-100"
            : "pointer-events-none opacity-0 translate-y-4 scale-95"
        }`}
        style={{ height: "min(480px, calc(100vh - 10rem))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Live Chat</h2>
            <p className="text-[11px] text-slate-500">{messages.length} messages</p>
          </div>
          <button
            onClick={toggle}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">No messages yet</p>
            </div>
          )}
          {messages.map((message) => {
            const own = message.author.name === me;
            return (
              <div key={message.id} className={own ? "ml-8 text-right" : "mr-8"}>
                <p className="mb-1 text-[10px] font-medium text-slate-400">{message.author.name}</p>
                <div
                  className={
                    own
                      ? "inline-block rounded-2xl rounded-tr-sm bg-teal-600 px-3 py-2 text-left text-sm text-white"
                      : "inline-block rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800"
                  }
                >
                  {message.body}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <form className="flex gap-2 border-t border-slate-100 bg-slate-50/50 p-3" onSubmit={submit}>
          <input
            className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            value={body}
            maxLength={1000}
            placeholder="Type a message..."
            onChange={(event) => setBody(event.target.value)}
          />
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition hover:bg-teal-700"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </>
  );
}
