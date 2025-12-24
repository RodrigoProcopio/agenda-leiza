import React, { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Fab from "./components/Fab.jsx";
import Modal from "./components/Modal.jsx";
import EventForm from "./components/EventForm.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";

import Today from "./pages/Today.jsx";
import Agenda from "./pages/Agenda.jsx";
import Finance from "./pages/Finance.jsx";
import Login from "./pages/Login.jsx";

import { hasConflict } from "./lib/conflicts.js";
import { buildWeeklyRecurringEvents } from "./lib/recurrence.js";
import { useTheme } from "./lib/useTheme.js";
import { localYmdFromIso, localHmFromIso } from "./lib/time.js";

import { supabase } from "./lib/supabase.js";
import {
  fetchEvents,
  createEvent,
  createEventsBulk,
  updateEvent as updateEventCloud,
  deleteEvent as deleteEventCloud,
  deleteEventsByRecurrence,
} from "./lib/eventsApi.js";

import {
  fetchRecurrenceExceptions,
  addRecurrenceException,
  deleteRecurrenceExceptions,
} from "./lib/recurrenceExceptionsApi.js";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function tmpId() {
  return "tmp-" + uid();
}

export default function App() {
  const [tab, setTab] = useState("today");
  const { theme, toggle } = useTheme();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [candidate, setCandidate] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState(null);

  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [applySeriesOpen, setApplySeriesOpen] = useState(false);
  const [pendingEditData, setPendingEditData] = useState(null);

  // cache simples de exceções por recurrenceId
  const [exceptionsMap, setExceptionsMap] = useState({}); // { [recurrenceId]: Set(dayKey) }

  async function reloadEventsSafe() {
    try {
      const list = await fetchEvents();
      setEvents(list);
    } catch (e) {
      console.error("Erro ao recarregar eventos:", e);
    }
  }

  async function loadExceptionsFor(recurrenceId) {
    if (!recurrenceId) return new Set();
    if (exceptionsMap[recurrenceId]) return exceptionsMap[recurrenceId];

    try {
      const rows = await fetchRecurrenceExceptions(recurrenceId);
      const set = new Set(rows.map((r) => r.day_key));
      setExceptionsMap((prev) => ({ ...prev, [recurrenceId]: set }));
      return set;
    } catch (e) {
      console.error("Erro ao carregar exceções:", e);
      return new Set();
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data?.session?.user ?? null);
      setAuthLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setExceptionsMap({});
      return;
    }

    let alive = true;

    async function load() {
      setLoadingEvents(true);
      try {
        const list = await fetchEvents();
        if (!alive) return;
        setEvents(list);
      } catch (e) {
        console.error("Erro ao carregar eventos:", e);
      } finally {
        if (alive) setLoadingEvents(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [user]);

  const conflictWith = useMemo(() => {
    if (!candidate) return null;
    if (isSaving) return null;
    return hasConflict(candidate, events, editing?.id) || null;
  }, [candidate, events, editing, isSaving]);

  function openNew() {
    setEditing(null);
    setCandidate(null);
    setRecurrenceError(null);
    setModalOpen(true);
  }

  async function openEdit(ev) {
    setEditing(ev);
    setCandidate({ type: ev.type, startISO: ev.startISO, endISO: ev.endISO });
    setRecurrenceError(null);
    setModalOpen(true);

    if (ev?.recurrenceId) {
      await loadExceptionsFor(ev.recurrenceId);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setCandidate(null);
    setIsSaving(false);
    setRecurrenceError(null);
  }

  async function recreateRecurringSeries(recurrenceId, baseEvent, recurrence) {
    const existingNotInSeries = events.filter((e) => e.recurrenceId !== recurrenceId);

    const skipped = await loadExceptionsFor(recurrenceId); // Set(dayKey)

    const result = buildWeeklyRecurringEvents({
      baseEvent,
      startDate: recurrence.startDate,
      startTime: recurrence.startTime,
      endTime: recurrence.endTime,
      weekdays: recurrence.weekdays,
      untilDate: recurrence.untilDate,
      existingEvents: existingNotInSeries,
      uidFn: tmpId,
    });

    if (!result.ok) return { ok: false, conflict: true };
    if (!result.events?.length) return { ok: false, empty: true };

    // filtra dias pulados
    const filtered = result.events.filter((e) => !skipped.has(localYmdFromIso(e.startISO)));

    const exceptions = events.filter((e) => e.recurrenceId === recurrenceId && e.isException);

    setEvents((prev) => [
      ...prev.filter((e) => e.recurrenceId !== recurrenceId),
      ...exceptions,
      ...filtered,
    ]);

    await deleteEventsByRecurrence(recurrenceId);
    await createEventsBulk(filtered);
    await reloadEventsSafe();
    return { ok: true };
  }

  async function applyEditToSingle(formData) {
    const updated = {
      ...editing,
      ...formData,
      recurrenceId: null,
      recurrence: null,
      isException: true,
    };

    try {
      setEvents((prev) => prev.map((e) => (e.id === editing.id ? updated : e)));
      await updateEventCloud(editing.id, updated);
      closeModal();
    } catch (e) {
      console.error("Erro ao atualizar evento (single):", e);
      await reloadEventsSafe();
      setIsSaving(false);
    }
  }

  async function applyEditToSeries(formData) {
    const recurrenceId = editing.recurrenceId;
    const recurrence = formData.recurrence;

    const baseEvent = {
      type: formData.type,
      location: formData.location,
      title: formData.title,
      notes: formData.notes,
      surgery: null,
      recurrenceId,
      recurrence,
      isException: false,
    };

    try {
      const out = await recreateRecurringSeries(recurrenceId, baseEvent, recurrence);

      if (!out.ok) {
        if (out.empty) setRecurrenceError("Nenhuma ocorrência foi gerada. Ajuste os dias da semana e/ou a data Até.");
        else setRecurrenceError("Conflito ao recriar a recorrência. Ajuste os horários/dias.");
        setIsSaving(false);
        return;
      }

      closeModal();
    } catch (e) {
      console.error("Erro ao atualizar série recorrente:", e);
      await reloadEventsSafe();
      setIsSaving(false);
    }
  }

  async function handleSubmit(formData) {
    if (isSaving) return;
    setRecurrenceError(null);

    const nextCandidate = { type: formData.type, startISO: formData.startISO, endISO: formData.endISO };
    const conflict = hasConflict(nextCandidate, events, editing?.id);
    if (conflict) {
      setCandidate(nextCandidate);
      return;
    }

    setIsSaving(true);

    if (editing) {
      const isRecurringEvent = !!editing.recurrenceId && !editing.isException;
      const wantsWeekly = formData.type === "consultorio" && formData.recurrence?.kind === "weekly";

      if (isRecurringEvent && wantsWeekly) {
        setPendingEditData(formData);
        setApplySeriesOpen(true);
        return;
      }

      try {
        const updated = {
          ...editing,
          ...formData,
          recurrenceId: null,
          recurrence: null,
          isException: false,
        };
        setEvents((prev) => prev.map((e) => (e.id === editing.id ? updated : e)));
        await updateEventCloud(editing.id, updated);
        closeModal();
      } catch (e) {
        console.error("Erro ao atualizar evento:", e);
        await reloadEventsSafe();
        setIsSaving(false);
      }
      return;
    }

    if (formData.recurrence?.kind === "weekly") {
      const recurrenceId = uid();
      const recurrence = formData.recurrence;

      const baseEvent = {
        type: formData.type,
        location: formData.location,
        title: formData.title,
        notes: formData.notes,
        surgery: null,
        recurrenceId,
        recurrence,
        isException: false,
      };

      const result = buildWeeklyRecurringEvents({
        baseEvent,
        startDate: recurrence.startDate,
        startTime: recurrence.startTime,
        endTime: recurrence.endTime,
        weekdays: recurrence.weekdays,
        untilDate: recurrence.untilDate,
        existingEvents: events,
        uidFn: tmpId,
      });

      if (!result.ok) {
        if (result.tooMany) {
          setRecurrenceError(`Recorrência muito grande. Limite: ${result.max} ocorrências.`);
        }
        setIsSaving(false);
        return;
      }
      
      if (!result.events?.length) {
        setRecurrenceError("Nenhuma ocorrência foi gerada. Ajuste os dias da semana e/ou a data Até.");
        setIsSaving(false);
        return;
      }

      try {
        setEvents((prev) => [...prev, ...result.events]);
        await createEventsBulk(result.events);
        await reloadEventsSafe();
        closeModal();
      } catch (e) {
        console.error("Erro ao criar recorrentes:", e);
        await reloadEventsSafe();
        setIsSaving(false);
      }
      return;
    }

    try {
      const local = { id: tmpId(), ...formData };
      setEvents((prev) => [...prev, local]);
      const created = await createEvent(formData);
      setEvents((prev) => prev.map((e) => (e.id === local.id ? created : e)));
      closeModal();
    } catch (e) {
      console.error("Erro ao criar evento:", e);
      await reloadEventsSafe();
      setIsSaving(false);
    }
  }

  async function deleteOne(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      if (String(id).startsWith("tmp-")) return;
      await deleteEventCloud(id);
    } catch (e) {
      console.error("Erro ao excluir evento:", e);
      await reloadEventsSafe();
    }
  }

  function askDelete(ev) {
    if (ev?.recurrenceId) {
      setDeleteTarget(ev);
      setDeleteChoiceOpen(true);
      return;
    }
    deleteOne(ev.id);
    closeModal();
  }

  async function deleteRecurringOne(id) {
    // ✅ grava exceção (day_key) para não “voltar” ao recriar série
    const ev = events.find((e) => e.id === id);
    if (ev?.recurrenceId) {
      const dayKey = localYmdFromIso(ev.startISO);
      try {
        await addRecurrenceException(ev.recurrenceId, dayKey);
        setExceptionsMap((prev) => {
          const set = new Set(prev[ev.recurrenceId] || []);
          set.add(dayKey);
          return { ...prev, [ev.recurrenceId]: set };
        });
      } catch (e) {
        console.error("Erro ao registrar exceção:", e);
      }
    }

    await deleteOne(id);
    setDeleteChoiceOpen(false);
    setDeleteTarget(null);
    closeModal();
  }

  async function deleteRecurringAll(recurrenceId) {
    setEvents((prev) => prev.filter((e) => e.recurrenceId !== recurrenceId));
    try {
      await deleteEventsByRecurrence(recurrenceId);
      await deleteRecurrenceExceptions(recurrenceId);
      setExceptionsMap((prev) => {
        const cp = { ...prev };
        delete cp[recurrenceId];
        return cp;
      });
    } catch (e) {
      console.error("Erro ao excluir recorrentes:", e);
      await reloadEventsSafe();
    } finally {
      setDeleteChoiceOpen(false);
      setDeleteTarget(null);
      closeModal();
    }
  }

  async function togglePaid(id) {
    const found = events.find((e) => e.id === id);
    if (!found || !found.surgery) return;

    const next = {
      ...found,
      surgery: {
        ...found.surgery,
        payStatus: found.surgery.payStatus === "recebido" ? "a_receber" : "recebido",
      },
    };

    setEvents((prev) => prev.map((e) => (e.id === id ? next : e)));

    try {
      if (String(id).startsWith("tmp-")) return;
      await updateEventCloud(id, next);
    } catch (e) {
      console.error("Erro ao atualizar pagamento:", e);
      await reloadEventsSafe();
    }
  }

  const headerProps =
    tab === "today"
      ? { title: "Hoje", showDate: true }
      : tab === "agenda"
      ? { title: "Agenda", showDate: true }
      : { title: "Financeiro", showDate: true };

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-2xl p-4">Carregando…</div>
      </div>
    );
  }
  if (!user) return <Login />;

  async function logout() {
    await supabase.auth.signOut();
  }

  const initialForForm = editing
    ? (() => {
        const ymd = localYmdFromIso(editing.startISO);
        const startHm = localHmFromIso(editing.startISO);
        const endHm = localHmFromIso(editing.endISO);

        const rec = editing.recurrence;
        const isWeekly = rec?.kind === "weekly";

        return {
          ...editing,
          date: ymd,
          start: startHm,
          end: endHm,
          value: editing.surgery?.value,
          payStatus: editing.surgery?.payStatus,
          repeatWeekly: isWeekly,
          weekdays: isWeekly ? (rec.weekdays ?? []) : [],
          untilDate: isWeekly ? (rec.untilDate ?? "") : "",
        };
      })()
    : null;

  const isEditingRecurring = !!editing?.recurrenceId && !editing?.isException;

  return (
    <div className="min-h-dvh bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header {...headerProps} theme={theme} onToggleTheme={toggle} onLogout={logout} />

      {loadingEvents && (
        <div className="mx-auto max-w-2xl px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
          Sincronizando…
        </div>
      )}

      {tab === "today" && <Today events={events} onOpen={openEdit} />}
      {tab === "agenda" && <Agenda events={events} onOpen={openEdit} />}
      {tab === "finance" && <Finance events={events} onTogglePaid={togglePaid} />}

      <Fab onClick={openNew} />
      <BottomNav tab={tab} setTab={setTab} />

      <Modal open={modalOpen} title={editing ? "Editar compromisso" : "Novo compromisso"} onClose={closeModal}>
        {isEditingRecurring && (
          <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
            Este compromisso é <b>recorrente</b>. Ao salvar, você poderá aplicar as alterações para toda a recorrência.
          </div>
        )}

        <EventForm
          isSaving={isSaving}
          recurrenceError={recurrenceError}
          initial={initialForForm}
          conflictWith={conflictWith}
          onChangeCandidate={setCandidate}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          onDelete={editing ? () => askDelete(editing) : null}
        />
      </Modal>

      <ConfirmModal
        open={applySeriesOpen}
        title="Aplicar alterações"
        description="Você quer aplicar as alterações apenas neste compromisso, ou em todos os compromissos desta recorrência?"
        primaryText="Todos da recorrência"
        secondaryText="Apenas este"
        onClose={() => {
          setApplySeriesOpen(false);
          setPendingEditData(null);
          setIsSaving(false);
        }}
        onPrimary={async () => {
          setApplySeriesOpen(false);
          const data = pendingEditData;
          setPendingEditData(null);
          await applyEditToSeries(data);
        }}
        onSecondary={async () => {
          setApplySeriesOpen(false);
          const data = pendingEditData;
          setPendingEditData(null);
          await applyEditToSingle(data);
        }}
      />

      <Modal
        open={deleteChoiceOpen}
        title="Excluir compromisso recorrente"
        onClose={() => {
          setDeleteChoiceOpen(false);
          setDeleteTarget(null);
        }}
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-700 dark:text-slate-200">
            Você quer excluir apenas este compromisso ou todos os compromissos desta recorrência?
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-800"
              onClick={() => deleteRecurringOne(deleteTarget.id)}
            >
              Apenas este dia
            </button>

            <button
              className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-white"
              onClick={() => deleteRecurringAll(deleteTarget.recurrenceId)}
            >
              Todos recorrentes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
