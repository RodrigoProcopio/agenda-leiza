import React, { useEffect, useMemo, useState } from "react";
import { toUtcISOString } from "../lib/time.js";
import { createPatient } from "../lib/patientsApi.js";

const NEW_PATIENT_VALUE = "__new_patient__";

const TYPES = [
  { id: "consultorio", label: "Consultório" },
  { id: "cirurgia", label: "Cirurgia" },
  { id: "pessoal", label: "Pessoal" },
];

const DOW_LABEL = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  0: "Dom",
};

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const inputBase =
  "w-full rounded-2xl border px-3 py-2 text-sm " +
  "bg-white text-slate-900 placeholder:text-slate-400 border-slate-200 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 " +
  "dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500 dark:border-slate-700 " +
  "dark:focus:ring-sky-400 dark:focus:border-sky-400 " +
  "disabled:bg-slate-100 disabled:text-slate-400 " +
  "dark:disabled:bg-slate-800 dark:disabled:text-slate-500";

function todayYmd() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hmToMinutes(hm) {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export default function EventForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
  conflictWith,        // evento em conflito (se existir)
  onChangeCandidate,   // callback para o App calcular conflito em tempo real
  patients = [],
  refreshPatients,
  ownerId,
  canViewFinance = true,
  canEdit = true,
  canCreate = true,
}) {
  const editing = !!(initial && initial.id);
  const canModify = editing ? canEdit : canCreate;

  // -----------------------------
  //   CADASTRO RÁPIDO DE PACIENTE
  // -----------------------------
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [savingNewPatient, setSavingNewPatient] = useState(false);
  const [newPatientError, setNewPatientError] = useState(null);

  // -----------------------------
  //   ESTADO COM DEFAULTS
  // -----------------------------
  const [type, setType] = useState("pessoal");
  const [date, setDate] = useState(todayYmd());
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [patientId, setPatientId] = useState("");

  // campos de cirurgia
  const [value, setValue] = useState("");
  const [payStatus, setPayStatus] = useState("a_receber");

  // recorrência semanal (apenas consultório)
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [weekdays, setWeekdays] = useState([]);

  // -----------------------------
  //   CARREGAR DADOS QUANDO FOR EDIÇÃO
  //   (só roda quando muda o initial.id)
  // -----------------------------
  useEffect(() => {
    if (!initial) return;

    setType(initial.type || "pessoal");
    setDate(initial.date || todayYmd());
    setStart(initial.start || "08:00");
    setEnd(initial.end || "09:00");
    setLocation(initial.location || "");
    setTitle(initial.title || "");
    setNotes(initial.notes || "");

    setValue(
      initial.value !== undefined && initial.value !== null
        ? String(initial.value)
        : ""
    );
    setPayStatus(initial.payStatus || "a_receber");
    setRepeatWeekly(initial.repeatWeekly || false);
    setRepeatUntil(initial.repeatUntil || "");
    setWeekdays(initial.weekdays || []);
    setPatientId(initial.patientId || "");
  }, [initial && initial.id]);

  const resolvedType = type || "pessoal";

  // -----------------------------
  //   CANDIDATE PARA CONFLITO (startISO/endISO)
  // -----------------------------
  const candidate = useMemo(
    () => ({
      startISO: toUtcISOString(date, start),
      endISO: toUtcISOString(date, end),
      id: initial?.id ?? null,
    }),
    [date, start, end, initial?.id]
  );

  // Notifica o App sempre que data/hora mudarem
  useEffect(() => {
    if (!onChangeCandidate) return;
    onChangeCandidate(candidate);
  }, [candidate, onChangeCandidate]);

  // -----------------------------
  //   VALIDAÇÕES
  // -----------------------------
  const invalidTime = useMemo(() => {
    if (!start || !end) return false;
    return hmToMinutes(start) >= hmToMinutes(end);
  }, [start, end]);

  const missingUntil = useMemo(() => {
    // se marcou "repetir semanalmente" precisa escolher uma data
    return repeatWeekly && !repeatUntil;
  }, [repeatWeekly, repeatUntil]);

  const invalidUntil = useMemo(() => {
    // se não é recorrente ou não tem data ainda, não invalida aqui
    if (!repeatWeekly || !repeatUntil) return false;
    // não pode ser no mesmo dia nem antes → precisa ser DEPOIS da data inicial
    return repeatUntil <= date;
  }, [repeatWeekly, repeatUntil, date]);

  const missingWeekdays = useMemo(() => {
    if (!repeatWeekly) return false;
    return weekdays.length === 0;
  }, [repeatWeekly, weekdays]);

  // -----------------------------
  //   HANDLERS
  // -----------------------------
  async function handleSaveNewPatient() {
    if (!newPatientName.trim()) {
      setNewPatientError("Informe o nome do paciente.");
      return;
    }
    setSavingNewPatient(true);
    setNewPatientError(null);
    try {
      const created = await createPatient(ownerId, {
        name: newPatientName.trim(),
        phone: newPatientPhone.trim(),
      });
      if (refreshPatients) await refreshPatients();
      setPatientId(created.id);
      setShowNewPatient(false);
      setNewPatientName("");
      setNewPatientPhone("");
    } catch (err) {
      setNewPatientError(err?.message || "Erro ao cadastrar paciente.");
    } finally {
      setSavingNewPatient(false);
    }
  }

  function handleCancelNewPatient() {
    setShowNewPatient(false);
    setNewPatientName("");
    setNewPatientPhone("");
    setNewPatientError(null);
  }

  function toggleWeekday(dow) {
    setWeekdays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
    );
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (invalidTime || invalidUntil || missingWeekdays || missingUntil) return;

    const baseTitle =
      title.trim() ||
      (resolvedType === "cirurgia"
        ? "Cirurgia"
        : resolvedType === "consultorio"
        ? "Consultório"
        : "Pessoal");

    const startISO = toUtcISOString(date, start);
    const endISO = toUtcISOString(date, end);

    const result = {
      type: resolvedType,
      startISO,
      endISO,
      title: baseTitle,
      location: location.trim() || "",
      notes: notes.trim() || "",
      patientId: patientId || null,
      surgery:
        resolvedType === "cirurgia" && canViewFinance
          ? {
              value:
                Number(
                  String(value).replace(",", ".").replace(" ", "")
                ) || 0,
              payStatus,
              title: baseTitle,
            }
          : resolvedType === "cirurgia"
          ? initial?.value !== undefined
            ? { value: initial.value, payStatus: initial.payStatus, title: baseTitle }
            : null
          : null,
      recurrence:
        resolvedType === "consultorio" && repeatWeekly
          ? {
              kind: "weekly",
              // dias da semana marcados (0–6)
              weekdays: weekdays.slice(),
              // data final da recorrência no formato YYYY-MM-DD
              untilDate: repeatUntil || date,
            }
          : null,
    };

    if (onSubmit) onSubmit(result);
  }

  // -----------------------------
  //   RENDER
  // -----------------------------
  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <fieldset disabled={!canModify} className="space-y-4 border-0 p-0 m-0">
      {!canModify && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {editing
            ? "Você tem apenas permissão de visualização para esta agenda."
            : "Você não tem permissão para criar novos compromissos."}
        </div>
      )}
      {/* AVISO DE CONFLITO DE HORÁRIO */}
      {conflictWith && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-200">
          Conflito com <strong>{conflictWith.title}</strong> nesse horário.
        </div>
      )}

      {/* TIPOS */}
      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
        {TYPES.map((t) => {
          const active = resolvedType === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={
                "flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition " +
                (active
                  ? "border border-sky-500 bg-sky-500 text-white shadow-sm"
                  : "border border-transparent text-slate-700 hover:bg-slate-200 " +
                    "dark:text-slate-200 dark:hover:bg-slate-800")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* DATA + LOCAL */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Data
          </label>
          <input
            type="date"
            className={inputBase}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Local
          </label>
          <input
            type="text"
            className={inputBase}
            placeholder="Local"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>

      {/* HORÁRIOS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Início
          </label>
          <input
            type="time"
            className={`${inputBase} min-w-0`}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Fim
          </label>
          <input
            type="time"
            className={`${inputBase} min-w-0`}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
          {invalidTime && (
            <p className="mt-1 text-xs text-red-400">
              O horário final deve ser maior que o inicial.
            </p>
          )}
        </div>
      </div>

      {/* TÍTULO */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Título (opcional)
        </label>
        <input
          type="text"
          className={inputBase}
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* PACIENTE */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Paciente (opcional)
        </label>
        <select
          className={inputBase}
          value={patientId}
          onChange={(e) => {
            if (e.target.value === NEW_PATIENT_VALUE) {
              setShowNewPatient(true);
              return;
            }
            setPatientId(e.target.value);
          }}
        >
          <option value="">Nenhum</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={NEW_PATIENT_VALUE}>+ Cadastrar novo paciente</option>
        </select>

        {showNewPatient && (
          <div className="mt-2 space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-500/30 dark:bg-sky-500/10">
            <p className="text-xs font-medium text-sky-800 dark:text-sky-200">
              Novo paciente
            </p>
            <input
              type="text"
              className={inputBase}
              placeholder="Nome"
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              className={inputBase}
              placeholder="Telefone (opcional)"
              value={newPatientPhone}
              onChange={(e) => setNewPatientPhone(e.target.value)}
            />
            {newPatientError && (
              <p className="text-xs text-red-500">{newPatientError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelNewPatient}
                className="flex-1 rounded-2xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNewPatient}
                disabled={savingNewPatient}
                className="flex-1 rounded-2xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingNewPatient ? "Cadastrando…" : "Cadastrar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CAMPOS DE CIRURGIA */}
      {resolvedType === "cirurgia" && canViewFinance && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Valor (R$)
            </label>
            <input
              type="text"
              className={`${inputBase} min-w-0`}
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Status pagamento
            </label>
            <select
              className={`${inputBase} min-w-0`}
              value={payStatus}
              onChange={(e) => setPayStatus(e.target.value)}
            >
              <option value="a_receber">A receber</option>
              <option value="recebido">Recebido</option>
            </select>
          </div>
        </div>
      )}
      {resolvedType === "cirurgia" && !canViewFinance && (
        <p className="text-xs text-slate-400">
          Você não tem permissão para ver ou editar informações financeiras.
        </p>
      )}

      {/* RECORRÊNCIA (apenas consultório) */}
      {resolvedType === "consultorio" && (
        <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            Repetir semanalmente
          </label>

          {repeatWeekly && (
            <div className="mt-3 space-y-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Dias da semana
                </span>
                <div className="flex flex-wrap gap-1">
                  {WEEK_ORDER.map((dow) => (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => toggleWeekday(dow)}
                      className={
                        "rounded-full px-3 py-1 text-xs font-medium transition " +
                        (weekdays.includes(dow)
                          ? "bg-sky-500 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 " +
                            "dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700")
                      }
                    >
                      {DOW_LABEL[dow]}
                    </button>
                  ))}
                </div>
                {missingWeekdays && (
                  <p className="mt-1 text-xs text-red-400">
                    Selecione pelo menos um dia da semana.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Repetir até
                </label>
                <input
                  type="date"
                  className={inputBase}
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                />
                {missingUntil && (
                  <p className="mt-1 text-xs text-red-400">
                    Escolha uma data final para a recorrência.
                  </p>
                )}
                {!missingUntil && invalidUntil && (
                  <p className="mt-1 text-xs text-red-400">
                    A data final deve ser posterior à data inicial.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NOTAS */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Notas (opcional)
        </label>
        <textarea
          className={`${inputBase} min-h-[100px] resize-y`}
          placeholder="Notas, observações..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* AÇÕES */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="
            flex-1 rounded-2xl border px-4 py-2 text-sm font-medium
            border-slate-300 text-slate-700 hover:bg-slate-100
            dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800
          "
        >
          Cancelar
        </button>

        {onDelete && editing && canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 rounded-2xl border border-red-500 bg-transparent px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
          >
            Excluir
          </button>
        )}

        {canModify && (
          <button
            type="submit"
            disabled={invalidTime || invalidUntil || missingWeekdays || missingUntil}
            className="flex-1 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Salvar
          </button>
        )}
      </div>
      </fieldset>
    </form>
  );
}
