import { isSameDay } from "./time.js";

/**
 * Retorna o evento conflitante ou null.
 *
 * Conflito quando:
 * candidateStart < existingEnd && candidateEnd > existingStart
 */
export function hasConflict(candidate, events, ignoreId = null) {
  const cStart = new Date(candidate.startISO).getTime();
  const cEnd = new Date(candidate.endISO).getTime();

  for (const ev of events) {
    if (ignoreId && ev.id === ignoreId) continue;
    if (!isSameDay(candidate.startISO, ev.startISO)) continue;

    const eStart = new Date(ev.startISO).getTime();
    const eEnd = new Date(ev.endISO).getTime();

    const overlap = cStart < eEnd && cEnd > eStart;
    if (overlap) return ev;
  }

  return null;
}
