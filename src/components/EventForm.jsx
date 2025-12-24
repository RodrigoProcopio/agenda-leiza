import React, { useEffect, useMemo, useRef, useState } from "react";
import { toUtcISOString, toMs } from "../lib/time.js";

const TYPES = [
  { id: "consultorio", label: "Consultório" },
  { id: "cirurgia", label: "Cirurgia" },
  { id: "pessoal", label: "Pessoal" },
];

function addWeeksYmd(ymd, weeks) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

const DOW_LABEL = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

function formatBR(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export default function EventForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
  conflictWith,
  onChangeCandidate,
  isSaving = false,
  recurrenceError = null,
}) {
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const [type, setType] = useState(initial?.type ?? "consultorio");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [start, setStart] = useState(initial?.start ?? "08:00");
  const [end, setEnd] = useState(initial?.end ?? "12:00");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [value, setValue] = useState(initial?.value ?? "");
  const [payStatus, setPayStatus] = useState(initial?.payStatus ?? "a_receber");

  const [repeatWeekly, setRepeatWeekly] = useState(initial?.repeatWeekly ?? false);
  const [weekdays, setWeekdays] = useState(initial?.weekdays ?? []);
  const [untilDate, setUntilDate] = useState(initial?.untilDate ?? "");

  const weekdaysRef = useRef(null);
  const untilRef = useRef(null);

  useEffect(() => {
    if (!repeatWeekly) return;
    setUntilDate((prev) => (prev ? prev : addWeeksYmd(date, 12)));

    // ✅ UX: leva o foco para o bloco de dias
    setTimeout(() => {
      weekdaysRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }, 0);
  }, [repeatWeekly, date]);

  const candidate = useMemo(() => {
    return {
      type,
      startISO: toUtcISOString(date, start),
      endISO: toUtcISOString(date, end),
    };
  }, [type, date, start, end]);

  useEffect(() => {
    if (isSaving) return;
    onChangeCandidate?.(candidate);
  }, [candidate, onChangeCandidate, isSaving]);

  const invalidTime = toMs(candidate.startISO) >= toMs(candidate.endISO);
  const invalidUntil = repeatWeekly && untilDate && String(untilDate) < String(date);
  const missingWeekdays = repeatWeekly && type === "consultorio" && weekdays.length === 0;

  function toggleWeekday(dow) {
    setWeekdays((prev) => (prev.includes(dow) ? prev.filter((x) => x !== dow) : [...prev, dow].sort()));
  }

  const recurrenceSummary = useMemo(() => {
    if (!(type === "consultorio" && repeatWeekly)) return null;
    const days = weekdays.map((d) => DOW_LABEL[d]).join(", ");
    return days && untilDate ? `${days} até ${formatBR(untilDate)}` : days || null;
  }, [type, repeatWeekly, weekdays, untilDate]);

  function handleSubmit(e) {
    e.preventDefault();
    if (isSaving) return;

    if (invalidTime) return;
    if (invalidUntil) return;
    if (conflictWith) return;
    if (missingWeekdays) return;

    onSubmit({
      type,
      startISO: candidate.startISO,
      endISO: candidate.endISO,
      location: location.trim(),
      title:
        title.trim() ||
        (type === "cirurgia" ? "Cirurgia" : type === "consultorio" ? "Consultório" : "Pessoal"),
      notes: notes.trim(),
      surgery:
        type === "cirurgia"
          ? {
              value: Number(String(value).replace(",", ".")) || 0,
              payStatus,
            }
          : null,
      recurrence:
        type === "consultorio" && repeatWeekly
          ? {
              kind: "weekly",
              weekdays,
              untilDate: untilDate || addWeeksYmd(date, 12),
              startTime: start,
              endTime: end,
              startDate: date,
            }
          : null,
    });
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {!!recurrenceError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {recurrenceError}
        </div>
      )}

      {!isSaving && conflictWith && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Conflito com <b>{conflictWith.title}</b> nesse horário.
        </div>
      )}

      {invalidTime && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Horário inválido.
        </div>
      )}

      {invalidUntil && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          A data <b>Até</b> precisa ser igual ou maior que a data inicial.
        </div>
      )}

      {missingWeekdays && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Selecione pelo menos <b>1 dia</b> para a recorrência.
        </div>
      )}

      {!!recurrenceSummary && (
        <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">
          Recorrência: <b>{recurrenceSummary}</b>
        </div>
      )}

      <div className="flex gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={isSaving}
            onClick={() => {
              setType(t.id);
              if (t.id !== "consultorio") setRepeatWeekly(false);
            }}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
              type === t.id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200"
            } ${isSaving ? "opacity-60" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          disabled={isSaving}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
        <input
          placeholder="Local"
          value={location}
          disabled={isSaving}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="time"
          value={start}
          disabled={isSaving}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
        <input
          type="time"
          value={end}
          disabled={isSaving}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
      </div>

      <input
        placeholder="Título (opcional)"
        value={title}
        disabled={isSaving}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border px-3 py-2"
      />

      {type === "cirurgia" && (
        <div className="rounded-2xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Valor"
              value={value}
              disabled={isSaving}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-xl border px-3 py-2"
            />
            <select
              value={payStatus}
              disabled={isSaving}
              onChange={(e) => setPayStatus(e.target.value)}
              className="rounded-xl border px-3 py-2"
            >
              <option value="a_receber">A receber</option>
              <option value="recebido">Recebido</option>
            </select>
          </div>
        </div>
      )}

      {type === "consultorio" && (
        <div className="rounded-2xl border p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={repeatWeekly}
              disabled={isSaving}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            Repetir semanalmente
          </label>

          {repeatWeekly && (
            <>
              <div ref={weekdaysRef} className="mt-2 flex flex-wrap gap-2">
                {[
                  ["Dom", 0],
                  ["Seg", 1],
                  ["Ter", 2],
                  ["Qua", 3],
                  ["Qui", 4],
                  ["Sex", 5],
                  ["Sáb", 6],
                ].map(([l, d]) => (
                  <button
                    key={d}
                    type="button"
                    disabled={isSaving}
                    onClick={() => toggleWeekday(d)}
                    className={`rounded-xl border px-3 py-1 text-sm ${
                      weekdays.includes(d) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200"
                    } ${isSaving ? "opacity-60" : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  ref={untilRef}
                  type="date"
                  value={untilDate}
                  disabled={isSaving}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="rounded-xl border px-3 py-2"
                />
                <div className="text-xs text-slate-500 self-center">Até</div>
              </div>
            </>
          )}
        </div>
      )}

      <textarea
        placeholder="Notas (opcional)"
        value={notes}
        disabled={isSaving}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-xl border px-3 py-2"
        rows={3}
      />

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-800 disabled:opacity-60"
        >
          Cancelar
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="rounded-xl border border-red-200 px-4 py-2 text-red-700 disabled:opacity-60"
          >
            Excluir
          </button>
        )}

        <button
          type="submit"
          disabled={isSaving || invalidTime || invalidUntil || (!!conflictWith && !isSaving) || missingWeekdays}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
