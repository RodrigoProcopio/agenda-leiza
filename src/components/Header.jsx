import React from "react";
import { formatDateBR } from "../lib/time.js";

export default function Header({ title, showDate = true, theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-30 bg-sky-50/90 backdrop-blur dark:bg-slate-950/80">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-blue-900 dark:text-sky-200">
              Dra. Leiza Hollas
            </div>

            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h1>

            {showDate && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {formatDateBR(new Date().toISOString())}
              </div>
            )}
          </div>

          <button
            onClick={onToggleTheme}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label="Alternar tema"
            title="Alternar tema"
          >
            {theme === "dark" ? "☾ Dark" : "☀︎ Claro"}
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" />
    </header>
  );
}
