"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import PostCard from "./PostCard";

export default function PostModal({ post, open, currentUser, onClose, onDeleted }) {
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

  if (!open || !post) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-card">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-muted backdrop-blur transition-colors hover:text-fg"
        >
          <X size={16} aria-hidden />
        </button>
        <div className="max-h-[90vh] overflow-y-auto p-5">
          <PostCard
            post={post}
            currentUser={currentUser}
            onDeleted={onDeleted}
            defaultShowComments
            inModal
          />
        </div>
      </div>
    </div>
  );
}
