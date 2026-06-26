"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { enrichComments } from "@/lib/posts";
import { timeAgo } from "@/lib/helpers";
import { cleanText, LIMITS } from "@/lib/sanitize";
import Avatar from "./Avatar";

export default function CommentThread({ postId, currentUser, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      const enriched = await enrichComments(data || []);
      if (active) {
        setComments(enriched);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    const content = cleanText(text, LIMITS.comment);
    if (!content || !currentUser || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: currentUser.id, content })
      .select()
      .single();
    setSending(false);
    if (!error && data) {
      const [enriched] = await enrichComments([data]);
      setComments((c) => [...c, enriched]);
      setText("");
      onCountChange?.(1);
    }
  };

  const remove = async (id) => {
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (!error) {
      setComments((c) => c.filter((x) => x.id !== id));
      onCountChange?.(-1);
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      {loading ? (
        <p className="mono text-xs text-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="mono text-xs text-muted">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => {
            const author = c.author || {};
            const isOwner = currentUser && currentUser.id === c.user_id;
            return (
              <li key={c.id} className="flex gap-2.5">
                <Avatar
                  username={author.username}
                  avatarUrl={author.avatar_url}
                  size={28}
                  href={author.id ? `/athletes/${author.id}` : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={author.id ? `/athletes/${author.id}` : "#"}
                      className="text-sm font-medium text-fg hover:text-accent"
                    >
                      @{author.username || "unknown"}
                    </Link>
                    <span className="mono text-[0.65rem] text-muted">
                      {timeAgo(c.created_at)}
                    </span>
                    {isOwner && (
                      <button
                        onClick={() => remove(c.id)}
                        className="mono ml-auto text-[0.65rem] text-muted hover:text-red-400"
                      >
                        delete
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-fg/90">
                    {c.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {currentUser ? (
        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            className="field-input flex-1"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="btn btn-primary"
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      ) : (
        <p className="mono mt-3 text-xs text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>{" "}
          to comment.
        </p>
      )}
    </div>
  );
}
