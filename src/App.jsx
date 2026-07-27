import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Fab from "./components/Fab.jsx";
import Modal from "./components/Modal.jsx";
import EventForm from "./components/EventForm.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
import { useToast } from "./components/Toast.jsx";

import Today from "./pages/Today.jsx";
import Agenda from "./pages/Agenda.jsx";
import Finance from "./pages/Finance.jsx";
import Login from "./pages/Login.jsx";
import Settings from "./pages/Settings.jsx";
import AdminHome from "./pages/AdminHome.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

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
import { resolvePracticeContext } from "./lib/practiceApi.js";
import { fetchPatients } from "./lib/patientsApi.js";
import { fetchOwnProfile } from "./lib/profileApi.js";
import { checkIsPlatformAdmin } from "./lib/adminApi.js";

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutos
const UNDO_DELETE_MS = 5000;

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
  const toast = useToast();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // Contexto de prática: quem é o "dono" dos dados e quais permissões o
  // usuário logado tem (dono sempre tem tudo; membro convidado tem o que
  // foi configurado em practice_members).
  const [practiceCtx, setPracticeCtx] = useState(null);
  const [profile, setProfile] = useState(null);
  const ownerId = practiceCtx?.ownerId ?? null;
  const canEdit = practiceCtx ? !!practiceCtx.canEdit : true;
  const canCreate = practiceCtx ? practiceCtx.canCreate !== false : true;
  const canViewFinance = practiceCtx ? !!practiceCtx.canViewFinance : true;
  const isOwner = practiceCtx ? !!practiceCtx.isOwner : true;

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [patients, setPatients] = useState([]);

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

  const pendingDeletesRef = useRef({});

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

  // Escuta eventos de auth (login, logout, e principalmente o link de
  // "recuperar senha", que dispara PASSWORD_RECOVERY quando o usuário clica
  // no e-mail de redefinição).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setPracticeCtx(null);
        setEvents([]);
        setPatients([]);
        return;
      }

      if (session?.user) {
        setUser(session.user);
      }
    });

    return () => sub?.subscription?.unsubscribe();
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
      setPracticeCtx(null);
      setEvents([]);
      setPatients([]);
    }
  }

  // -----------------------------
  //   CONTEXTO DE PRÁTICA (dono x membro convidado)
  // -----------------------------
  useEffect(() => {
    if (!user) {
      setPracticeCtx(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const ctx = await resolvePracticeContext();
        if (!cancelled) setPracticeCtx(ctx);
      } catch (err) {
        console.error("Erro ao resolver contexto da prática:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // -----------------------------
  //   PERFIL DO USUÁRIO LOGADO (nome, título, foto)
  // -----------------------------
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const p = await fetchOwnProfile();
        if (!cancelled) setProfile(p);
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function refreshProfile() {
    try {
      const p = await fetchOwnProfile();
      setProfile(p);
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err);
    }
  }

  // -----------------------------
  //   ADMINISTRADOR DA PLATAFORMA (conta exclusiva, sem agenda/financeiro)
  // -----------------------------
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsPlatformAdmin(false);
      setAdminCheckDone(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await checkIsPlatformAdmin();
        if (!cancelled) setIsPlatformAdmin(result);
      } catch (err) {
        console.error("Erro ao verificar admin da plataforma:", err);
      } finally {
        if (!cancelled) setAdminCheckDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // -----------------------------
  //   CARREGAR EVENTOS + PACIENTES DO SUPABASE
  // -----------------------------
  useEffect(() => {
    if (!ownerId) {
      setEvents([]);
      setPatients([]);
      return;
    }

    async function loadAll() {
      try {
        if (import.meta.env.DEV) console.log("[App] Carregando dados para ownerId:", ownerId);
        setLoadingEvents(true);

        const [data, patientsList] = await Promise.all([
          fetchEvents(ownerId),
          fetchPatients(ownerId).catch((err) => {
            console.error("[App] Erro ao carregar pacientes:", err);
            return [];
          }),
        ]);

        setEvents(data || []);
        setPatients(patientsList || []);
        await loadAllExceptions(ownerId, data || []);
      } catch (err) {
        console.error("[App] Erro ao carregar eventos:", err);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  // -----------------------------
  //   AUTO-REFRESH PERIÓDICO (mantém a tela "Hoje" atualizada mesmo se
  //   outra pessoa da equipe criar/alterar compromissos)
  // -----------------------------
  useEffect(() => {
    if (!ownerId) return;

    const interval = setInterval(async () => {
      try {
        const data = await fetchEvents(ownerId);
        setEvents(data || []);
        await loadAllExceptions(ownerId, data || []);
      } catch (err) {
        console.error("[App] Erro no auto-refresh:", err);
      }
    }, AUTO_REFRESH_MS);

    return () => clearInterval(interval);
  }, [ownerId]);

  async function refreshPatients() {
    if (!ownerId) return;
    try {
      const list = await fetchPatients(ownerId);
      setPatients(list || []);
    } catch (err) {
      console.error("Erro ao atualizar pacientes:", err);
    }
  }

  // Se o usuário perde a permissão de ver financeiro (ou é uma secretária
  // sem essa permissão) e está na aba financeiro, tira ele de lá.
  useEffect(() => {
    if (practiceCtx && !canViewFinance && tab === "finance") {
      setTab("today");
    }
  }, [practiceCtx, canViewFinance, tab]);

  // -----------------------------
  //   EXCEÇÕES DE RECORRÊNCIA
  // -----------------------------
  function mapExceptionRows(rows) {
    return (rows || []).map((row) => ({
      dayKey: row.day_key,
      type: row.type || "cancel",
      newStartISO: row.new_start_iso || null,
      newEndISO: row.new_end_iso || null,
    }));
  }

  // Carrega as exceções de UM recurrenceId específico (usado ao abrir o modal de edição)
  async function loadExceptionsFor(recurrenceId) {
    if (!ownerId || !recurrenceId) return;

    try {
      const list = await recurrenceApi.fetchRecurrenceExceptions(ownerId, recurrenceId);
      setExceptionsMap((prev) => ({
        ...prev,
        [recurrenceId]: mapExceptionRows(list),
      }));
    } catch (err) {
      console.error("Erro ao carregar exceções:", err);
    }
  }

  // Carrega as exceções de TODAS as recorrências presentes na lista de eventos
  // (necessário para que "editar apenas este" some da tela em qualquer aba,
  // não só quando o evento específico for reaberto)
  async function loadAllExceptions(ownerIdParam, list) {
    const recurrenceIds = Array.from(
      new Set((list || []).filter((e) => e && e.recurrenceId).map((e) => e.recurrenceId))
    );

    if (!recurrenceIds.length) {
      setExceptionsMap({});
      return;
    }

    try {
      const results = await Promise.all(
        recurrenceIds.map((id) => recurrenceApi.fetchRecurrenceExceptions(ownerIdParam, id))
      );

      const map = {};
      recurrenceIds.forEach((id, idx) => {
        map[id] = mapExceptionRows(results[idx]);
      });

      setExceptionsMap(map);
    } catch (err) {
      console.error("Erro ao carregar exceções de recorrência:", err);
    }
  }

  // -----------------------------
  //   EVENTOS PARA TELA
  //   Aplica as exceções de recorrência:
  //   - "cancel": a ocorrência não é exibida (virou um evento avulso à parte)
  //   - "reschedule": a ocorrência continua vinculada à série, mas é exibida
  //     em outra data/hora (sem virar um evento avulso)
  // -----------------------------
  const eventsWithRecurrenceApplied = useMemo(() => {
    return (events || [])
      .filter(Boolean)
      .map((ev) => {
        if (!ev.recurrenceId) return ev;

        const exceptions = exceptionsMap[ev.recurrenceId];
        if (!exceptions || !exceptions.length) return ev;

        const dayKey = localYmdFromIso(ev.startISO);
        const match = exceptions.find((exc) => exc.dayKey === dayKey);
        if (!match) return ev;

        if (match.type === "reschedule" && match.newStartISO && match.newEndISO) {
          return {
            ...ev,
            startISO: match.newStartISO,
            endISO: match.newEndISO,
            isRescheduled: true,
          };
        }

        // type === "cancel" → não exibe (a versão avulsa já está em `events`)
        return null;
      })
      .filter(Boolean);
  }, [events, exceptionsMap]);

  // -----------------------------
  //   MODAL NOVO / EDIÇÃO
  // -----------------------------
  function openNew(initialData = null) {
    if (!canCreate) return;
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
  //   EXCLUSÃO (ÚNICO / SÉRIE) COM CONFIRMAÇÃO + DESFAZER
  // -----------------------------
  async function handleDeleteSingle(ev) {
    // Remoção otimista da tela
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));

    const commit = async () => {
      try {
        await deleteEventCloud(ownerId, ev.id);
      } catch (err) {
        console.error("Erro ao deletar evento:", err);
        toast.show("Erro ao excluir o compromisso. Ele foi restaurado.", {
          type: "error",
        });
        setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [...prev, ev]));
      } finally {
        delete pendingDeletesRef.current[ev.id];
      }
    };

    const timer = setTimeout(commit, UNDO_DELETE_MS);
    pendingDeletesRef.current[ev.id] = timer;

    toast.show(`"${ev.title || "Compromisso"}" excluído.`, {
      type: "info",
      duration: UNDO_DELETE_MS,
      actionLabel: "Desfazer",
      onAction: () => {
        clearTimeout(pendingDeletesRef.current[ev.id]);
        delete pendingDeletesRef.current[ev.id];
        setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [...prev, ev]));
      },
    });
  }

  async function handleDeleteSeries(ev) {
    if (!ev.recurrenceId) return;

    try {
      await deleteEventsByRecurrence(ownerId, ev.recurrenceId);

      // Limpa também as exceções órfãs dessa recorrência
      try {
        await recurrenceApi.deleteRecurrenceExceptions(ownerId, ev.recurrenceId);
      } catch (exErr) {
        console.error("Erro ao limpar exceções da recorrência:", exErr);
      }

      setEvents((prev) =>
        prev.filter((e) => e.recurrenceId !== ev.recurrenceId)
      );
      setExceptionsMap((prev) => {
        const next = { ...prev };
        delete next[ev.recurrenceId];
        return next;
      });

      toast.show("Série de compromissos excluída.", { type: "info" });
    } catch (err) {
      console.error("Erro ao deletar recorrência:", err);
      toast.show("Erro ao deletar recorrência. Tente novamente.", { type: "error" });
    }
  }

  // 👉 Agora **sempre** abre modal de confirmação
  function requestDelete(ev) {
    if (!canEdit) return;
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

  // "Apenas neste": se só mudou data/hora, remarca mantendo o vínculo com a
  // série (não vira evento avulso). Se mudou qualquer outro campo, cria um
  // evento avulso e marca a ocorrência original como cancelada — como antes.
  async function applyEditSingle() {
    if (!pendingEditData) return;
    const { baseEvent, updated } = pendingEditData;

    try {
      setIsSaving(true);

      const onlyTimeChanged =
        (updated.type || null) === (baseEvent.type || null) &&
        (updated.title || "") === (baseEvent.title || "") &&
        (updated.location || "") === (baseEvent.location || "") &&
        (updated.notes || "") === (baseEvent.notes || "") &&
        (updated.patientId || null) === (baseEvent.patientId || null) &&
        JSON.stringify(updated.surgery || null) === JSON.stringify(baseEvent.surgery || null);

      const dayKey = localYmdFromIso(baseEvent.startISO);

      if (onlyTimeChanged && baseEvent.recurrenceId) {
        await recurrenceApi.saveRescheduleException(
          ownerId,
          baseEvent.recurrenceId,
          dayKey,
          updated.startISO,
          updated.endISO
        );

        setExceptionsMap((prev) => {
          const existing = (prev[baseEvent.recurrenceId] || []).filter(
            (e) => e.dayKey !== dayKey
          );
          return {
            ...prev,
            [baseEvent.recurrenceId]: [
              ...existing,
              {
                dayKey,
                type: "reschedule",
                newStartISO: updated.startISO,
                newEndISO: updated.endISO,
              },
            ],
          };
        });

        toast.show("Ocorrência remarcada — o vínculo com a série foi mantido.", {
          type: "success",
        });

        closeApplySeriesModal();
        closeModal();
        return;
      }

      const saved = await createEvent(ownerId, {
        ...updated,
        recurrenceId: null,
        recurrence: null,
      });

      setEvents((prev) => {
        const without = prev.filter((e) => e.id !== baseEvent.id);
        return [...without, saved];
      });

      // Marca a ocorrência original como "exceção" (cancelada) para que ela
      // pare de aparecer na tela (a nova versão avulsa já foi criada acima).
      if (baseEvent.recurrenceId) {
        await recurrenceApi.addRecurrenceException(ownerId, baseEvent.recurrenceId, dayKey);

        setExceptionsMap((prev) => {
          const existing = (prev[baseEvent.recurrenceId] || []).filter(
            (e) => e.dayKey !== dayKey
          );
          return {
            ...prev,
            [baseEvent.recurrenceId]: [...existing, { dayKey, type: "cancel" }],
          };
        });
      }

      closeApplySeriesModal();
      closeModal();
    } catch (err) {
      console.error("Erro ao aplicar alteração apenas neste:", err);
      toast.show("Erro ao salvar. Tente novamente.", { type: "error" });
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
        const saved = await updateEventCloud(ownerId, baseEvent.id, updated);
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
          patientId: updated.patientId,
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

            return updateEventCloud(ownerId, e.id, payload);
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
      await deleteEventsByRecurrence(ownerId, recurrenceId);

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

      const savedList = await createEventsBulk(ownerId, newEvents);

      // 4) Junta novamente: outros eventos + série recriada
      setEvents([...others, ...savedList]);

      // A série foi recriada com novos ids, então as exceções antigas não
      // fazem mais sentido — limpa para essa recorrência.
      try {
        await recurrenceApi.deleteRecurrenceExceptions(ownerId, recurrenceId);
      } catch (exErr) {
        console.error("Erro ao limpar exceções antigas da série:", exErr);
      }
      setExceptionsMap((prev) => {
        const next = { ...prev };
        delete next[recurrenceId];
        return next;
      });

      closeApplySeriesModal();
      closeModal();
    } catch (err) {
      console.error("Erro ao aplicar alteração na série:", err);
      toast.show("Erro ao salvar. Tente novamente.", { type: "error" });
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
        const saved = await updateEventCloud(ownerId, editing.id, formData);
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

          const savedList = await createEventsBulk(ownerId, recurringEvents);
          setEvents((prev) => [...(prev || []), ...savedList]);
        } else {
          // Evento simples (não recorrente)
          const saved = await createEvent(ownerId, formData);
          setEvents((prev) => [...(prev || []), saved]);
        }
      }

      closeModal();
    } catch (err) {
      console.error("Erro ao salvar evento:", err);
      toast.show("Erro ao salvar. Tente novamente.", { type: "error" });
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
    if (!canViewFinance) {
      toast.show("Você não tem permissão para alterar informações financeiras.", {
        type: "error",
      });
      return;
    }

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
      await updateEventCloud(ownerId, id, { ...found, surgery: next.surgery });
    } catch (err) {
      console.error("Erro ao alternar status de pagamento:", err);
      toast.show("Erro ao salvar. Tente novamente.", { type: "error" });
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
      toast.show(
        "Não há cirurgias para exportar com os filtros atuais do financeiro.",
        { type: "info" }
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
      toast.show("Não há eventos na agenda para exportar.", { type: "info" });
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
  //   ESTADOS DE LOGIN / RECUPERAÇÃO DE SENHA
  // -----------------------------
  if (passwordRecovery) {
    return <ResetPassword onDone={() => setPasswordRecovery(false)} />;
  }

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

  // A conta administrativa da plataforma tem uma experiência totalmente
  // separada: nada de agenda/pacientes/financeiro, só controle de acesso.
  if (!adminCheckDone) {
    return (
      <div className="min-h-dvh bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-2xl p-4">Carregando…</div>
      </div>
    );
  }

  if (isPlatformAdmin) {
    return (
      <AdminHome
        profile={profile}
        refreshProfile={refreshProfile}
        onLogout={handleLogout}
      />
    );
  }

  // Conta bloqueada pelo administrador: nada de agenda, só o aviso.
  if (profile?.blocked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-sky-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow dark:bg-slate-900">
          <div className="mb-3 text-3xl">🚫</div>
          <h1 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
            Acesso bloqueado
          </h1>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            O acesso a esta conta foi bloqueado pelo administrador da
            plataforma. Entre em contato com{" "}
            <strong>procorptecnologia@gmail.com</strong> para mais
            informações.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Sair
          </button>
        </div>
      </div>
    );
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
          id: editing.id,
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
          patientId: editing.patientId ?? null,
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
        profile={profile}
        email={user?.email}
      />

      {tab === "today" && (
        <Today
          events={eventsWithRecurrenceApplied}
          onOpen={openEdit}
          patients={patients}
          ownerId={ownerId}
          showDashboard={isOwner}
        />
      )}

      {tab === "agenda" && (
        <Agenda
          events={eventsWithRecurrenceApplied}
          onOpen={openEdit}
        />
      )}

      {tab === "finance" && canViewFinance && (
        <Finance
          events={events}
          onTogglePaid={togglePaid}
          onOpen={openEdit}
          ownerId={ownerId}
          canEdit={canEdit}
        />
      )}

      {tab === "settings" && (
        <Settings
          theme={theme}
          onToggleTheme={toggle}
          onExportFinance={exportFinanceCSV}
          onExportAgenda={exportAgendaCSV}
          ownerId={ownerId}
          isOwner={isOwner}
          canEdit={canEdit}
          canViewFinance={canViewFinance}
          patients={patients}
          refreshPatients={refreshPatients}
          profile={profile}
          refreshProfile={refreshProfile}
        />
      )}

      {canCreate && <Fab onClick={openNew} />}
      <BottomNav tab={tab} setTab={setTab} showFinance={canViewFinance} />

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
          patients={patients}
          refreshPatients={refreshPatients}
          ownerId={ownerId}
          canViewFinance={canViewFinance}
          canEdit={canEdit}
          canCreate={canCreate}
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
        description="Deseja aplicar esta alteração apenas neste compromisso (remarcar mantendo o vínculo com a série, se só a data/hora mudou) ou em toda a série?"
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
