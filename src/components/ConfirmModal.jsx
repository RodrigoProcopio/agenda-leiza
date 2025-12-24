import React from "react";
import Modal from "./Modal.jsx";

export default function ConfirmModal({
  open,
  title,
  description,
  primaryText,
  secondaryText,
  onPrimary,
  onSecondary,
  onClose,
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="text-sm text-slate-700 dark:text-slate-200">{description}</div>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-800"
            onClick={onSecondary}
          >
            {secondaryText}
          </button>
          <button
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-white"
            onClick={onPrimary}
          >
            {primaryText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
