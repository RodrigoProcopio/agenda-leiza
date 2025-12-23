import React from "react";

export default function BottomNav({ tab, setTab }) {
  const item = (id, label) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 py-3 text-sm ${
        tab === id
          ? "font-semibold text-blue-600"
          : "text-slate-600 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white md:hidden">
      <div className="flex">
        {item("today", "Hoje")}
        {item("agenda", "Agenda")}
        {item("finance", "Financeiro")}
      </div>
    </div>
  );
}
