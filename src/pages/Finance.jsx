import React, { useMemo, useState } from "react";
import { pad2, localYmdFromIso } from "../lib/time.js";

function monthKeyTodayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`; // YYYY-MM (local)
}

function monthLabelPtBR(monthKey) {
  // monthKey: YYYY-MM
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, (m - 1), 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  // "dezembro de 2025" -> "Dezembro/2025"
  const [monthName, , year] = label.split(" ");
  const cap = monthName ? monthName.charAt(0).toUpperCase() + monthName.slice(1) : monthKey;
  return `${cap}/${year || y}`;
}

function asMoneyBRL(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Finance({ events, onTogglePaid }) {
  const [monthKey, setMonthKey] = useState(monthKeyTodayLocal);

  const surgeriesAll = useMemo(() => {
    return (events || []).filter((e) => e.type === "cirurgia" && e.surgery);
  }, [events]);

  const availableMonths = useMemo(() => {
    const set = new Set();

    // Sempre inclui o mês atual, mesmo sem cirurgias
    set.add(monthKeyTodayLocal());

    for (const e of surgeriesAll) {
      const ymdLocal = localYmdFromIso(e.startISO);
      set.add(ymdLocal.slice(0, 7));
    }

    // ordena desc (mais recente primeiro)
    return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [surgeriesAll]);

  const monthSurgeries = useMemo(() => {
    return surgeriesAll.filter((e) => localYmdFromIso(e.startISO).slice(0, 7) === monthKey);
  }, [surgeriesAll, monthKey]);

  const toReceive = useMemo(() => {
    return monthSurgeries
      .filter((e) => e.surgery.payStatus === "a_receber")
      .reduce((acc, e) => acc + (Number(e.surgery.value) || 0), 0);
  }, [monthSurgeries]);

  const received = useMemo(() => {
    return monthSurgeries
      .filter((e) => e.surgery.payStatus === "recebido")
      .reduce((acc, e) => acc + (Number(e.surgery.value) || 0), 0);
  }, [monthSurgeries]);

  const card =
    "rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur dark:bg-slate-900/40 dark:border-slate-800";

  function goPrevMonth() {
    const idx = availableMonths.indexOf(monthKey);
    if (idx < 0) return;
    const next = availableMonths[idx + 1];
    if (next) setMonthKey(next);
  }

  function goNextMonth() {
    const idx = availableMonths.indexOf(monthKey);
    if (idx <= 0) return;
    const prev = availableMonths[idx - 1];
    if (prev) setMonthKey(prev);
  }

  const canPrev = availableMonths.indexOf(monthKey) < availableMonths.length - 1;
  const canNext = availableMonths.indexOf(monthKey) > 0;

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-6">
      {/* Seletor de período */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={!canPrev}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 disabled:opacity-50"
        >
          ←
        </button>

        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Mês / Ano
          </label>
          <select
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
          >
            {availableMonths.map((mk) => (
              <option key={mk} value={mk}>
                {monthLabelPtBR(mk)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={goNextMonth}
          disabled={!canNext}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 disabled:opacity-50"
        >
          →
        </button>
      </div>

      {/* Cards totais */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="text-xs font-semibold text-rose-800 dark:text-rose-200">
            A receber
          </div>
          <div className="mt-1 text-lg font-semibold text-rose-900 dark:text-rose-50">
            R$ {asMoneyBRL(toReceive)}
          </div>
          <div className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/70">
            Pendências do período
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            Recebido
          </div>
          <div className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-50">
            R$ {asMoneyBRL(received)}
          </div>
          <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/70">
            Confirmados no período
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {monthSurgeries.length === 0 && (
          <div className={[card, "text-sm text-slate-600 dark:text-slate-300"].join(" ")}>
            Nenhuma cirurgia registrada neste período.
          </div>
        )}

        {monthSurgeries
          .slice()
          .sort((a, b) => new Date(b.startISO) - new Date(a.startISO))
          .map((e) => {
            const paid = e.surgery.payStatus === "recebido";
            const dateLabel = new Date(e.startISO).toLocaleDateString("pt-BR"); // local

            return (
              <div key={e.id} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    {e.location || "Local não informado"}
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    R$ {asMoneyBRL(e.surgery.value || 0)}
                  </div>
                </div>

                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {dateLabel}
                </div>

                {!!e.notes && (
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {e.notes}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    Status:{" "}
                    <b
                      className={
                        paid
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300"
                      }
                    >
                      {paid ? "Recebido" : "A receber"}
                    </b>
                  </span>

                  <button
                    onClick={() => onTogglePaid(e.id)}
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-semibold transition",
                      paid
                        ? "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15",
                    ].join(" ")}
                  >
                    {paid ? "Marcar A receber" : "Marcar Recebido"}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
