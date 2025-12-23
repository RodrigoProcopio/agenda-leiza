import { toLocalDateTimeString } from "./time.js";
import { hasConflict } from "./conflicts.js";

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Gera eventos recorrentes semanais.
 * - startDate: YYYY-MM-DD (data base)
 * - weekdays: array de 0-6 (Dom=0 ... Sáb=6)
 * - untilDate: YYYY-MM-DD (inclusive)
 */
export function buildWeeklyRecurringEvents({
  baseEvent,
  startDate,
  startTime,
  endTime,
  weekdays,
  untilDate,
  existingEvents,
  uidFn,
}) {
  const start = new Date(`${startDate}T00:00:00`);
  const until = new Date(`${untilDate}T23:59:59`);

  const generated = [];

  for (let day = new Date(start); day <= until; day = addDays(day, 1)) {
    const dow = day.getDay();
    if (!weekdays.includes(dow)) continue;

    const dateStr = toYMD(day);

    const candidate = {
      type: baseEvent.type,
startISO: toLocalDateTimeString(dateStr, startTime),
endISO: toLocalDateTimeString(dateStr, endTime),
    };

    // valida conflito com eventos já existentes + os já gerados nesta operação
    const conflict = hasConflict(candidate, [...existingEvents, ...generated], null);
    if (conflict) {
      return {
        ok: false,
        conflict,
        conflictDate: dateStr,
        events: [],
      };
    }

    generated.push({
      id: uidFn(),
      ...baseEvent,
      startISO: candidate.startISO,
      endISO: candidate.endISO,
      recurrence: {
        kind: "weekly",
        weekdays,
        untilDate,
      },
    });
  }

  return { ok: true, events: generated };
}
