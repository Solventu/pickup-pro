"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatDate, formatTime } from "@/lib/helpers";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";

const WELCOME = {
  role: "assistant",
  welcome: true,
  content:
    "Bună ziua. Spuneți-mi ce sport căutați și când sunteți disponibil — vă recomand cele mai potrivite evenimente din Timișoara.",
};

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function now() {
  return new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

// Render text with bare URLs turned into clickable links that open in a new tab.
const URL_RE = /(https?:\/\/[^\s)]+)/g;
function RichText({ text }) {
  const parts = String(text).split(URL_RE);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        URL_RE.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function EventMiniCard({ event, onFlyTo }) {
  const spots =
    event.max_players != null
      ? Math.max(0, event.max_players - (event.players || 0))
      : null;
  return (
    <div className="mt-2 rounded-lg border border-line bg-bg p-3">
      <div className="flex items-center gap-2">
        {event.sport && <span className="badge badge-sport">{event.sport}</span>}
        <span className="truncate text-sm font-medium text-fg">{event.title}</span>
      </div>
      <p className="mono mt-1.5 text-xs text-muted">
        {formatDate(event.date)}
        {event.time && ` · ${formatTime(event.time)}`}
        {event.location && ` · ${event.location}`}
      </p>
      {spots != null && (
        <p className="mono mt-1 text-xs text-accent">{spots} locuri disponibile</p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button onClick={() => onFlyTo(event)} className="btn btn-outline text-xs">
          Vezi pe hartă
        </button>
        {event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-muted text-xs"
          >
            Vezi detalii oficiale
          </a>
        )}
      </div>
    </div>
  );
}

export default function EventChatbot() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the slide-up transition
  const [messages, setMessages] = useState([{ ...WELCOME, ts: "" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Slide-up animation: mount, then transition to the shown state next tick.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), 10);
    setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // Auto-scroll to the latest message / loading indicator.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const flyTo = (event) => {
    setOpen(false);
    if (typeof window === "undefined") return;
    if (pathname === "/") {
      window.__pickupFlyEvent = event;
      window.dispatchEvent(new CustomEvent("pickup:fly-to-event"));
    } else {
      // Coming from another page — stash the target and let the home page pick
      // it up once its map mounts.
      try {
        sessionStorage.setItem("pickup:fly", JSON.stringify(event));
      } catch {}
      router.push("/");
    }
  };

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, ts: now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    // Send the last 10 real turns (drop the canned welcome) for context.
    const history = next
      .filter((m) => !m.welcome)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply || "Îmi pare rău, am întâmpinat o eroare. Încearcă din nou.",
          events: Array.isArray(data.events) ? data.events : [],
          ts: now(),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Îmi pare rău, am întâmpinat o eroare. Încearcă din nou.", ts: now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // The chatbot is a logged-in feature: /api/chat now requires authentication,
  // so don't render the widget at all for guests (avoids a broken 401 launcher).
  if (!user) return null;

  return (
    <>
      {/* Floating launcher (hidden while the panel is open) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Deschide asistentul PickupPro"
          className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-2xl transition-transform hover:scale-105"
        >
          <ChatIcon />
        </button>
      )}

      {open && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex h-[520px] max-h-[calc(100vh-2.5rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-2xl transition-all duration-300 ${
            shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
          role="dialog"
          aria-label="PickupPro Assistant"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="live-dot" aria-hidden />
            <p className="flex-1 text-sm font-semibold text-fg">PickupPro Assistant</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Minimizează"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-fg"
            >
              <span className="text-lg leading-none">–</span>
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Închide"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-fg"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-card p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-accent text-white" : "bg-line text-fg"
                  }`}
                >
                  <RichText text={m.content} />
                </div>

                {/* Event cards under a bot recommendation */}
                {m.role === "assistant" && m.events?.length > 0 && (
                  <div className="mt-1 w-[85%]">
                    {m.events.map((ev) => (
                      <EventMiniCard key={ev.id} event={ev} onFlyTo={flyTo} />
                    ))}
                  </div>
                )}

                {m.ts && <span className="mono mt-1 px-1 text-[0.65rem] text-muted">{m.ts}</span>}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="flex gap-1 rounded-2xl bg-line px-3 py-3" aria-label="Se încarcă">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Întreabă despre evenimente sportive..."
              className="field-input flex-1"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary shrink-0">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
