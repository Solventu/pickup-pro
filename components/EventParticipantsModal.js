"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Avatar from "./Avatar";

// Lists everyone who joined an event. Opens from the player count on a card.
// Accounts the viewer follows are shown first and visually highlighted, mirroring
// the "Going: …" line on the card. Loads lazily when opened.
export default function EventParticipantsModal({ open, eventId, currentUser, onClose }) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !eventId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: parts } = await supabase
        .from("event_participants")
        .select("user_id")
        .eq("event_id", eventId);
      const ids = [...new Set((parts || []).map((p) => p.user_id).filter(Boolean))];
      if (!ids.length) {
        if (active) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      // Which of these the viewer follows (accepted), to float them to the top.
      const followed = new Set();
      if (currentUser) {
        const { data: fl } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id)
          .eq("status", "accepted")
          .in("following_id", ids);
        (fl || []).forEach((f) => followed.add(f.following_id));
      }

      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids);

      const list = (profs || [])
        .map((p) => ({ ...p, isFollowed: followed.has(p.id) }))
        // Followed first, then alphabetical for a stable order.
        .sort((a, b) => {
          if (a.isFollowed !== b.isFollowed) return a.isFollowed ? -1 : 1;
          return (a.username || "").localeCompare(b.username || "");
        });

      if (active) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, eventId, currentUser?.id]);

  const goTo = (id) => {
    onClose?.();
    router.push(`/athletes/${id}`);
  };

  if (!open || typeof document === "undefined") return null;

  // Portal to <body> so the fixed overlay isn't positioned relative to a
  // transformed ancestor (the framer-motion event card), which made it flash in
  // the wrong place for a moment before settling.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h3 className="flex items-center gap-2 text-lg font-medium text-fg">
            <Users size={16} className="text-accent" aria-hidden /> Going
            {rows.length > 0 && (
              <span className="mono text-sm text-muted">· {rows.length}</span>
            )}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted transition-colors hover:text-fg"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="mono p-4 text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mono p-6 text-center text-sm text-muted">
              No one has joined yet
            </p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    onClick={() => goTo(row.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/5 ${
                      row.isFollowed ? "bg-accent/5" : ""
                    }`}
                  >
                    <Avatar
                      username={row.username}
                      avatarUrl={row.avatar_url}
                      size={40}
                    />
                    <span className="truncate font-medium text-fg">
                      {row.username || "unknown"}
                    </span>
                    {row.isFollowed && (
                      <span className="mono ml-auto shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-accent">
                        Following
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
