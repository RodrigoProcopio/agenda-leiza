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
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-xl md:inset-0 md:m-auto md:max-w-lg md:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
