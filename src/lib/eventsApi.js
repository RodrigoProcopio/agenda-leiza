import { supabase } from "./supabase";

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user ?? null;
}

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

export async function fetchEvents() {
  const session = await supabase.auth.getSession();
  const user = session.data?.session?.user;

  if (!user) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .order("startISO", { ascending: true });

  if (error) {
    console.error("Erro ao buscar eventos:", error);
    throw error;
  }

  return data;
}


export async function createEvent(event) {
  const session = await supabase.auth.getSession();
  const user = session.data?.session?.user;

  if (!user) {
    throw new Error("Usuário não autenticado ao criar evento");
  }

  const full = {
    ...event,
    user_id: user.id,
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

  return data;
}

export async function createEventsBulk(list) {
  const session = await supabase.auth.getSession();
  const user = session.data?.session?.user;

  if (!user) {
    throw new Error("Usuário não autenticado ao criar eventos");
  }

  const final = list.map(ev => ({
    ...ev,
    user_id: user.id,
  }));

  const { data, error } = await supabase
    .from("events")
    .insert(final)
    .select();

  if (error) {
    console.error("Erro ao criar eventos recorrentes:", error);
    throw error;
  }

  return data;
}

/**
 * Restaurar backup completo:
 * - apaga todos os eventos do usuário atual
 * - reimporta os eventos do arquivo de backup
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

  // 2) Se o backup vier vazio, nada a inserir
  if (!events || !events.length) {
    return [];
  }

  // 3) Reinsere usando a mesma lógica de bulk
  return await createEventsBulk(events);
}

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

export async function deleteEventsByRecurrence(recurrenceId) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  // não apaga exceções
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("user_id", user.id)
    .eq("is_exception", false);

  if (error) throw error;
}
