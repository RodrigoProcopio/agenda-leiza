import React, { useMemo } from "react";

export default function Finance({ events, onTogglePaid }) {
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

  const monthSurgeries = useMemo(() => {
    return events.filter(
      (e) => e.type === "cirurgia" && e.surgery && e.startISO.slice(0, 7) === monthKey
    );
  }, [events, monthKey]);

  const toReceive = monthSurgeries
    .filter((e) => e.surgery.payStatus === "a_receber")
    .reduce((acc, e) => acc + (Number(e.surgery.value) || 0), 0);

  const received = monthSurgeries
    .filter((e) => e.surgery.payStatus === "recebido")
    .reduce((acc, e) => acc + (Number(e.surgery.value) || 0), 0);

  const card =
    "rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur dark:bg-slate-900/40 dark:border-slate-800";

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-6">
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="text-xs font-semibold text-rose-800 dark:text-rose-200">A receber</div>
          <div className="mt-1 text-lg font-semibold text-rose-900 dark:text-rose-50">
            R$ {toReceive.toLocaleString("pt-BR")}
          </div>
          <div className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/70">Pendências do mês</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Recebido</div>
          <div className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-50">
            R$ {received.toLocaleString("pt-BR")}
          </div>
          <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/70">Confirmados no mês</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {monthSurgeries.length === 0 && (
          <div className={[card, "text-sm text-slate-600 dark:text-slate-300"].join(" ")}>
            Nenhuma cirurgia registrada neste mês.
          </div>
        )}

        {monthSurgeries
          .slice()
          .sort((a, b) => new Date(b.startISO) - new Date(a.startISO))
          .map((e) => {
            const paid = e.surgery.payStatus === "recebido";
            return (
              <div key={e.id} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    {e.location || "Local não informado"}
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    R$ {Number(e.surgery.value || 0).toLocaleString("pt-BR")}
                  </div>
                </div>

                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {new Date(e.startISO).toLocaleDateString("pt-BR")}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    Status:{" "}
                    <b className={paid ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}>
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
