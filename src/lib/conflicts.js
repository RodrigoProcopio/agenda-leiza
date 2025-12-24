export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * candidate: { startISO, endISO }
 * events: lista de eventos com startISO/endISO
 * ignoreId: id a ignorar (edição do próprio, ou tmp-id)
 */
export function hasConflict(candidate, events, ignoreId) {
  if (!candidate?.startISO || !candidate?.endISO) return null;

  const cStart = new Date(candidate.startISO).getTime();
  const cEnd = new Date(candidate.endISO).getTime();
  if (!Number.isFinite(cStart) || !Number.isFinite(cEnd)) return null;

  for (const ev of events || []) {
    if (!ev?.startISO || !ev?.endISO) continue;

    // ✅ ignora o evento sendo editado (qualquer id, tmp ou real)
    if (ignoreId && ev.id === ignoreId) continue;

    const eStart = new Date(ev.startISO).getTime();
    const eEnd = new Date(ev.endISO).getTime();
    if (!Number.isFinite(eStart) || !Number.isFinite(eEnd)) continue;

    if (overlaps(cStart, cEnd, eStart, eEnd)) {
      return ev;
    }
  }

  return null;
}
