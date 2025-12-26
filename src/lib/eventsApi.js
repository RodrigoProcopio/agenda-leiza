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

  if (!user) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    // 👇 ordena pela coluna real do banco
    .order("start_iso", { ascending: true });

  if (error) {
    console.error("Erro ao buscar eventos:", error);
    throw error;
  }

  // 👇 agora converte tudo pra startISO/endISO
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

  // 👇 monta payload no formato da TABELA (snake_case)
  const full = {
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
    .insert(full)
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar evento:", error);
    throw error;
  }

  // devolve no formato que o app espera
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

  // 👇 converte cada item para o formato da tabela
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
    .select();

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
 */
export async function restoreBackupEvents(events) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

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

  // `events` vem em camelCase, o createEventsBulk já converte
  return await createEventsBulk(events);
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

  if (error) throw error;
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
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("user_id", user.id)
    .eq("is_exception", false);

  if (error) throw error;
}
