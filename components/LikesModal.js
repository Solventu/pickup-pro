"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Heart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Avatar from "./Avatar";

// Lists every user who liked a given post. Opens from the like count on a post.
// Rows link to the liker's profile. Loads lazily when opened.
export default function LikesModal({ open, postId, onClose }) {
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
    if (!open || !postId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: likes } = await supabase
        .from("post_likes")
        .select("user_id")
        .eq("post_id", postId);
      const ids = [...new Set((likes || []).map((l) => l.user_id).filter(Boolean))];
      if (!ids.length) {
        if (active) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids);
      if (active) {
        setRows(profs || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, postId]);

  const goTo = (id) => {
    onClose?.();
    router.push(`/athletes/${id}`);
  };

  if (!open) return null;

  return (
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
            <Heart size={16} className="text-accent" aria-hidden /> Likes
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
            <p className="mono p-6 text-center text-sm text-muted">No likes yet</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    onClick={() => goTo(row.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/5"
                  >
                    <Avatar
                      username={row.username}
                      avatarUrl={row.avatar_url}
                      size={40}
                    />
                    <span className="truncate font-medium text-fg">
                      @{row.username || "unknown"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
