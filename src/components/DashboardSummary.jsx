import React, { useEffect, useMemo, useState } from "react";
import { pad2, localYmdFromIso } from "../lib/time.js";
import { fetchExpenses } from "../lib/expensesApi.js";

function monthKeyOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function prevMonthKeyOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return monthKeyOf(d);
}

// Segunda a domingo da semana que contém "hoje"
function weekRange(date) {
  const dow = date.getDay(); // 0=domingo
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function asMoneyBRL(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DashboardSummary({ events, patients, ownerId }) {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    fetchExpenses(ownerId)
      .then((list) => {
        if (!cancelled) setExpenses(list || []);
      })
      .catch((err) => console.error("Erro ao carregar despesas do painel:", err));
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthKey = monthKeyOf(now);
    const prevMonthKey = prevMonthKeyOf(now);
    const { start: weekStart, end: weekEnd } = weekRange(now);

    const surgeries = (events || [])
      .filter(Boolean)
      .filter((e) => e.type === "cirurgia" && e.surgery);

    let receivedThisMonth = 0;
    let receivedPrevMonth = 0;
    let totalPending = 0;

    for (const e of surgeries) {
      const mk = localYmdFromIso(e.startISO).slice(0, 7);
      const value = Number(e.surgery?.value || 0);
      const paid = e.surgery?.payStatus === "recebido";

      if (paid && mk === currentMonthKey) receivedThisMonth += value;
      if (paid && mk === prevMonthKey) receivedPrevMonth += value;
      if (!paid) totalPending += value;
    }

    const deltaPct =
      receivedPrevMonth > 0
        ? Math.round(
            ((receivedThisMonth - receivedPrevMonth) / receivedPrevMonth) * 100
          )
        : null;

    const weekAppointments = (events || []).filter((e) => {
      if (!e) return false;
      const t = new Date(e.startISO).getTime();
      return t >= weekStart.getTime() && t <= weekEnd.getTime();
    }).length;

    const newPatients = (patients || []).filter(
      (p) => p.createdAt && p.createdAt.slice(0, 7) === currentMonthKey
    ).length;

    const expensesThisMonth = (expenses || [])
      .filter((e) => (e.expenseDate || "").startsWith(currentMonthKey))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const margin = receivedThisMonth - expensesThisMonth;

    return {
      receivedThisMonth,
      deltaPct,
      totalPending,
      weekAppointments,
      newPatients,
      expensesThisMonth,
      margin,
    };
  }, [events, patients, expenses]);

  const card =
    "rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900";
  const label = "text-xs text-slate-500 dark:text-slate-400";
  const value = "text-lg font-bold text-slate-900 dark:text-slate-50";

  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className={card}>
        <div className={label}>Receita do mês</div>
        <div className={`${value} text-emerald-600 dark:text-emerald-400`}>
          R$ {asMoneyBRL(stats.receivedThisMonth)}
        </div>
        {stats.deltaPct !== null && (
          <div
            className={`text-[11px] ${
              stats.deltaPct >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {stats.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(stats.deltaPct)}% vs mês anterior
          </div>
        )}
      </div>

      <div className={card}>
        <div className={label}>A receber (total)</div>
        <div className={`${value} text-rose-600 dark:text-rose-400`}>
          R$ {asMoneyBRL(stats.totalPending)}
        </div>
      </div>

      <div className={card}>
        <div className={label}>Compromissos na semana</div>
        <div className={value}>{stats.weekAppointments}</div>
      </div>

      <div className={card}>
        <div className={label}>Novos pacientes (mês)</div>
        <div className={value}>{stats.newPatients}</div>
      </div>

      <div className={card}>
        <div className={label}>Despesas do mês</div>
        <div className={`${value} text-rose-600 dark:text-rose-400`}>
          R$ {asMoneyBRL(stats.expensesThisMonth)}
        </div>
      </div>

      <div className={card}>
        <div className={label}>Margem do mês</div>
        <div
          className={`${value} ${
            stats.margin >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          R$ {asMoneyBRL(stats.margin)}
        </div>
      </div>
    </div>
  );
}
