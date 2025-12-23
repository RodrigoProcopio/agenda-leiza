import React, { useMemo } from "react";
import {
  toMs,
  localDayKeyFromIso,
  localTodayKey,
  formatHHMMFromIso,
} from "../lib/time.js";

function badge(type) {
  if (type === "consultorio")
    return "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/20";
  if (type === "cirurgia")
    return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/20";
  return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/20";
}

function typeLabel(type) {
  if (type === "consultorio") return "Consultório";
  if (type === "cirurgia") return "Cirurgia";
  return "Pessoal";
}

function isPast(ev) {
  const end = new Date(ev.endISO);
  return end.getTime() < Date.now();
}

function isOngoing(ev) {
  const now = Date.now();
  const start = new Date(ev.startISO).getTime();
  const end = new Date(ev.endISO).getTime();
  return start <= now && end >= now;
}

export default function Today({ events, onOpen }) {
  const todayKey = localTodayKey();

  const todayEvents = useMemo(() => {
  const list = (events || []).filter(
    (e) => localDayKeyFromIso(e.startISO) === todayKey
  );

  const upcomingOrNow = [];
  const past = [];

  for (const e of list) {
    (isPast(e) ? past : upcomingOrNow).push(e);
  }

  // Futuro/Agora primeiro (crescente)
  upcomingOrNow.sort((a, b) => toMs(a.startISO) - toMs(b.startISO));

  // Passados no final (mais recente primeiro)
  past.sort((a, b) => toMs(b.startISO) - toMs(a.startISO));

  return [...upcomingOrNow, ...past];
}, [events, todayKey]);

  // ✅ Evento em andamento (AGORA)
  const ongoingEvent = useMemo(() => {
    return todayEvents.find((e) => isOngoing(e)) || null;
  }, [todayEvents]);

  // ✅ Próximo evento futuro (sempre o próximo, mesmo se existir AGORA)
  const nextEvent = useMemo(() => {
    const nowMs = Date.now();
    return todayEvents.find((e) => toMs(e.startISO) > nowMs) || null;
  }, [todayEvents]);

  // ✅ Card principal: AGORA (se existir) senão PRÓXIMO
  const primary = ongoingEvent || nextEvent;

  // ✅ IDs que já estão destacados em cima (não repetir na lista)
  const hiddenIds = useMemo(() => {
    const s = new Set();
    if (primary?.id) s.add(primary.id);

    // se existe "AGORA" e existe "PRÓXIMO" diferente, também não repete o PRÓXIMO
    if (ongoingEvent && nextEvent && nextEvent.id !== ongoingEvent.id) {
      s.add(nextEvent.id);
    }
    return s;
  }, [primary?.id, ongoingEvent?.id, nextEvent?.id]);

  // ✅ Lista sem duplicados
  const listEvents = useMemo(() => {
    return todayEvents.filter((e) => !hiddenIds.has(e.id));
  }, [todayEvents, hiddenIds]);

  const cardBase =
    "rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur dark:bg-slate-900/40 dark:border-slate-800";
  const cardStrong =
    "rounded-2xl border bg-white p-4 shadow-md dark:bg-slate-900/55 dark:border-slate-800";

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-6">
      {/* Card principal */}
      {primary && (
        <div
          className={[
            cardStrong,
            "mt-2 border-sky-200 dark:border-sky-500/20",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <div
              className={[
                "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold text-white",
                primary.id === ongoingEvent?.id
                  ? "bg-emerald-600"
                  : "bg-sky-600",
              ].join(" ")}
            >
              {primary.id === ongoingEvent?.id ? "AGORA" : "PRÓXIMO"}
            </div>

            <div className="text-sm text-slate-700 dark:text-slate-200">
              {formatHHMMFromIso(primary.startISO)}–
              {formatHHMMFromIso(primary.endISO)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div
              className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badge(
                primary.type
              )}`}
            >
              {typeLabel(primary.type)}
            </div>

            <button
              onClick={() => onOpen(primary)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                         dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-100 dark:hover:bg-slate-800/50"
            >
              Editar
            </button>
          </div>

          <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
            {primary.title || "(Sem título)"}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {primary.location || ""}
          </div>

          {primary.type === "cirurgia" && primary.surgery && (
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">
                R$ {Number(primary.surgery.value || 0).toLocaleString("pt-BR")}
              </span>
              <span className="ml-2 text-slate-600 dark:text-slate-400">
                •{" "}
                {primary.surgery.payStatus === "recebido"
                  ? "Recebido"
                  : "A receber"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Card secundário: PRÓXIMO (se existir AGORA e existir PRÓXIMO diferente) */}
      {ongoingEvent && nextEvent && nextEvent.id !== ongoingEvent.id && (
        <div className={[cardBase, "mt-3"].join(" ")}>
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center rounded-full bg-sky-600 px-2 py-1 text-xs font-semibold text-white">
              PRÓXIMO
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-200">
              {formatHHMMFromIso(nextEvent.startISO)}–
              {formatHHMMFromIso(nextEvent.endISO)}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div
              className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badge(
                nextEvent.type
              )}`}
            >
              {typeLabel(nextEvent.type)}
            </div>

            <button
              onClick={() => onOpen(nextEvent)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                         dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-100 dark:hover:bg-slate-800/50"
            >
              Editar
            </button>
          </div>

          <div className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
            {nextEvent.title || "(Sem título)"}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {nextEvent.location || ""}
          </div>
        </div>
      )}

      {/* Lista do dia (sem repetir os cards de cima) */}
      <div className="mt-4 space-y-2">
        {listEvents.length === 0 && (
          <div
            className={[
              cardBase,
              "text-sm text-slate-600 dark:text-slate-300",
            ].join(" ")}
          >
            Nenhum outro compromisso hoje.
          </div>
        )}

        {listEvents.map((e) => {
          const past = isPast(e);
          const ongoing = ongoingEvent?.id === e.id;

          return (
            <button
              key={e.id}
              onClick={() => onOpen(e)}
              className={[
                "w-full text-left",
                cardBase,
                past ? "opacity-50" : "opacity-100",
                ongoing
                  ? "ring-2 ring-emerald-200 dark:ring-emerald-500/20"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badge(
                    e.type
                  )}`}
                >
                  {typeLabel(e.type)}
                </div>

                <div className="text-sm text-slate-700 dark:text-slate-200">
                  {formatHHMMFromIso(e.startISO)}–{formatHHMMFromIso(e.endISO)}
                </div>
              </div>

              <div className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
                {e.title || "(Sem título)"}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {e.location || ""}
              </div>

              {e.type === "cirurgia" && e.surgery && (
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-medium">
                    R$ {Number(e.surgery.value || 0).toLocaleString("pt-BR")}
                  </span>
                  <span className="ml-2 text-slate-600 dark:text-slate-400">
                    •{" "}
                    {e.surgery.payStatus === "recebido"
                      ? "Recebido"
                      : "A receber"}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
