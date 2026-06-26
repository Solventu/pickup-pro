"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

// Minimal toast system: call toast("message") to show a transient notification
// at the bottom-center of the screen. Auto-dismisses after 3s.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message) => {
    if (!message) return;
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, message }]);
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="toast-item pointer-events-auto rounded-lg border border-line bg-card px-4 py-2.5 text-center text-sm font-medium text-fg shadow-xl"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
