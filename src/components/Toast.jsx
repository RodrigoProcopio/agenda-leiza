import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (message, { type = "info", duration = 4000, actionLabel, onAction } = {}) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type, actionLabel, onAction }]);

      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss]
  );

  const api = { show, dismiss };

  const colors = {
    info: "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    error:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${colors[t.type] || colors.info}`}
          >
            <span className="flex-1">{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="shrink-0 font-semibold underline underline-offset-2"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback seguro caso usado fora do provider (não deveria acontecer)
    return {
      show: (msg) => window.alert(msg),
      dismiss: () => {},
    };
  }
  return ctx;
}
