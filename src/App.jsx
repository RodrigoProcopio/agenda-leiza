import React, { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Fab from "./components/Fab.jsx";
import Modal from "./components/Modal.jsx";
import EventForm from "./components/EventForm.jsx";

import Today from "./pages/Today.jsx";
import Agenda from "./pages/Agenda.jsx";
import Finance from "./pages/Finance.jsx";
import Login from "./pages/Login.jsx";

import { hasConflict } from "./lib/conflicts.js";
import { buildWeeklyRecurringEvents } from "./lib/recurrence.js";
import { useTheme } from "./lib/useTheme.js";

import { supabase } from "./lib/supabase.js";
import {
  fetchEvents,
  createEvent,
  updateEvent as updateEventCloud,
  deleteEvent as deleteEventCloud,
  deleteEventsByRecurrence,
} from "./lib/eventsApi.js";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function App() {
  const [tab, setTab] = useState("today");
  const { theme, toggle } = useTheme();

  // Auth/session
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Events
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Modal principal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [candidate, setCandidate] = useState(null);

  // Modal de escolha ao excluir recorrente
  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---------- AUTH: pega sessão + ouve mudanças ----------
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

  // ---------- Carrega eventos quando logar ----------
  useEffect(() => {
    if (!user) {
      setEvents([]);
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

  // ---------- Conflito ----------
  const conflictWith = useMemo(() => {
    if (!candidate) return null;
    return hasConflict(candidate, events, editing?.id) || null;
  }, [candidate, events, editing]);

  function openNew() {
    setEditing(null);
    setCandidate(null);
    setModalOpen(true);
  }

  function openEdit(ev) {
    setEditing(ev);
    setCandidate({ type: ev.type, startISO: ev.startISO, endISO: ev.endISO });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setCandidate(null);
  }

  // ---------- CREATE / UPDATE ----------
  async function handleSubmit(formData) {
    const nextCandidate = {
      type: formData.type,
      startISO: formData.startISO,
      endISO: formData.endISO,
    };

    const conflict = hasConflict(nextCandidate, events, editing?.id);
    if (conflict) {
      setCandidate(nextCandidate);
      return;
    }

    // ======= EDIÇÃO (atualiza só 1 evento) =======
    if (editing) {
      const updated = { ...editing, ...formData };

      try {
        // otimista no UI
        setEvents((prev) => prev.map((e) => (e.id === editing.id ? updated : e)));
        await updateEventCloud(editing.id, updated);
        closeModal();
      } catch (e) {
        console.error("Erro ao atualizar evento:", e);
        // fallback: recarrega
        const list = await fetchEvents();
        setEvents(list);
      }
      return;
    }

    // ======= CRIAÇÃO COM RECORRÊNCIA SEMANAL =======
    if (formData.recurrence?.kind === "weekly") {
      const recurrenceId = uid();

      const baseEvent = {
        type: formData.type,
        location: formData.location,
        title: formData.title,
        notes: formData.notes,
        surgery: null,
        recurrenceId,
      };

      const result = buildWeeklyRecurringEvents({
        baseEvent,
        startDate: formData.recurrence.startDate,
        startTime: formData.recurrence.startTime,
        endTime: formData.recurrence.endTime,
        weekdays: formData.recurrence.weekdays,
        untilDate: formData.recurrence.untilDate,
        existingEvents: events,
        uidFn: () => crypto?.randomUUID?.() ?? uid(),
      });

      if (!result.ok) return;

      // salva em lote (um a um) — simples
      try {
        // otimista
        setEvents((prev) => [...prev, ...result.events]);

        for (const ev of result.events) {
          await createEvent(ev);
        }

        // recarrega para garantir IDs do banco
        const list = await fetchEvents();
        setEvents(list);

        closeModal();
      } catch (e) {
        console.error("Erro ao criar recorrentes:", e);
        const list = await fetchEvents();
        setEvents(list);
      }
      return;
    }

    // ======= CRIAÇÃO NORMAL =======
    try {
      const local = { id: "tmp-" + uid(), ...formData };
      setEvents((prev) => [...prev, local]);

      const created = await createEvent(formData);

      // troca tmp pelo id real
      setEvents((prev) => prev.map((e) => (e.id === local.id ? created : e)));

      closeModal();
    } catch (e) {
      console.error("Erro ao criar evento:", e);
      const list = await fetchEvents();
      setEvents(list);
    }
  }

  // ---------- DELETE ----------
  async function deleteOne(id) {
    // otimista
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteEventCloud(id);
    } catch (e) {
      console.error("Erro ao excluir evento:", e);
      const list = await fetchEvents();
      setEvents(list);
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
    await deleteOne(id);
    setDeleteChoiceOpen(false);
    setDeleteTarget(null);
    closeModal();
  }

  async function deleteRecurringAll(recurrenceId) {
    // otimista
    setEvents((prev) => prev.filter((e) => e.recurrenceId !== recurrenceId));
    try {
      await deleteEventsByRecurrence(recurrenceId);
    } catch (e) {
      console.error("Erro ao excluir recorrentes:", e);
      const list = await fetchEvents();
      setEvents(list);
    } finally {
      setDeleteChoiceOpen(false);
      setDeleteTarget(null);
      closeModal();
    }
  }

  // ---------- Toggle Pago ----------
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

    // otimista
    setEvents((prev) => prev.map((e) => (e.id === id ? next : e)));

    try {
      await updateEventCloud(id, next);
    } catch (e) {
      console.error("Erro ao atualizar pagamento:", e);
      const list = await fetchEvents();
      setEvents(list);
    }
  }

  // ---------- Header props ----------
  const headerProps =
    tab === "today"
      ? { title: "Hoje", showDate: true }
      : tab === "agenda"
      ? { title: "Agenda", showDate: true }
      : { title: "Financeiro", showDate: true };

  // ---------- UI: Auth loading ----------
  if (authLoading) {
    return (
      <div className="min-h-dvh bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-2xl p-4">Carregando…</div>
      </div>
    );
  }

  // ---------- UI: não logado ----------
  if (!user) {
    return <Login />;
  }

async function logout() {
  await supabase.auth.signOut();
}

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

      {/* Modal principal */}
      <Modal open={modalOpen} title={editing ? "Editar compromisso" : "Novo compromisso"} onClose={closeModal}>
        <EventForm
          initial={
            editing
              ? {
                  ...editing,
                  date: editing.startISO.slice(0, 10),
                  start: editing.startISO.slice(11, 16),
                  end: editing.endISO.slice(11, 16),
                  value: editing.surgery?.value,
                  payStatus: editing.surgery?.payStatus,
                }
              : null
          }
          conflictWith={conflictWith}
          onChangeCandidate={setCandidate}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          onDelete={editing ? () => askDelete(editing) : null}
        />
      </Modal>

      {/* Modal de decisão para recorrentes */}
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
