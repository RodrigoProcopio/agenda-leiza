import { supabase } from "./supabase";

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user ?? null;
}

export async function fetchEvents() {
  const user = await getSessionUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id) // ✅ filtra por usuário
    .order("start_iso", { ascending: true });

  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    location: r.location,
    notes: r.notes,

    // ✅ mantém como vem do banco (com timezone, ex: +00:00)
    startISO: r.start_iso,
    endISO: r.end_iso,

    surgery: r.surgery,
    recurrenceId: r.recurrence_id,
  }));
}

export async function createEvent(ev) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const payload = {
    user_id: user.id,
    type: ev.type,
    title: ev.title ?? null,
    location: ev.location ?? null,
    notes: ev.notes ?? null,
    start_iso: ev.startISO,
    end_iso: ev.endISO,
    surgery: ev.surgery ?? null,
    recurrence_id: ev.recurrenceId ?? null,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return {
    ...ev,
    id: data.id,
    startISO: data.start_iso,
    endISO: data.end_iso,
    recurrenceId: data.recurrence_id,
    surgery: data.surgery,
  };
}

export async function updateEvent(id, ev) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("events")
    .update({
      type: ev.type,
      title: ev.title ?? null,
      location: ev.location ?? null,
      notes: ev.notes ?? null,
      start_iso: ev.startISO,
      end_iso: ev.endISO,
      surgery: ev.surgery ?? null,
      recurrence_id: ev.recurrenceId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id); // ✅ garante que só atualiza do dono

  if (error) throw error;
}

export async function deleteEvent(id) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // ✅ garante que só apaga do dono

  if (error) throw error;
}

export async function deleteEventsByRecurrence(recurrenceId) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("user_id", user.id); // ✅ garante que só apaga do dono

  if (error) throw error;
}
