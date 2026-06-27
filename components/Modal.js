"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children }) {
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

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-muted transition-colors hover:text-fg"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
