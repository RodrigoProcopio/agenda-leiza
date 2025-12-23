// src/lib/conflicts.js
import { toMs } from "./time.js";

export function hasConflict(candidate, events, excludeId) {
  if (!candidate?.startISO || !candidate?.endISO) return null;

  const cStart = toMs(candidate.startISO);
  const cEnd = toMs(candidate.endISO);

  // se datas inválidas, não acusa conflito
  if (!Number.isFinite(cStart) || !Number.isFinite(cEnd) || cEnd <= cStart) return null;

  for (const e of events) {
    if (excludeId && e.id === excludeId) continue;

    const eStart = toMs(e.startISO);
    const eEnd = toMs(e.endISO);

    if (!Number.isFinite(eStart) || !Number.isFinite(eEnd)) continue;

    // overlap: começa antes do fim do outro E termina depois do começo do outro
    const overlap = cStart < eEnd && cEnd > eStart;

    if (overlap) return e;
  }

  return null;
}
