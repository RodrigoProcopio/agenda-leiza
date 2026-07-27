import React, { useCallback, useEffect, useMemo, useState } from "react";
import { pad2, localYmdFromIso } from "../lib/time.js";
import { setFinanceFilters } from "../lib/financeFiltersStore.js";
import {
  PAYMENT_METHODS,
  fetchPaymentsForEvent,
  addPayment,
  deletePayment,
} from "../lib/paymentsApi.js";
import {
  fetchExpenses,
  addExpense,
  deleteExpense,
} from "../lib/expensesApi.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";

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

function shortMonthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function asMoneyBRL(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lastNMonthKeys(n) {
  const now = new Date();
  const list = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }
  return list;
}

export default function Finance({ events, onTogglePaid, onOpen, ownerId, canEdit = true }) {
  const toast = useToast();
  const [monthKey, setMonthKey] = useState(monthKeyTodayLocal);
  const [statusFilter, setStatusFilter] = useState("todos"); // "todos" | "a_receber" | "recebido"
  const [expandedId, setExpandedId] = useState(null);
  const [receiptEvent, setReceiptEvent] = useState(null);

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

    // Garante que o mês atualmente selecionado sempre apareça nas opções,
    // mesmo que não haja cirurgias nele (senão o <select> cai no primeiro
    // mês da lista em vez de mostrar o mês corrente).
    set.add(monthKey);

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

  // Gráfico simples de receita (recebida) dos últimos 6 meses
  const revenueChart = useMemo(() => {
    const keys = lastNMonthKeys(6);
    const byMonth = new Map(keys.map((k) => [k, 0]));

    for (const e of surgeriesAll) {
      if (e.surgery?.payStatus !== "recebido") continue;
      const key = localYmdFromIso(e.startISO).slice(0, 7);
      if (byMonth.has(key)) {
        byMonth.set(key, byMonth.get(key) + Number(e.surgery?.value || 0));
      }
    }

    const max = Math.max(1, ...Array.from(byMonth.values()));
    return keys.map((k) => ({
      key: k,
      label: shortMonthLabel(k),
      value: byMonth.get(k) || 0,
      pct: Math.round(((byMonth.get(k) || 0) / max) * 100),
    }));
  }, [surgeriesAll]);

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

      {/* Gráfico de receita (últimos 6 meses) */}
      <div className={`${card} mt-3`}>
        <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Receita recebida — últimos 6 meses
        </div>
        <div className="flex items-end gap-3" style={{ height: 96 }}>
          {revenueChart.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end">
                <div
                  className="w-full rounded-t-md bg-sky-500 dark:bg-sky-400"
                  style={{ height: `${Math.max(m.pct, m.value > 0 ? 4 : 0)}%` }}
                  title={`R$ ${asMoneyBRL(m.value)}`}
                />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{m.label}</div>
            </div>
          ))}
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
            const expanded = expandedId === e.id;

            return (
              <div key={e.id} className={card}>
                <div
                  className="cursor-pointer"
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
                    {e.createdByName && (
                      <span className="text-slate-400"> · {e.createdByName}</span>
                    )}
                  </div>

                  {!!e.notes && (
                    <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      {e.notes}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setExpandedId(expanded ? null : e.id);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-100 dark:hover:bg-slate-800/50"
                    >
                      {expanded ? "Ocultar pagamentos" : "Pagamentos"}
                    </button>

                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setReceiptEvent(e);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-100 dark:hover:bg-slate-800/50"
                    >
                      Recibo
                    </button>

                    {canEdit && (
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
                    )}
                  </div>
                </div>

                {expanded && (
                  <PaymentsPanel
                    event={e}
                    ownerId={ownerId}
                    canEdit={canEdit}
                  />
                )}
              </div>
            );
          })}
      </div>

      {/* Despesas do mês */}
      {canEdit && (
        <ExpensesSection ownerId={ownerId} monthKey={monthKey} card={card} />
      )}

      <ReceiptModal event={receiptEvent} onClose={() => setReceiptEvent(null)} />
    </div>
  );
}

