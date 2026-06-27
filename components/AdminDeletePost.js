"use client";

import { useState } from "react";
import Modal from "./Modal";
import { deletePostAsAdmin } from "@/lib/posts";
import { useToast } from "@/lib/ToastProvider";

function TrashIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

// Admin-only "delete any post" control. Two looks:
//   - variant="icon":   small red trash, revealed on hover (feed cards / grids)
//   - variant="button": full red button (post detail modal)
// Both open the same confirmation and call /api/admin/delete-post, which
// re-verifies the caller is the admin before deleting. onDeleted(postId) lets
// the parent remove the post optimistically.
export default function AdminDeletePost({
  postId,
  onDeleted,
  variant = "icon",
  className = "",
}) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Stop the click from bubbling to a parent (e.g. a clickable post tile).
  const open = (e) => {
    e?.stopPropagation();
    e?.preventDefault();
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deletePostAsAdmin(postId);
      setConfirmOpen(false);
      onDeleted?.(postId);
      toast("Post deleted.");
    } catch (err) {
      toast(err?.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={open}
          aria-label="Delete post (admin)"
          className={`flex items-center justify-center rounded-md p-1 text-[#ef4444] opacity-0 transition-opacity hover:bg-[#ef4444]/10 focus-visible:opacity-100 group-hover:opacity-100 ${className}`}
        >
          <TrashIcon size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className={`btn btn-danger-solid mt-4 w-full ${className}`}
        >
          Delete post
        </button>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title="Delete post"
      >
        <p className="text-sm text-muted">
          Delete this post as an admin? This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setConfirmOpen(false)}
            className="btn btn-muted"
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            onClick={doDelete}
            className="btn btn-danger-solid"
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
