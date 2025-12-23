import React, { useEffect, useMemo, useState } from "react";
import { toLocalDateTimeString } from "../lib/time.js";

const TYPES = [
  { id: "consultorio", label: "Consultório" },
  { id: "cirurgia", label: "Cirurgia" },
  { id: "pessoal", label: "Pessoal" },
];

export default function EventForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
  conflictWith,
  onChangeCandidate,
}) {
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [type, setType] = useState(initial?.type ?? "consultorio");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [start, setStart] = useState(initial?.start ?? "08:00");
  const [end, setEnd] = useState(initial?.end ?? "12:00");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Cirurgia
  const [value, setValue] = useState(initial?.value ?? "");
  const [payStatus, setPayStatus] = useState(initial?.payStatus ?? "a_receber");

  // Recorrência (consultório)
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [weekdays, setWeekdays] = useState([1, 3]); // Seg/Qua default
  const [untilDate, setUntilDate] = useState("");

  const candidate = useMemo(
  () => ({
    type,
    startISO: toLocalDateTimeString(date, start),
    endISO: toLocalDateTimeString(date, end),
  }),
  [type, date, start, end]
);

  useEffect(() => {
    onChangeCandidate?.(candidate);
  }, [candidate, onChangeCandidate]);

  const invalidTime =
    new Date(candidate.startISO) >= new Date(candidate.endISO);

  function toggleWeekday(dow) {
    setWeekdays((prev) =>
      prev.includes(dow) ? prev.filter((x) => x !== dow) : [...prev, dow].sort()
    );
  }

  function defaultUntil(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + 7 * 12); // 12 semanas
    return d.toISOString().slice(0, 10);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (invalidTime || conflictWith) return;
    if (conflictWith) return;

    onSubmit({
      type,
      startISO: candidate.startISO,
      endISO: candidate.endISO,
      location: location.trim(),
      title:
        title.trim() ||
        (type === "cirurgia"
          ? "Cirurgia"
          : type === "consultorio"
          ? "Consultório"
          : "Pessoal"),
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
              untilDate: untilDate || defaultUntil(date),
              startTime: start,
              endTime: end,
              startDate: date,
            }
          : null,
    });
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {conflictWith && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Conflito com <b>{conflictWith.title}</b> nesse horário.
        </div>
      )}

      {invalidTime && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Horário inválido.
        </div>
      )}

      {/* Tipo */}
      <div className="flex gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
              type === t.id
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Data / Local */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
        <input
          placeholder="Local"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
      </div>

      {/* Horários */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
      </div>

      <input
        placeholder="Título (opcional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border px-3 py-2"
      />

      {/* Cirurgia */}
      {type === "cirurgia" && (
        <div className="rounded-2xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Valor"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-xl border px-3 py-2"
            />
            <select
              value={payStatus}
              onChange={(e) => setPayStatus(e.target.value)}
              className="rounded-xl border px-3 py-2"
            >
              <option value="a_receber">A receber</option>
              <option value="recebido">Recebido</option>
            </select>
          </div>
        </div>
      )}

      {/* Recorrência */}
      {type === "consultorio" && (
        <div className="rounded-2xl border p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            Repetir semanalmente
          </label>

          {repeatWeekly && (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
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
                    onClick={() => toggleWeekday(d)}
                    className={`rounded-xl border px-3 py-1 text-sm ${
                      weekdays.includes(d)
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

<div className="mt-2">
  <div className="mb-1 text-sm font-medium">Gerar até</div>

  <input
    type="date"
    value={untilDate}
    onChange={(e) => setUntilDate(e.target.value)}
    className="w-full rounded-xl border px-3 py-2"
  />

  <div className="mt-1 text-xs text-slate-500">
    Se vazio, o sistema gera automaticamente ~12 semanas.
  </div>
</div>

            </>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 rounded-xl border border-red-300 px-4 py-2 text-red-700"
          >
            Excluir
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border px-4 py-2"
        >
          Cancelar
        </button>
<button
  type="submit"
  disabled={!!conflictWith}
  className={[
    "w-full rounded-xl px-4 py-3 font-semibold",
    conflictWith
      ? "cursor-not-allowed bg-slate-300 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      : "bg-blue-600 text-white hover:bg-blue-700",
  ].join(" ")}
>
  Salvar
</button>
      </div>
    </form>
  );
}
