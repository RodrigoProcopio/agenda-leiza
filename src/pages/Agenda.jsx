// src/pages/Agenda.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { parseLocalDateTimeString } from "../lib/time.js";

function typeColor(type) {
  if (type === "consultorio") return "#2563eb";
  if (type === "cirurgia") return "#dc2626";
  return "#16a34a";
}

function scrollTimeFromNow(offsetMinutes = 60) {
  const d = new Date();
  d.setMinutes(d.getMinutes() - offsetMinutes);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

const VIEWS = [
  { id: "timeGridDay", label: "Dia" },
  { id: "timeGridWeek", label: "Sem" },
  { id: "dayGridMonth", label: "Mês" },
];

export default function Agenda({ events, onOpen }) {
  const calendarRef = useRef(null);
  const [view, setView] = useState("timeGridDay");
  const [title, setTitle] = useState("");

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Se quiser: no desktop abrir semana por padrão
  useEffect(() => {
    setView(isMobile ? "timeGridDay" : "timeGridWeek");
  }, [isMobile]);

const fcEvents = useMemo(() => {
  return (events || []).map((e) => ({
    id: e.id,
    title: e.title,
    // ✅ ISO do Supabase tem timezone -> Date(iso) é o certo
    start: new Date(e.startISO),
    end: new Date(e.endISO),
    backgroundColor: typeColor(e.type),
    borderColor: typeColor(e.type),
    extendedProps: e,
  }));
}, [events]);

  function getApi() {
    return calendarRef.current?.getApi?.();
  }

  function syncTitle() {
    const api = getApi();
    if (!api) return;
    setTitle(api.view?.title || "");
  }

  function goPrev() {
    const api = getApi();
    if (!api) return;
    api.prev();
    syncTitle();
  }

  function goNext() {
    const api = getApi();
    if (!api) return;
    api.next();
    syncTitle();
  }

  function goToday() {
    const api = getApi();
    if (!api) return;
    api.today();
    syncTitle();

    // scroll só faz sentido no day/week
    if (view !== "dayGridMonth") {
      api.scrollToTime(scrollTimeFromNow(60));
    }
  }

  function changeView(nextView) {
    const api = getApi();
    setView(nextView);
    if (!api) return;

    api.changeView(nextView);
    syncTitle();

    if (nextView !== "dayGridMonth") {
      // pequeno delay pro DOM renderizar
      setTimeout(() => api.scrollToTime(scrollTimeFromNow(60)), 120);
    }
  }

  // Quando o calendário monta/troca datas/view, atualiza título
  useEffect(() => {
    const api = getApi();
    if (!api) return;

    // garante título inicial
    const t = setTimeout(() => syncTitle(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="mx-auto max-w-4xl p-2 pb-24 md:p-4 md:pb-6">
      <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
        {/* Toolbar do APP (mobile-friendly) */}
        <div className="px-1 pb-2 pt-1">
          {/* Linha 1 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                aria-label="Anterior"
                title="Anterior"
              >
                ‹
              </button>
              <button
                onClick={goNext}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                aria-label="Próximo"
                title="Próximo"
              >
                ›
              </button>
            </div>

            <div className="min-w-0 flex-1 px-1 text-center">
              <div className="truncate text-[0.95rem] font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </div>
            </div>

            <button
              onClick={goToday}
              className="h-9 rounded-full border border-sky-200 bg-sky-100 px-3 text-xs font-bold text-sky-900 hover:bg-sky-200
                         dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
            >
              Hoje
            </button>
          </div>

          {/* Linha 2: Segmentado */}
          <div className="mt-2 flex justify-center">
            <div className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-900/50">
              {VIEWS.map((v) => {
                const active = view === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => changeView(v.id)}
                    className={[
                      "px-3 py-2 text-xs font-bold rounded-2xl transition",
                      active
                        ? "bg-slate-900 text-white shadow-sm dark:bg-slate-200 dark:text-slate-900"
                        : "text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800/60",
                    ].join(" ")}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Altura com scroll interno */}
        <div className="h-[calc(100dvh-290px)] rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-transparent">
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            timeZone="local"
            locales={[ptBrLocale]}
            locale="pt-br"

            // ✅ some com a toolbar padrão (vamos usar a nossa)
            headerToolbar={false}

            initialView={view}
            nowIndicator={true}
            height="100%"
            allDaySlot={false}

            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            slotDuration="00:30:00"
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}

            // scroll “agora - 60min” (day/week)
            scrollTime={scrollTimeFromNow(60)}
            scrollTimeReset={false}

            events={fcEvents}
            eventClick={(info) => onOpen(info.event.extendedProps)}
            datesSet={() => syncTitle()}
            eventDidMount={(info) => {
              const end = info.event.end;
              if (!end) return;
              const past = end.getTime() < Date.now();
              if (past) {
                info.el.style.opacity = "0.45";
                info.el.style.filter = "grayscale(0.25)";
              }
            }}
          />
        </div>
      </div>

      <div className="mt-3 px-2 text-xs text-slate-500 md:px-0">
        Dica: toque em um bloco para editar.
      </div>
    </div>
  );
}
