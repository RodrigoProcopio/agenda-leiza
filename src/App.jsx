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
import Settings from "./pages/Settings.jsx";

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

import * as recurrenceApi from "./lib/recurrenceExceptionsApi.js";
import { getFinanceFilters } from "./lib/financeFiltersStore.js";

function groupByDay(events) {
  const map = new Map();

  for (const ev of events) {
    if (!ev) continue;
    const d = new Date(ev.startISO);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(ev);
  }

  for (const [, arr] of map.entries()) {
    arr.sort(
      (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
    );
  }

  return map;
}

function App() {
  const { theme, toggle } = useTheme();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [liveConflict, setLiveConflict] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState(null);

  // 🔴 Confirmação de conflito de horário
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictEvent, setConflictEvent] = useState(null);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [applySeriesOpen, setApplySeriesOpen] = useState(false);
  const [pendingEditData, setPendingEditData] = useState(null);

  const [exceptionsMap, setExceptionsMap] = useState({});

  const [tab, setTab] = useState("today");

  // -----------------------------
  //   AUTENTICAÇÃO
  // -----------------------------
  useEffect(() => {
    async function loadUser() {
      try {
        setAuthLoading(true);
        const { data, error } = await supabase.auth.getUser();

        if (error) {
          console.error("Erro ao carregar usuário:", error);
          setUser(null);
        } else {
          setUser(data?.user ?? null);
        }
      } catch (err) {
        console.error("Erro ao carregar usuário (catch):", err);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    loadUser();
  }, []);

  function handleLoginSuccess(userFromLogin) {
    setUser(userFromLogin ?? null);
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      setUser(null);
      setEvents([]);
    }
  }

  // -----------------------------
  //   CARREGAR EVENTOS DO SUPABASE
  // -----------------------------
  useEffect(() => {
    // se não tiver usuário logado, limpa e não busca
    if (!user) {
      console.log("[App] Sem usuário, limpando eventos.");
      setEvents([]);
      return;
    }

    async function loadEvents() {
      try {
        console.log("[App] Carregando eventos para user:", user.id);
        setLoadingEvents(true);
        const data = await fetchEvents();
        console.log("[App] Eventos recebidos:", data);
        setEvents(data || []);
      } catch (err) {
        console.error("[App] Erro ao carregar eventos:", err);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadEvents();
  }, [user]);

  // -----------------------------
  //   EXCEÇÕES DE RECORRÊNCIA
  // -----------------------------
  async function loadExceptionsFor(recurrenceId) {
    if (!recurrenceId) return;

    const fn = recurrenceApi.fetchExceptionsForRecurrence;
    if (!fn) return;

    try {
      const list = await fn(recurrenceId);
      setExceptionsMap((prev) => ({
        ...prev,
        [recurrenceId]: list ?? [],
      }));
    } catch (err) {
      console.error("Erro ao carregar exceções:", err);
    }
  }

  // -----------------------------
  //   EVENTOS PARA TELA
  //   (agora usamos exatamente o que vem do banco,
  //    sem aplicar recorrência de novo)
  // -----------------------------
  const eventsWithRecurrenceApplied = useMemo(() => {
    return (events || []).filter(Boolean);
  }, [events]);


  // -----------------------------
  //   MODAL NOVO / EDIÇÃO
  // -----------------------------
  function openNew(initialData = null) {
    setEditing(null);
    setCandidate(initialData);
    setRecurrenceError(null);
    setModalOpen(true);
  }

  async function openEdit(ev) {
    setEditing(ev);
    setCandidate(null);
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
    setLiveConflict(null);   // 👈 LIMPA O CONFLITO AO FECHAR
    setIsSaving(false);
    setRecurrenceError(null);
  }

  // -----------------------------
  //   EXCLUSÃO (ÚNICO / SÉRIE) COM CONFIRMAÇÃO
  // -----------------------------
  async function handleDeleteSingle(ev) {
    try {
      await deleteEventCloud(ev.id);
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    } catch (err) {
      console.error("Erro ao deletar evento:", err);
      alert("Erro ao deletar. Tente novamente.");
    }
  }

  async function handleDeleteSeries(ev) {
    if (!ev.recurrenceId) return;

    try {
      await deleteEventsByRecurrence(ev.recurrenceId);
      setEvents((prev) =>
        prev.filter((e) => e.recurrenceId !== ev.recurrenceId)
      );
    } catch (err) {
      console.error("Erro ao deletar recorrência:", err);
      alert("Erro ao deletar recorrência. Tente novamente.");
    }
  }

  // 👉 Agora **sempre** abre modal de confirmação
  function requestDelete(ev) {
    setDeleteTarget(ev);
    setDeleteChoiceOpen(true);
  }

  function closeDeleteModal() {
    setDeleteChoiceOpen(false);
    setDeleteTarget(null);
  }

  async function confirmDeleteSingle() {
    if (!deleteTarget) return;
    await handleDeleteSingle(deleteTarget);
    closeDeleteModal();
    closeModal(); // fecha modal de edição também
  }

  async function confirmDeleteSeries() {
    if (!deleteTarget) return;
    await handleDeleteSeries(deleteTarget);
    closeDeleteModal();
    closeModal();
  }

  // -----------------------------
  //   APLICAÇÃO DE EDIÇÃO EM SÉRIE
  // -----------------------------
  function openApplySeriesModal(data) {
    setPendingEditData(data);
    setApplySeriesOpen(true);
  }

  function closeApplySeriesModal() {
    setApplySeriesOpen(false);
    setPendingEditData(null);
  }

  async function applyEditSingle() {
    if (!pendingEditData) return;
    const { baseEvent, updated } = pendingEditData;

    try {
      setIsSaving(true);
      const saved = await createEvent({
        ...updated,
        recurrenceId: null,
        recurrence: null,
      });

      setEvents((prev) => {
        const without = prev.filter((e) => e.id !== baseEvent.id);
        return [...without, saved];
      });

      const saveEx = recurrenceApi.saveRecurrenceException;
      if (saveEx) {
        const ex = {
          recurrence_id: baseEvent.recurrenceId,
          type: "cancel",
          original_start_iso: baseEvent.startISO,
          original_end_iso: baseEvent.endISO,
          payload: null,
        };
        await saveEx(ex);
      }

      closeApplySeriesModal();
      closeModal();
    } catch (err) {
      console.error("Erro ao aplicar alteração apenas neste:", err);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  // -----------------------------
  //   APLICAR EDIÇÃO EM TODA A SÉRIE
  // -----------------------------
  async function applyEditSeries() {
    if (!pendingEditData) return;
    const { baseEvent, updated } = pendingEditData;

    try {
      setIsSaving(true);

      // Se não tiver recurrenceId, não é série de verdade → atualiza só este
      if (!baseEvent.recurrenceId) {
        const saved = await updateEventCloud(baseEvent.id, updated);
        setEvents((prev) =>
          (prev || []).map((e) => (e && e.id === baseEvent.id ? saved : e))
        );
        closeApplySeriesModal();
        closeModal();
        return;
      }

      const recurrenceId = baseEvent.recurrenceId;
      const rec = updated.recurrence;

      // Se não tiver recurrence no updated (por exemplo desmarcou a recorrência),
      // então fazemos um fallback: aplica o delta só em todos os eventos existentes.
      if (!rec || rec.kind !== "weekly") {
        const deltaStartMs =
          new Date(updated.startISO).getTime() -
          new Date(baseEvent.startISO).getTime();
        const deltaEndMs =
          new Date(updated.endISO).getTime() -
          new Date(baseEvent.endISO).getTime();

        const patchCommon = {
          type: updated.type,
          title: updated.title,
          location: updated.location,
          notes: updated.notes,
          surgery: updated.surgery,
        };

        const seriesEvents = (events || []).filter(
          (e) => e && e.recurrenceId === recurrenceId
        );

        const savedList = await Promise.all(
          seriesEvents.map((e) => {
            const start = new Date(e.startISO);
            const end = new Date(e.endISO);

            const payload = {
              ...patchCommon,
              startISO: new Date(
                start.getTime() + deltaStartMs
              ).toISOString(),
              endISO: new Date(end.getTime() + deltaEndMs).toISOString(),
            };

            return updateEventCloud(e.id, payload);
          })
        );

        const savedMap = new Map(savedList.map((ev) => [ev.id, ev]));

        setEvents((prev) =>
          (prev || []).map((e) =>
            e && savedMap.has(e.id) ? savedMap.get(e.id) : e
          )
        );

        closeApplySeriesModal();
        closeModal();
        return;
      }

      // 👉 Aqui é o caminho principal: ainda é uma recorrência semanal
      // 1) Apaga toda a série atual no backend
      await deleteEventsByRecurrence(recurrenceId);

      // 2) Remove a série do estado local
      const others = (events || []).filter(
        (e) => !e || e.recurrenceId !== recurrenceId
      );

      // 3) Regera TODA a série com base no formulário atualizado
      const startDate = localYmdFromIso(updated.startISO);
      const startTime = localHmFromIso(updated.startISO);
      const endTime = localHmFromIso(updated.endISO);

      const untilDate = rec.untilDate || startDate;
      const weekdays =
        Array.isArray(rec.weekdays) && rec.weekdays.length > 0
          ? rec.weekdays
          : [new Date(updated.startISO).getDay()];

      let counter = 0;
      const uidFn = () => `${recurrenceId}-${counter++}`;

      const baseForBuild = {
        ...updated,
        recurrenceId,
        recurrence: {
          ...rec,
          untilDate,
          weekdays,
        },
      };

      const buildResult = buildWeeklyRecurringEvents({
        baseEvent: baseForBuild,
        startDate,
        startTime,
        endTime,
        weekdays,
        untilDate,
        existingEvents: others,
        uidFn,
        maxOccurrences: 365,
      });

      if (!buildResult.ok) {
        if (buildResult.conflictWith) {
          setRecurrenceError(
            `Conflito com "${buildResult.conflictWith.title}" em uma das ocorrências da recorrência.`
          );
        } else if (buildResult.tooMany) {
          setRecurrenceError(
            "A recorrência não pode gerar mais de 365 compromissos. Ajuste o período ou os dias da semana."
          );
        } else {
          setRecurrenceError(
            "Não foi possível gerar a recorrência atualizada. Verifique os dados e tente novamente."
          );
        }
        return;
      }

      const newEvents = buildResult.events || [];
      if (!newEvents.length) {
        setRecurrenceError(
          "Nenhuma ocorrência foi gerada para a recorrência. Verifique os dias da semana e a data final."
        );
        return;
      }

      const savedList = await createEventsBulk(newEvents);

      // 4) Junta novamente: outros eventos + série recriada
      setEvents([...others, ...savedList]);

      closeApplySeriesModal();
      closeModal();
    } catch (err) {
      console.error("Erro ao aplicar alteração na série:", err);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }
  // -----------------------------
  //   SALVAR EVENTO (lógica comum)
  // -----------------------------
  async function saveFormData(formData) {
    try {
      setIsSaving(true);
      setRecurrenceError(null);

      if (editing) {
        // 👉 Agora usamos recurrenceId para saber se é série,
        // não mais o campo recurrence (que pode ser recriado)
        if (editing.recurrenceId) {
          const baseEvent = editing;
          const updated = {
            ...baseEvent,
            ...formData,
          };

          // Abre modal perguntando se aplica na série inteira
          openApplySeriesModal({ baseEvent, updated });
          return;
        }

        // Evento sem série → atualização simples
        const saved = await updateEventCloud(editing.id, formData);
        setEvents((prev) =>
          (prev || []).map((e) => (e && e.id === editing.id ? saved : e))
        );
      } else {
        // Criação de novo evento
        if (formData.recurrence?.kind === "weekly") {
          const rec = formData.recurrence;

          // Data/hora do primeiro evento
          const startDate = localYmdFromIso(formData.startISO);
          const startTime = localHmFromIso(formData.startISO);
          const endTime = localHmFromIso(formData.endISO);

          // Até quando repetir
          const untilDate = rec.untilDate || startDate;

          // Dias da semana
          const weekdays =
            Array.isArray(rec.weekdays) && rec.weekdays.length > 0
              ? rec.weekdays
              : [new Date(formData.startISO).getDay()];

          // Gera um id de recorrência para agrupar todos
          const recurrenceId =
            formData.recurrenceId ||
            `rec-${Date.now().toString(36)}-${Math.random()
              .toString(36)
              .slice(2, 8)}`;

          let counter = 0;
          const uidFn = () => `${recurrenceId}-${counter++}`;

          const baseEvent = {
            ...formData,
            recurrenceId,
            recurrence: {
              ...rec,
              untilDate,
              weekdays,
            },
          };

          // Gera TODAS as ocorrências e já verifica conflitos
          const buildResult = buildWeeklyRecurringEvents({
            baseEvent,
            startDate,
            startTime,
            endTime,
            weekdays,
            untilDate,
            existingEvents: events, // já temos todos os eventos no estado
            uidFn,
            maxOccurrences: 365, // limite de 1 ano
          });

          if (!buildResult.ok) {
            if (buildResult.conflictWith) {
              setRecurrenceError(
                `Conflito com "${buildResult.conflictWith.title}" em uma das ocorrências da recorrência.`
              );
            } else if (buildResult.tooMany) {
              setRecurrenceError(
                "A recorrência não pode gerar mais de 365 compromissos. Ajuste o período ou os dias da semana."
              );
            } else {
              setRecurrenceError(
                "Não foi possível gerar a recorrência. Verifique os dados e tente novamente."
              );
            }
            return;
          }

          const recurringEvents = buildResult.events || [];
          if (!recurringEvents.length) {
            setRecurrenceError(
              "Nenhuma ocorrência foi gerada para essa recorrência. Verifique os dias da semana e a data final."
            );
            return;
          }

          const savedList = await createEventsBulk(recurringEvents);
          setEvents((prev) => [...(prev || []), ...savedList]);
        } else {
          // Evento simples (não recorrente)
          const saved = await createEvent(formData);
          setEvents((prev) => [...(prev || []), saved]);
        }
      }

      closeModal();
    } catch (err) {
      console.error("Erro ao salvar evento:", err);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }
  // -----------------------------
  //   SALVAR EVENTO (com checagem de conflito)
  // -----------------------------
  async function handleSave(formData) {
    // 1) Verifica se existe conflito de horário
    const conflict = hasConflict(
      {
        startISO: formData.startISO,
        endISO: formData.endISO,
      },
      eventsWithRecurrenceApplied,
      editing?.id ?? null
    );

    if (conflict) {
      // Guarda o evento em conflito e os dados que o usuário tentou salvar
      setConflictEvent(conflict);
      setPendingSaveData(formData);
      setConflictModalOpen(true);
      return;
    }

    // 2) Sem conflito → salva normalmente
    await saveFormData(formData);
  }

  // Usuário clicou em "Salvar mesmo assim"
  async function confirmSaveDespiteConflict() {
    if (!pendingSaveData) {
      setConflictModalOpen(false);
      return;
    }

    await saveFormData(pendingSaveData);
    setPendingSaveData(null);
    setConflictEvent(null);
    setConflictModalOpen(false);
  }

  // Usuário desistiu de salvar por causa do conflito
  function cancelSaveDueToConflict() {
    setPendingSaveData(null);
    setConflictEvent(null);
    setConflictModalOpen(false);
  }

  // -----------------------------
  //   TOGGLE PAGO / A RECEBER
  // -----------------------------
  async function togglePaid(id) {
    const found = (events || []).filter(Boolean).find((e) => e.id === id);
    if (!found || !found.surgery) return;

    const nextPayStatus =
      found.surgery.payStatus === "recebido" ? "a_receber" : "recebido";

    const next = {
      ...found,
      surgery: {
        ...found.surgery,
        payStatus: nextPayStatus,
      },
    };

    setEvents((prev) =>
      (prev || []).map((e) => (e && e.id === id ? next : e))
    );

    try {
      await updateEventCloud(id, { surgery: next.surgery });
    } catch (err) {
      console.error("Erro ao alternar status de pagamento:", err);
      alert("Erro ao salvar. Tente novamente.");
      setEvents((prev) =>
        (prev || []).map((e) => (e && e.id === id ? found : e))
      );
    }
  }

  // -----------------------------
  //   EXPORTAÇÃO FINANCEIRO CSV
  // -----------------------------
  function exportFinanceCSV() {
    const { year, month, status } = getFinanceFilters();

    let surgeries = (events || [])
      .filter(Boolean)
      .filter((e) => e.type === "cirurgia" && e.surgery);

    if (year && month) {
      surgeries = surgeries.filter((e) => {
        const ymd = localYmdFromIso(e.startISO);
        const [yStr, mStr] = ymd.split("-");
        const evYear = Number(yStr);
        const evMonth = Number(mStr);
        return evYear === year && evMonth === month;
      });
    }

    if (status && status !== "todos") {
      surgeries = surgeries.filter(
        (e) => (e.surgery?.payStatus || "a_receber") === status
      );
    }

    if (surgeries.length === 0) {
      alert(
        "Não há cirurgias para exportar com os filtros atuais do financeiro."
      );
      return;
    }

    const header = [
      "Data",
      "Título",
      "Valor",
      "Status pagamento",
      "Observações",
    ];

    const rows = surgeries.map((e) => {
      const date = new Date(e.startISO).toLocaleDateString("pt-BR");
      const title = e.surgery?.title || e.title || "";
      const value = Number(e.surgery?.value || 0)
        .toFixed(2)
        .replace(".", ",");
      const statusLabel =
        e.surgery?.payStatus === "recebido"
          ? "Recebido"
          : "A receber";
      const notes = e.notes ? e.notes.replace(/\n/g, " ") : "";

      return [date, title, value, statusLabel, notes];
    });

    const csv = [header, ...rows]
      .map((r) => r.join(";"))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "financeiro_cirurgias.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // -----------------------------
  //   EXPORTAÇÃO AGENDA COMPLETA CSV
  // -----------------------------
  function exportAgendaCSV() {
    const list = (events || []).filter(Boolean);

    if (list.length === 0) {
      alert("Não há eventos na agenda para exportar.");
      return;
    }

    const header = [
      "Data",
      "Hora início",
      "Hora fim",
      "Tipo",
      "Título",
      "Local",
      "Valor",
      "Status pagamento",
      "Notas",
    ];

    const sorted = [...list].sort(
      (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
    );

    const rows = sorted.map((e) => {
      const ymd = localYmdFromIso(e.startISO);
      const [year, month, day] = ymd.split("-");
      const dateBr = `${day}/${month}/${year}`;

      const startHm = localHmFromIso(e.startISO);
      const endHm = localHmFromIso(e.endISO);

      const type = e.type || "";
      const title = e.title ? e.title.replace(/\n/g, " ") : "";
      const location = e.location ? e.location.replace(/\n/g, " ") : "";

      const hasSurgery = !!e.surgery;
      const rawValue =
        hasSurgery &&
        typeof e.surgery.value !== "undefined" &&
        e.surgery.value !== null
          ? Number(e.surgery.value)
          : null;

      const value =
        rawValue !== null
          ? rawValue.toFixed(2).replace(".", ",")
          : "";

      const status =
        hasSurgery && e.surgery.payStatus
          ? e.surgery.payStatus === "recebido"
            ? "Recebido"
            : "A receber"
          : "";

      const notes = e.notes ? e.notes.replace(/\n/g, " ") : "";

      return [
        dateBr,
        startHm,
        endHm,
        type,
        title,
        location,
        value,
        status,
        notes,
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.join(";"))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "agenda_completa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // -----------------------------
  //   PROPS PARA HEADER
  // -----------------------------
  const headerProps =
    tab === "today"
      ? { title: "Hoje", showDate: true }
      : tab === "agenda"
      ? { title: "Agenda", showDate: true }
      : tab === "finance"
      ? { title: "Financeiro", showDate: true }
      : { title: "Configurações", showDate: false };

  // -----------------------------
  //   ESTADOS DE LOGIN
  // -----------------------------
  if (authLoading) {
    return (
      <div className="min-h-dvh bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-2xl p-4">Carregando…</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // -----------------------------
  //   INITIAL DATA PARA FORM
  // -----------------------------
  const initialForForm = editing
    ? (() => {
        const ymd = localYmdFromIso(editing.startISO);
        const startHm = localHmFromIso(editing.startISO);
        const endHm = localHmFromIso(editing.endISO);

        const rec = editing?.recurrence;
        const isWeekly = rec?.kind === "weekly";

        const repeatUntil =
          isWeekly && rec
            ? rec.untilDate || rec.until || null
            : null;

        return {
          type: editing.type,
          date: ymd,
          start: startHm,
          end: endHm,
          title: editing.title,
          location: editing.location,
          notes: editing.notes,
          value: editing.surgery?.value ?? "",
          payStatus: editing.surgery?.payStatus ?? "a_receber",
          repeatWeekly: isWeekly,
          repeatUntil,
          weekdays: isWeekly ? rec.weekdays ?? [] : [],
        };
      })()
    : candidate;

  const isDeleteRecurring = !!deleteTarget?.recurrenceId;

  // -----------------------------
  //   RENDER PRINCIPAL
  // -----------------------------
  return (
    <div className="min-h-dvh bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        {...headerProps}
        theme={theme}
        onLogout={handleLogout}
      />

      {tab === "today" && (
        <Today
          events={eventsWithRecurrenceApplied}
          onOpen={openEdit}
        />
      )}

      {tab === "agenda" && (
        <Agenda
          events={eventsWithRecurrenceApplied}
          onOpen={openEdit}
        />
      )}

      {tab === "finance" && (
        <Finance
          events={events}
          onTogglePaid={togglePaid}
          onOpen={openEdit}
        />
      )}

      {tab === "settings" && (
        <Settings
          theme={theme}
          onToggleTheme={toggle}
          onExportFinance={exportFinanceCSV}
          onExportAgenda={exportAgendaCSV}
        />
      )}

      <Fab onClick={openNew} />
      <BottomNav tab={tab} setTab={setTab} />

      {/* MODAL PRINCIPAL (CRIAR / EDITAR COMPROMISSO) */}
      <Modal
        open={modalOpen}
        title={editing ? "Editar compromisso" : "Novo compromisso"}
        onClose={closeModal}
      >
        {isSaving && (
          <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
            Salvando…
          </div>
        )}

        {recurrenceError && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            {recurrenceError}
          </div>
        )}

        <EventForm
          onSubmit={handleSave}
          onCancel={closeModal}
          initial={initialForForm}
          onDelete={editing ? () => requestDelete(editing) : undefined}
          conflictWith={liveConflict}
          onChangeCandidate={(cand) => {
            setCandidate(cand);

            if (!cand) {
              setLiveConflict(null);
              return;
            }

            const c = hasConflict(
              cand,
              eventsWithRecurrenceApplied,
              editing?.id ?? null
            );

            setLiveConflict(c);
          }}
        />
      </Modal>

      {/* 🔴 CONFIRMAR EXCLUSÃO (simples ou recorrente) */}
      <ConfirmModal
        open={deleteChoiceOpen}
        title={
          isDeleteRecurring
            ? "Excluir compromisso recorrente"
            : "Excluir compromisso"
        }
        description={
          isDeleteRecurring
            ? "Você deseja excluir apenas este compromisso ou toda a série?"
            : "Tem certeza que deseja excluir este compromisso? Essa ação não poderá ser desfeita."
        }
        confirmLabel={isDeleteRecurring ? "Excluir toda a série" : "Excluir"}
        secondaryLabel={isDeleteRecurring ? "Excluir apenas este" : undefined}
        onConfirm={isDeleteRecurring ? confirmDeleteSeries : confirmDeleteSingle}
        onSecondary={isDeleteRecurring ? confirmDeleteSingle : undefined}
        onCancel={closeDeleteModal}
      />

      {/* 🔁 APLICAR EDIÇÃO EM SÉRIE OU APENAS NESTE */}
      <ConfirmModal
        open={applySeriesOpen}
        title="Aplicar alteração"
        description="Deseja aplicar esta alteração apenas neste compromisso ou em toda a série?"
        confirmLabel="Aplicar em toda a série"
        secondaryLabel="Apenas neste"
        onConfirm={applyEditSeries}
        onSecondary={applyEditSingle}
        onCancel={closeApplySeriesModal}
      />

      {/* ⚠️ CONFIRMAR SALVAR MESMO COM CONFLITO DE HORÁRIO */}
      <ConfirmModal
        open={conflictModalOpen}
        title="Conflito de horário"
        description={
          conflictEvent
            ? `Já existe o compromisso "${conflictEvent.title}" neste horário. Deseja salvar mesmo assim?`
            : "Já existe um compromisso neste horário. Deseja salvar mesmo assim?"
        }
        confirmLabel="Salvar mesmo assim"
        onConfirm={confirmSaveDespiteConflict}
        onCancel={cancelSaveDueToConflict}
      />
    </div>
  );
}

export default App;
