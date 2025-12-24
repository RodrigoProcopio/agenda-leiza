import { toUtcISOString } from "./time.js";
import { hasConflict } from "./conflicts.js";

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildWeeklyRecurringEvents({
  baseEvent,
  startDate,
  startTime,
  endTime,
  weekdays,
  untilDate,
  existingEvents,
  uidFn,
  maxOccurrences = 200, // ✅ trava de segurança
}) {
  const events = [];
  const weekdaySet = new Set(weekdays || []);
  if (!weekdaySet.size) return { ok: true, events: [] };

  let cursor = startDate;

  // varre do startDate até untilDate
  while (cursor <= untilDate) {
    const dow = new Date(`${cursor}T00:00:00`).getDay();

    if (weekdaySet.has(dow)) {
      const startISO = toUtcISOString(cursor, startTime);
      const endISO = toUtcISOString(cursor, endTime);

      const candidate = { type: baseEvent.type, startISO, endISO };
      const conflict = hasConflict(candidate, existingEvents, null);

      if (conflict) return { ok: false, conflictWith: conflict };

      events.push({
        id: uidFn(),
        ...baseEvent,
        startISO,
        endISO,
      });

      if (events.length > maxOccurrences) {
        return { ok: false, tooMany: true, max: maxOccurrences };
      }
    }

    cursor = addDaysYmd(cursor, 1);
  }

  return { ok: true, events };
}
