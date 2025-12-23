// Cria "ISO local" SEM UTC e SEM Z.
// Ex: "2025-12-22T19:00:00"
export function toLocalDateTimeString(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00`;
}

export function parseLocalDateTimeString(localStr) {
  // localStr: "YYYY-MM-DDTHH:mm:ss"
  const [datePart, timePart] = localStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, ss || 0, 0); // ✅ sempre local
}

export function formatHHMM(localStr) {
  const d = parseLocalDateTimeString(localStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDateBR(localStr) {
  const d = parseLocalDateTimeString(localStr);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function isSameDay(aLocalStr, bLocalStr) {
  const a = parseLocalDateTimeString(aLocalStr);
  const b = parseLocalDateTimeString(bLocalStr);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// src/lib/time.js

export function toMs(iso) {
  if (!iso) return NaN;

  // Se tiver timezone (Z ou -03:00 etc), o Date lida certo
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(iso)) {
    return new Date(iso).getTime();
  }

  // Caso "YYYY-MM-DDTHH:mm" (sem timezone): interpreta como HORA LOCAL
  const [datePart, timePart = "00:00:00"] = iso.split("T");
  const [y, m, d] = datePart.split("-").map(Number);

  const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map(Number);

  return new Date(y, m - 1, d, hh, mm, ss, 0).getTime();
}

// Converte data+hora LOCAL do formulário para ISO UTC (com Z)
// Ex: date=2025-12-23 time=16:25  (Brasil -03)
// Retorna: 2025-12-23T19:25:00.000Z
export function toUtcISOString(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const local = new Date(y, m - 1, d, hh, mm, 0, 0);
  return local.toISOString();
}

export function formatHHMMFromIso(iso) {
  const d = new Date(iso); // iso com timezone é seguro
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDateBRFromIso(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function localDayKeyFromIso(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function localTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
