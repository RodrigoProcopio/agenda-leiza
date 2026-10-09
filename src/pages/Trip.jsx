import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTripStatus, setTripItemDone } from "../lib/tripApi.js";
import { localTodayKey } from "../lib/time.js";
import TripChecklist from "./TripChecklist.jsx";

const REFRESH_MS = 60 * 1000;

const card =
  "rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40";

// ---------------------------------------------------------------
// Formatação do texto do roteiro
// Quebra o texto em parágrafos antes de rótulos como "Como ir:",
// "O que ver e fazer:", "Opiniões:", "Para decidir:" e deixa o rótulo
// em negrito. URLs viram links.
// ---------------------------------------------------------------
const LABEL_RE =
  /(^|[.!?)]\s+)([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9’'&/()\- ]{1,48}?):\s/g;

function splitParagraphs(text) {
  if (!text) return [];
  const parts = [];
  let last = 0;
  let m;
  LABEL_RE.lastIndex = 0;
  while ((m = LABEL_RE.exec(text))) {
    const labelStart = m.index + m[1].length;
    // Evita quebrar em horários (ex.: "04:00:") e em rótulos muito longos
    if (/^\d/.test(m[2])) continue;
    if (labelStart > last) {
      parts.push({ label: null, body: text.slice(last, labelStart).trim() });
    }
    parts.push({ label: m[2], body: "" });
    last = labelStart + m[2].length + 1;
  }
  parts.push({ label: null, body: text.slice(last).trim() });

  // Junta rótulo com o texto que vem logo depois
  const out = [];
  for (const p of parts) {
    if (p.label !== null) {
      out.push({ label: p.label, body: "" });
    } else if (out.length && out[out.length - 1].body === "" && out[out.length - 1].label) {
      out[out.length - 1].body = p.body;
    } else if (p.body) {
      out.push({ label: null, body: p.body });
    }
  }
  return out.filter((p) => p.label || p.body);
}

function Linkified({ text }) {
  const pieces = text.split(/(https?:\/\/[^\s)]+)/g);
  return pieces.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a
        key={i}
        href={p.replace(/[.,;]$/, "")}
        target="_blank"
        rel="noreferrer"
        className="break-all text-sky-700 underline dark:text-sky-300"
      >
        {p}
      </a>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
}

function RichText({ text, className = "" }) {
  const paras = useMemo(() => splitParagraphs(text), [text]);
  return (
    <div className={"space-y-1.5 " + className}>
      {paras.map((p, i) => (
        <p key={i}>
          {p.label && (
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {p.label}:{" "}
            </span>
          )}
          <Linkified text={p.body} />
        </p>
      ))}
    </div>
  );
}

function telHref(s) {
  return "tel:" + s.replace(/[^\d+]/g, "");
}

function ContactLine({ text }) {
  const pieces = text.split(/(\+\d[\d ]{7,}\d)/g);
  return (
    <span>
      {pieces.map((p, i) =>
        /^\+\d/.test(p) ? (
          <a key={i} href={telHref(p)} className="text-sky-700 underline dark:text-sky-300">
            {p}
          </a>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </span>
  );
}

// ---------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------
function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-slate-600 dark:text-slate-300">
        <span>
          {done} de {total} atividades feitas
        </span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: pct + "%" }}
        />
      </div>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false, accent = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={
        "rounded-xl border " +
        (accent
          ? "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/5"
          : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40")
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="px-3 pb-3 text-sm text-slate-700 dark:text-slate-300">{children}</div>}
    </div>
  );
}

function ActivityCard({ item, status, onToggle, saving }) {
  const done = !!status?.done;
  return (
    <div
      className={
        card +
        " transition " +
        (done ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5" : "")
      }
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(item.key, !done)}
          disabled={saving}
          aria-pressed={done}
          aria-label={done ? "Desmarcar como feito" : "Marcar como feito"}
          className={
            "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition " +
            (done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 bg-white text-transparent hover:border-emerald-500 dark:border-slate-600 dark:bg-slate-900") +
            (saving ? " opacity-50" : "")
          }
        >
          ✓
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-sky-700 dark:text-sky-300">{item.time}</div>
          <div
            className={
              "text-base font-semibold text-slate-900 dark:text-slate-50 " +
              (done ? "line-through decoration-emerald-600/60" : "")
            }
          >
            {item.title}
          </div>
          {done && status?.doneAt && (
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Feito em{" "}
              {new Date(status.doneAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}

          {item.details && (
            <RichText
              text={item.details}
              className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
            />
          )}

          {item.panoramas?.length > 0 && (
            <div className="mt-3 space-y-2">
              {item.panoramas.map((p, i) => (
                <Collapsible key={i} title={"Panorama — " + p.title}>
                  <RichText text={p.body} className="leading-relaxed" />
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Página
// ---------------------------------------------------------------
export default function Trip({ trip, toast }) {
  const data = trip?.data;
  const days = data?.days || [];

  const [status, setStatus] = useState({});
  const [saving, setSaving] = useState({});
  const [hideDone, setHideDone] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const initialDay = useMemo(() => {
    const today = localTodayKey();
    const found = days.find((d) => d.date === today);
    return found ? found.n : days[0]?.n ?? 1;
  }, [days]);
  const [dayN, setDayN] = useState(initialDay);
  // "checklist" = o que levar/providenciar; "geral" = voos, plano e contatos
  const [view, setView] = useState("dia");

  const load = useCallback(async () => {
    if (!trip?.id) return;
    try {
      const map = await fetchTripStatus(trip.id);
      setStatus(map);
      setLoadError(null);
    } catch (e) {
      console.error("Erro ao carregar status da viagem:", e);
      setLoadError("Não foi possível carregar o progresso.");
    }
  }, [trip?.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  async function toggle(key, done) {
    const prev = status[key];
    setStatus((s) => ({
      ...s,
      [key]: { done, doneAt: done ? new Date().toISOString() : null },
    }));
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await setTripItemDone(trip.id, key, done);
    } catch (e) {
      console.error(e);
      setStatus((s) => ({ ...s, [key]: prev }));
      toast?.show?.("Não foi possível salvar. Tente novamente.", { type: "error" });
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  const allItems = useMemo(() => days.flatMap((d) => d.items), [days]);
  const doneTotal = allItems.filter((i) => status[i.key]?.done).length;

  const day = days.find((d) => d.n === dayN) || days[0];
  const dayDone = day ? day.items.filter((i) => status[i.key]?.done).length : 0;
  const visibleItems = day
    ? day.items.filter((i) => !(hideDone && status[i.key]?.done))
    : [];

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl p-4 pb-24 text-sm text-slate-600 dark:text-slate-300">
        Nenhum roteiro disponível.
      </div>
    );
  }

  const [d, m] = (day?.date || "").split("-").slice(1).reverse();

  return (
    <div className="mx-auto max-w-2xl p-4 pb-28 md:pb-8">
      {/* Cabeçalho do roteiro */}
      <div className={card + " border-sky-200 dark:border-sky-500/20"}>
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          {data.title}
        </div>
        <div className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-50">
          {data.subtitle}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {data.couple} · {data.period}
        </div>
        <div className="mt-3">
          <ProgressBar done={doneTotal} total={allItems.length} />
        </div>
        {loadError && <div className="mt-2 text-xs text-red-600">{loadError}</div>}
      </div>

      {/* Alternância Dia a dia / Informações gerais */}
      <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-sky-100/80 p-1 dark:bg-slate-900/70">
        {[
          ["dia", "Dia a dia"],
          ["checklist", "Checklist"],
          ["compras", "Compras"],
          ["geral", "Voos e contatos"],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={
              "rounded-lg px-1 py-1.5 text-[13px] leading-tight transition sm:px-3 sm:text-sm " +
              (view === v
                ? "bg-white font-semibold text-blue-700 shadow dark:bg-slate-800 dark:text-sky-300"
                : "text-slate-600 dark:text-slate-300")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {view === "checklist" && (
        <TripChecklist
          trip={trip}
          list={data.checklist}
          itemPrefix="c:"
          status={status}
          saving={saving}
          onToggle={toggle}
          toast={toast}
        />
      )}

      {view === "compras" && (
        <TripChecklist
          trip={trip}
          list={data.shopping}
          itemPrefix="s:"
          status={status}
          saving={saving}
          onToggle={toggle}
          toast={toast}
        />
      )}

      {view === "geral" && (
        <div className="mt-3 space-y-3">
          <div className={card}>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Voos</h2>
            <div className="mt-2 space-y-3">
              {data.flights.map((f, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-50">{f.route}</div>
                    <div className="text-xs font-semibold text-sky-700 dark:text-sky-300">{f.when}</div>
                  </div>
                  {f.flights && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{f.flights}</div>
                  )}
                  <RichText
                    text={f.details}
                    className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                  />
                </div>
              ))}
            </div>
            {data.notes?.map((n, i) => (
              <div
                key={i}
                className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-slate-700 dark:bg-sky-500/10 dark:text-slate-200"
              >
                <RichText text={n.replace(/^Fuso horário\.\s*/, "Fuso horário: ")} />
              </div>
            ))}
          </div>

          {data.priorities?.length > 0 && (
            <div className={card}>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                {data.prioritiesTitle}
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {data.priorities.map((p, i) => (
                  <li key={i}>
                    <RichText text={p} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.contacts?.length > 0 && (
            <div className={card}>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                {data.contactsTitle}
              </h2>
              <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {data.contacts.map((c, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/60">
                    <ContactLine text={c} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {view === "dia" && day && (
        <>
          {/* Seletor de dias */}
          <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
            <div className="flex gap-2">
              {days.map((dd) => {
                const total = dd.items.length;
                const doneN = dd.items.filter((i) => status[i.key]?.done).length;
                const complete = total > 0 && doneN === total;
                const active = dd.n === day.n;
                const [, mm, dday] = dd.date.split("-");
                return (
                  <button
                    key={dd.n}
                    type="button"
                    onClick={() => setDayN(dd.n)}
                    className={
                      "flex min-w-[64px] flex-col items-center rounded-xl border px-2 py-1.5 text-xs transition " +
                      (active
                        ? "border-sky-600 bg-sky-600 text-white shadow"
                        : complete
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200")
                    }
                  >
                    <span className="font-semibold">Dia {dd.n}</span>
                    <span>
                      {dday}/{mm}
                    </span>
                    <span className={active ? "text-sky-100" : "text-slate-400"}>
                      {complete ? "✓" : `${doneN}/${total}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cabeçalho do dia */}
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {day.city} · {day.weekday} {d}/{m}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Dia {day.n} — {day.title}
            </h2>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {dayDone} de {day.items.length} feitas neste dia
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hideDone}
                  onChange={(e) => setHideDone(e.target.checked)}
                  className="h-4 w-4 accent-sky-600"
                />
                Ocultar feitas
              </label>
            </div>
          </div>

          {/* Atividades */}
          <div className="mt-3 space-y-3">
            {visibleItems.map((item) => (
              <ActivityCard
                key={item.key}
                item={item}
                status={status[item.key]}
                saving={!!saving[item.key]}
                onToggle={toggle}
              />
            ))}
            {visibleItems.length === 0 && (
              <div className={card + " text-center text-sm text-emerald-700 dark:text-emerald-300"}>
                Todas as atividades deste dia foram feitas. ✓
              </div>
            )}
          </div>

          {/* Navegação entre dias */}
          <div className="mt-4 flex justify-between gap-2">
            <button
              type="button"
              disabled={day.n === days[0].n}
              onClick={() => {
                setDayN(day.n - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900"
            >
              ← Dia anterior
            </button>
            <button
              type="button"
              disabled={day.n === days[days.length - 1].n}
              onClick={() => {
                setDayN(day.n + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900"
            >
              Próximo dia →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
