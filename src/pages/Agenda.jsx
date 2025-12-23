import React, { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { parseLocalDateTimeString } from "../lib/time.js";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";

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

export default function Agenda({ events, onOpen }) {
  const calendarRef = useRef(null);

  const fcEvents = useMemo(() => {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: parseLocalDateTimeString(e.startISO),
      end: parseLocalDateTimeString(e.endISO),
      backgroundColor: typeColor(e.type),
      borderColor: typeColor(e.type),
      extendedProps: e,
    }));
  }, [events]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    const api = calendarRef.current?.getApi?.();
    if (!api) return;

    const t = setTimeout(() => {
      api.scrollToTime(scrollTimeFromNow(60));
    }, 150);

    return () => clearTimeout(t);
  }, [isMobile]);

  return (
    <div className="mx-auto max-w-4xl p-2 pb-24 md:p-4 md:pb-6">
    <div className="mt-2 h-[calc(100dvh-240px)] rounded-2xl border border-sky-200/60 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/40">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          timeZone="local"
          locales={[ptBrLocale]}
          locale="pt-br"
          initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
          headerToolbar={{
            left: "prev,next",
            center: "title",
            right: "today",
          }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          nowIndicator={true}
          scrollTime={scrollTimeFromNow(60)}
          scrollTimeReset={false}
          height="100%"
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          events={fcEvents}
          eventClick={(info) => onOpen(info.event.extendedProps)}
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

      <div className="mt-3 px-2 text-xs text-slate-500 dark:text-slate-300 md:px-0">
        Dica: toque em um bloco para editar.
      </div>
    </div>
  );
}
