import React from "react";
import { formatDateBRFromIso } from "../lib/time.js";

export default function Header({ title, showDate = true, onLogout }) {
  const today = new Date().toISOString();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-sky-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">

          {/* Esquerda */}
          <div>
            <div className="text-sm font-medium text-blue-900 dark:text-sky-200">
              Dra. Leiza Hollas
            </div>

            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {title}
            </h1>

            {showDate && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {formatDateBRFromIso(today)}
              </div>
            )}
          </div>

          {/* Direita – somente logout agora */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLogout}
              title="Sair"
              className="rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
            >
              ⏻
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
