import React, { useMemo, useState, useEffect } from "react";
import { pad2, localYmdFromIso } from "../lib/time.js";
import { setFinanceFilters } from "../lib/financeFiltersStore.js";

function monthKeyTodayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function monthLabelPtBR(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const [monthName, , year] = label.split(" ");
  const cap = monthName
    ? monthName.charAt(0).toUpperCase() + monthName.slice(1)
    : monthKey;
  return `${cap}/${year || y}`;
}

function asMoneyBRL(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Finance({ events, onTogglePaid, onOpen }) {
  const [monthKey, setMonthKey] = useState(monthKeyTodayLocal);
  const [statusFilter, setStatusFilter] = useState("todos"); // "todos" | "a_receber" | "recebido"

  // Lista segura de cirurgias (remove qualquer undefined antes)
  const surgeriesAll = useMemo(() => {
    return (events || [])
      .filter(Boolean)
      .filter((e) => e.type === "cirurgia" && e.surgery);
  }, [events]);

  // Meses disponíveis com base nas cirurgias
  const monthKeys = useMemo(() => {
    const set = new Set(
      surgeriesAll.map((e) => localYmdFromIso(e.startISO).slice(0, 7))
    );

    // Se não tiver cirurgia ainda, garante mês atual
    if (set.size === 0) {
      set.add(monthKey);
    }

    return Array.from(set).sort();
  }, [surgeriesAll, monthKey]);

  const monthSurgeries = useMemo(() => {
    return surgeriesAll.filter((e) => {
      const ymd = localYmdFromIso(e.startISO);
      return ymd.startsWith(monthKey);
    });
  }, [surgeriesAll, monthKey]);

  const filteredSurgeries = useMemo(() => {
    if (statusFilter === "todos") return monthSurgeries;
    if (statusFilter === "recebido") {
      return monthSurgeries.filter(
        (e) => e.surgery?.payStatus === "recebido"
      );
    }
    if (statusFilter === "a_receber") {
      return monthSurgeries.filter(
        (e) => e.surgery?.payStatus !== "recebido"
      );
    }
    return monthSurgeries;
  }, [monthSurgeries, statusFilter]);

  const totals = useMemo(() => {
    let received = 0;
    let toReceive = 0;

    for (const e of monthSurgeries) {
      const value = Number(e.surgery?.value || 0);
      if (!value) continue;
      if (e.surgery?.payStatus === "recebido") received += value;
      else toReceive += value;
    }
    return { received, toReceive };
  }, [monthSurgeries]);

  // Exportação precisa saber mês + status atuais
  useEffect(() => {
    const [yStr, mStr] = monthKey.split("-");
    const year = Number(yStr) || null;
    const month = Number(mStr) || null;

    setFinanceFilters({
      year,
      month,
      status: statusFilter, // "todos" | "a_receber" | "recebido"
    });
  }, [monthKey, statusFilter]);

  const card =
    "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <h2 className="mb-3 text-lg font-semibold"></h2>

      <div className="flex flex-wrap gap-2">
        <select
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {monthKeys.map((mk) => (
            <option key={mk} value={mk}>
              {monthLabelPtBR(mk)}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <option value="todos">Todos</option>
          <option value="a_receber">A receber</option>
          <option value="recebido">Recebido</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={card}>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Recebido
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            R$ {asMoneyBRL(totals.received)}
          </div>
        </div>

        <div className={card}>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            A receber
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
            R$ {asMoneyBRL(totals.toReceive)}
          </div>
        </div>

        <div className={card}>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Qtd. cirurgias
          </div>
          <div className="text-xl font-bold">
            {monthSurgeries.length}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filteredSurgeries.length === 0 && (
          <div
            className={[
              card,
              "text-sm text-slate-600 dark:text-slate-300",
            ].join(" ")}
          >
            Nenhuma cirurgia encontrada para este filtro.
          </div>
        )}

        {filteredSurgeries
          .slice()
          .sort(
            (a, b) => new Date(b.startISO) - new Date(a.startISO)
          )
          .map((e) => {
            const paid = e.surgery.payStatus === "recebido";
            const dateLabel = new Date(
              e.startISO
            ).toLocaleDateString("pt-BR");

            const title = e.surgery?.title || e.title || "Cirurgia";

            return (
              <div
                key={e.id}
                className={card + " cursor-pointer"}
                onClick={() => onOpen && onOpen(e)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{title}</div>
                  </div>

                  <div className="text-right text-lg font-bold">
                    R$ {asMoneyBRL(e.surgery?.value || 0)}
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
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onTogglePaid(e.id);
                    }}
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-semibold transition",
                      paid
                        ? "border border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                        : "border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15",
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
