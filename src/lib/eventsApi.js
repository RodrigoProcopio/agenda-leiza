import { supabase } from "./supabase";

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user ?? null;
}

/**
 * Converte linha do banco (snake_case) → objeto do app (camelCase)
 */
function mapRow(r) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    location: r.location,
    notes: r.notes,
    startISO: r.start_iso,
    endISO: r.end_iso,
    surgery: r.surgery,
    recurrenceId: r.recurrence_id,
    recurrence: r.recurrence,
    isException: r.is_exception,
  };
}

/**
 * Buscar eventos do usuário atual
 */
export async function fetchEvents() {
  const session = await supabase.auth.getSession();
  const user = session.data?.session?.user;

  console.log("[fetchEvents] session user:", user);

  // Se não tiver usuário, já avisa no console e retorna vazio
  if (!user) {
    console.warn("[fetchEvents] Nenhum usuário logado. Retornando [].");
    return [];
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    // 👇 se quiser testar sem filtro, comente essa linha TEMPORARIAMENTE
    .eq("user_id", user.id)
    .order("start_iso", { ascending: true });

  if (error) {
    console.error("[fetchEvents] Erro ao buscar eventos:", error);
    throw error;
  }

  console.log("[fetchEvents] Linhas recebidas do Supabase:", data);

  return (data || []).map(mapRow);
}

/**
 * Criar 1 evento
 */
export async function createEvent(event) {
  const session = await supabase.auth.getSession();
  const user = session.data?.session?.user;

  if (!user) {
    throw new Error("Usuário não autenticado ao criar evento");
  }

  const payload = {
    user_id: user.id,
    type: event.type,
    title: event.title ?? null,
    location: event.location ?? null,
    notes: event.notes ?? null,
    start_iso: event.startISO,
    end_iso: event.endISO,
    surgery: event.surgery ?? null,
    recurrence_id: event.recurrenceId ?? null,
    recurrence: event.recurrence ?? null,
    is_exception: !!event.isException,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao criar evento:", error);
    throw error;
  }

  return mapRow(data);
}

/**
 * Criar vários eventos (recorrência)
 */
export async function createEventsBulk(list) {
  const session = await supabase.auth.getSession();
  const user = session.data?.session?.user;

  if (!user) {
    throw new Error("Usuário não autenticado ao criar eventos");
  }

  const final = (list || []).map((ev) => ({
    user_id: user.id,
    type: ev.type,
    title: ev.title ?? null,
    location: ev.location ?? null,
    notes: ev.notes ?? null,
    start_iso: ev.startISO,
    end_iso: ev.endISO,
    surgery: ev.surgery ?? null,
    recurrence_id: ev.recurrenceId ?? null,
    recurrence: ev.recurrence ?? null,
    is_exception: !!ev.isException,
  }));

  if (!final.length) return [];

  const { data, error } = await supabase
    .from("events")
    .insert(final)
    .select("*");

  if (error) {
    console.error("Erro ao criar eventos recorrentes:", error);
    throw error;
  }

  return (data || []).map(mapRow);
}

/**
 * Restaurar backup completo:
 * - apaga todos os eventos do usuário atual
 * - reimporta os eventos do arquivo de backup
 *
 * Aceita backup tanto em camelCase (startISO) quanto snake_case (start_iso)
 */
export async function restoreBackupEvents(events) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  // 1) Apaga tudo do usuário
  const { error: delError } = await supabase
    .from("events")
    .delete()
    .eq("user_id", user.id);

  if (delError) {
    console.error("Erro ao apagar eventos antes de restaurar backup:", delError);
    throw delError;
  }

  if (!events || !events.length) {
    return [];
  }

  // 2) Normaliza o backup para o formato camelCase que o createEventsBulk usa
  const normalized = events.map((ev) => ({
    id: ev.id,
    type: ev.type,
    title: ev.title ?? null,
    location: ev.location ?? null,
    notes: ev.notes ?? null,
    startISO: ev.startISO ?? ev.start_iso,
    endISO: ev.endISO ?? ev.end_iso,
    surgery: ev.surgery ?? null,
    recurrenceId: ev.recurrenceId ?? ev.recurrence_id ?? null,
    recurrence: ev.recurrence ?? null,
    isException: ev.isException ?? ev.is_exception ?? false,
  }));

  // 3) Reinsere (createEventsBulk já seta user_id = auth user)
  return await createEventsBulk(normalized);
}

/**
 * Atualizar evento
 */
export async function updateEvent(id, ev) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const payload = {
    type: ev.type,
    title: ev.title ?? null,
    location: ev.location ?? null,
    notes: ev.notes ?? null,
    start_iso: ev.startISO,
    end_iso: ev.endISO,
    surgery: ev.surgery ?? null,
    recurrence_id: ev.recurrenceId ?? null,
    recurrence: ev.recurrence ?? null,
    is_exception: !!ev.isException,
  };

  const { data, error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao atualizar evento:", error);
    throw error;
  }

  return mapRow(data);
}

/**
 * Deletar 1 evento
 */
export async function deleteEvent(id) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Deletar todos os eventos de uma recorrência (exceto exceções)
 */
export async function deleteEventsByRecurrence(recurrenceId) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticicado");

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("user_id", user.id)
    .eq("is_exception", false);

  if (error) throw error;
}
