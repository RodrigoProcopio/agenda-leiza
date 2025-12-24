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
    recurrence: r.recurrence ?? null,
    isException: !!r.is_exception,
  };
}

export async function fetchEvents() {
  const user = await getSessionUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .order("start_iso", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapRow);
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
    recurrence: ev.recurrence ?? null,
    is_exception: !!ev.isException,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function createEventsBulk(events) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const payload = (events || []).map((ev) => ({
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

  if (!payload.length) return [];

  const { data, error } = await supabase.from("events").insert(payload).select("*");
  if (error) throw error;

  return (data || []).map(mapRow);
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
      recurrence: ev.recurrence ?? null,
      is_exception: !!ev.isException,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
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
