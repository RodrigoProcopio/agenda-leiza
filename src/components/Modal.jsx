import React from "react";

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <button
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={onClose}
      />

      {/* conteúdo */}
      <div
        className="
          absolute inset-x-0 bottom-0 rounded-t-2xl
          border border-slate-200 bg-white text-slate-900 shadow-xl
          md:inset-0 md:m-auto md:max-w-lg md:rounded-2xl
          dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50
          p-4
        "
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
