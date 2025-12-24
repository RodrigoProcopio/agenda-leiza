import { supabase } from "./supabase";
import { getSessionUser } from "./eventsApi";

export async function fetchRecurrenceExceptions(recurrenceId) {
  const user = await getSessionUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("recurrence_exceptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("recurrence_id", recurrenceId);

  if (error) throw error;
  return data || [];
}

export async function addRecurrenceException(recurrenceId, dayKey) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("recurrence_exceptions").insert({
    user_id: user.id,
    recurrence_id: recurrenceId,
    day_key: dayKey,
  });

  if (error) throw error;
}

export async function deleteRecurrenceExceptions(recurrenceId) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("recurrence_exceptions")
    .delete()
    .eq("user_id", user.id)
    .eq("recurrence_id", recurrenceId);

  if (error) throw error;
}