// -----------------------------------------------------------------------
//   PAGAMENTOS PARCIAIS DE UMA CIRURGIA
// -----------------------------------------------------------------------
function PaymentsPanel({ event, ownerId, canEdit }) {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchPaymentsForEvent(event.id);
      setPayments(list || []);
    } catch (err) {
      console.error("Erro ao carregar pagamentos:", err);
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments]
  );
  const totalValue = Number(event.surgery?.value || 0);
  const remaining = Math.max(0, totalValue - totalPaid);

  async function handleAdd(e) {
    e.preventDefault();
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) return;

    try {
      setSaving(true);
      await addPayment(ownerId, event.id, { amount: value, method, paidAt });
      setAmount("");
      await load();
      toast.show("Pagamento registrado.", { type: "success" });
    } catch (err) {
      console.error("Erro ao registrar pagamento:", err);
      toast.show("Erro ao registrar pagamento.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p) {
    try {
      await deletePayment(p.id);
      await load();
    } catch (err) {
      console.error("Erro ao remover pagamento:", err);
      toast.show("Erro ao remover pagamento.", { type: "error" });
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span>Total: R$ {asMoneyBRL(totalValue)}</span>
        <span>Pago: R$ {asMoneyBRL(totalPaid)}</span>
        <span className={remaining > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}>
          Restante: R$ {asMoneyBRL(remaining)}
        </span>
      </div>

      {loading && <p className="text-xs text-slate-500">Carregando...</p>}

      {!loading && payments.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nenhum pagamento registrado ainda.
        </p>
      )}

      <div className="space-y-1">
        {payments.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg bg-white px-2 py-1 dark:bg-slate-900"
          >
            <span>
              R$ {asMoneyBRL(p.amount)} ·{" "}
              {PAYMENT_METHODS.find((m) => m.id === p.method)?.label || p.method} ·{" "}
              {p.paidAt ? new Date(p.paidAt + "T00:00:00").toLocaleDateString("pt-BR") : ""}
              {p.createdByName && (
                <span className="text-slate-400"> · {p.createdByName}</span>
              )}
            </span>
            {canEdit && (
              <button
                onClick={() => handleDelete(p)}
                className="text-xs text-red-500 hover:underline"
              >
                remover
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Valor"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-600 px-2 py-1 text-sm font-medium text-white hover:bg-sky-700"
          >
            Adicionar
          </button>
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
//   DESPESAS
// -----------------------------------------------------------------------
function ExpensesSection({ ownerId, monthKey, card }) {
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("outro");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!ownerId) return;
    try {
      setLoading(true);
      const list = await fetchExpenses(ownerId);
      setExpenses(list || []);
    } catch (err) {
      console.error("Erro ao carregar despesas:", err);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  const monthExpenses = useMemo(
    () => expenses.filter((e) => (e.expenseDate || "").startsWith(monthKey)),
    [expenses, monthKey]
  );

  const totalMonth = useMemo(
    () => monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [monthExpenses]
  );

  async function handleAdd(e) {
    e.preventDefault();
    const value = Number(String(amount).replace(",", "."));
    if (!title.trim() || !value || value <= 0) return;

    try {
      setSaving(true);
      await addExpense(ownerId, { title: title.trim(), category, amount: value, expenseDate });
      setTitle("");
      setAmount("");
      await load();
      toast.show("Despesa registrada.", { type: "success" });
    } catch (err) {
      console.error("Erro ao registrar despesa:", err);
      toast.show("Erro ao registrar despesa.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e) {
    try {
      await deleteExpense(e.id);
      await load();
    } catch (err) {
      console.error("Erro ao remover despesa:", err);
      toast.show("Erro ao remover despesa.", { type: "error" });
    }
  }

  return (
    <div className={`${card} mt-4`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Despesas do mês
        </span>
        <span className="text-sm font-bold text-rose-600 dark:text-rose-300">
          R$ {asMoneyBRL(totalMonth)}
        </span>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Descrição"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="material">Material</option>
          <option value="aluguel">Aluguel</option>
          <option value="equipe">Equipe</option>
          <option value="marketing">Marketing</option>
          <option value="outro">Outro</option>
        </select>
        <input
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Valor"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="date"
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 rounded-lg bg-sky-600 px-2 py-1 text-sm font-medium text-white hover:bg-sky-700 sm:col-span-1"
        >
          Adicionar
        </button>
      </form>

      <div className="mt-3 space-y-1">
        {loading && <p className="text-xs text-slate-500">Carregando...</p>}
        {!loading && monthExpenses.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhuma despesa neste mês.
          </p>
        )}

        {monthExpenses.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-800"
          >
            <span>
              {e.title} · R$ {asMoneyBRL(e.amount)} ·{" "}
              {e.expenseDate
                ? new Date(e.expenseDate + "T00:00:00").toLocaleDateString("pt-BR")
                : ""}
              {e.createdByName && (
                <span className="text-slate-400"> · {e.createdByName}</span>
              )}
            </span>
            <button onClick={() => handleDelete(e)} className="text-xs text-red-500 hover:underline">
              remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
//   RECIBO (imprimível / salvar como PDF pelo navegador)
// -----------------------------------------------------------------------
function ReceiptModal({ event, onClose }) {
  if (!event) return null;

  const title = event.surgery?.title || event.title || "Procedimento";
  const value = Number(event.surgery?.value || 0);
  const dateLabel = new Date(event.startISO).toLocaleDateString("pt-BR");
  const paid = event.surgery?.payStatus === "recebido";

  return (
    <Modal open={!!event} title="Recibo" onClose={onClose}>
      <div id="print-receipt" className="space-y-2 text-sm">
        <div className="text-center">
          <div className="text-base font-semibold">Dra. Leiza Hollas</div>
          <div className="text-xs text-slate-500">Recibo de atendimento</div>
        </div>

        <hr className="my-2 border-slate-200 dark:border-slate-700" />

        <div>
          <b>Procedimento:</b> {title}
        </div>
        <div>
          <b>Data:</b> {dateLabel}
        </div>
        <div>
          <b>Valor:</b> R$ {asMoneyBRL(value)}
        </div>
        <div>
          <b>Status:</b> {paid ? "Pago" : "Pendente"}
        </div>

        <hr className="my-2 border-slate-200 dark:border-slate-700" />
        <div className="text-xs text-slate-500">
          Documento gerado pelo sistema da agenda em{" "}
          {new Date().toLocaleDateString("pt-BR")}.
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Fechar
        </button>
        <button
          onClick={() => window.print()}
          className="flex-1 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          Imprimir / Salvar PDF
        </button>
      </div>
    </Modal>
  );
}
