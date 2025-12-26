import React from "react";
import Modal from "./Modal.jsx";

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  secondaryLabel,
  onConfirm,
  onSecondary,
  onCancel,
}) {
  // Se quiser que o Modal controle sozinho o open, poderia remover esse if,
  // mas assim evitamos montar conteúdo à toa.
  if (!open) return null;

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="space-y-4">
        {description && (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {description}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {/* Cancelar (sempre aparece) */}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>

          {/* Botão secundário – só aparece se tiver label E handler */}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
            >
              {secondaryLabel}
            </button>
          )}

          {/* Botão principal (confirmar / excluir) */}
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
