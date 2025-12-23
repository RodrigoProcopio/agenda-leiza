import React from "react";
import { formatDateBRFromIso } from "../lib/time.js";

export default function Header({
  title,
  showDate = true,
  theme,
  onToggleTheme,
  onLogout,
}) {
  const isDark = theme === "dark";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-sky-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          {/* Esquerda */}
          <div>
            <div className="text-sm font-medium text-blue-900 dark:text-sky-200">
              Dra. Leiza Hollas
            </div>

            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h1>

            {showDate && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {formatDateBRFromIso(new Date().toISOString())}
              </div>
            )}
          </div>

{/* Direita */}
<div className="flex flex-col items-end gap-1 pt-1">
  {/* Sair */}
  {onLogout && (
<button
  type="button"
  onClick={onLogout}
  title="Sair"
  aria-label="Sair"
  className="
    inline-flex items-center justify-center
    h-9 w-9
    rounded-full
    text-rose-600
    hover:bg-rose-50
    active:scale-95
    transition
    dark:text-rose-300
    dark:hover:bg-rose-500/10
  "
>
  ⏻
</button>

  )}

  {/* Switch tema */}
  <button
    type="button"
    onClick={onToggleTheme}
    aria-label="Alternar tema"
    title="Alternar tema"
    className={[
      "relative inline-flex h-6 w-11 items-center rounded-full border shadow-sm transition",
      isDark
        ? "bg-slate-900 border-slate-800"
        : "bg-white border-slate-200",
    ].join(" ")}
  >
    {/* Ícone fixo */}
    <span
      className={[
        "absolute left-2 text-[10px] leading-none select-none",
        isDark ? "text-slate-200" : "text-slate-700",
      ].join(" ")}
    >
      {isDark ? "☾" : "☀︎"}
    </span>

    {/* Bolinha */}
    <span
      className={[
        "inline-block h-5 w-5 rounded-full shadow transition-transform",
        isDark
          ? "translate-x-[22px] bg-slate-200"
          : "translate-x-[2px] bg-slate-900",
      ].join(" ")}
    />
  </button>
</div>
        </div>
      </div>
    </header>
  );
}
