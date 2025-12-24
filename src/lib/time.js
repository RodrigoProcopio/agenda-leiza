// time.js

export function pad2(n) {
  return String(n).padStart(2, "0");
}

// Constrói um ISO UTC (com Z) a partir de data local YYYY-MM-DD e hora HH:mm
export function toUtcISOString(dateYmd, timeHm) {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = timeHm.split(":").map(Number);

  // cria em horário LOCAL
  const local = new Date(y, m - 1, d, hh, mm, 0, 0);
  return local.toISOString(); // converte para UTC
}

// ✅ Compat: parseLocalDateTimeString("YYYY-MM-DD HH:mm") ou ("YYYY-MM-DDTHH:mm")
export function parseLocalDateTimeString(input) {
  if (!input) return null;

  const normalized = String(input).trim().replace("T", " ");
  const [datePart, timePart] = normalized.split(" ");
  if (!datePart || !timePart) return null;

  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);

  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null;

  const local = new Date(y, m - 1, d, hh, mm, 0, 0);
  return local.toISOString(); // UTC
}

// Retorna millis a partir de ISO
export function toMs(iso) {
  return new Date(iso).getTime();
}

// Data local YYYY-MM-DD a partir de ISO UTC
export function localYmdFromIso(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Hora local HH:mm a partir de ISO UTC
export function localHmFromIso(iso) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ===================================================
// ✅ ALIASES DE COMPATIBILIDADE (para imports antigos)
// ===================================================

// usado em componentes antigos
export function formatHHMMFromIso(iso) {
  return localHmFromIso(iso);
}

// usado para agrupar eventos por dia (chave local YYYY-MM-DD)
export function localDayKeyFromIso(iso) {
  return localYmdFromIso(iso);
}

// usado pelo Today.jsx como "chave de hoje" (local)
export function localTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// Mantém compatibilidade geral
export function formatDateBRFromIso(iso) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
