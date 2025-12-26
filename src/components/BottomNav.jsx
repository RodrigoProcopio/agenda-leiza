import React from "react";

export default function BottomNav({ tab, setTab }) {
  const item =
    "flex flex-col items-center justify-center flex-1 rounded-xl px-2 py-2 text-sm transition";

  const active =
    "text-blue-600 dark:text-sky-300 font-semibold bg-white dark:bg-slate-900 shadow";

  const inactive =
    "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-900/60";

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-sky-100/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-2xl items-center gap-1 px-2 py-1">

        <button
          className={item + " " + (tab === "today" ? active : inactive)}
          onClick={() => setTab("today")}
        >
          Hoje
        </button>

        <button
          className={item + " " + (tab === "agenda" ? active : inactive)}
          onClick={() => setTab("agenda")}
        >
          Agenda
        </button>

        <button
          className={item + " " + (tab === "finance" ? active : inactive)}
          onClick={() => setTab("finance")}
        >
          Financeiro
        </button>

        <button
          className={item + " " + (tab === "settings" ? active : inactive)}
          onClick={() => setTab("settings")}
        >
          Configurações
        </button>

      </div>
    </nav>
  );
}
