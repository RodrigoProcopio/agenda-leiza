import { supabase } from "./supabase";

export async function fetchRecurrenceExceptions(ownerId, recurrenceId) {
  if (!ownerId || !recurrenceId) return [];

  const { data, error } = await supabase
    .from("recurrence_exceptions")
    .select("*")
    .eq("user_id", ownerId)
    .eq("recurrence_id", recurrenceId);

  if (error) throw error;
  return data || [];
}

/**
 * Marca uma ocorrência como cancelada (some da tela); usado quando o
 * usuário edita conteúdo além de data/hora e a alteração vira um evento
 * avulso separado.
 */
export async function addRecurrenceException(ownerId, recurrenceId, dayKey) {
  if (!ownerId) throw new Error("ownerId é obrigatório");

  const { error } = await supabase.from("recurrence_exceptions").upsert(
    {
      user_id: ownerId,
      recurrence_id: recurrenceId,
      day_key: dayKey,
      type: "cancel",
      new_start_iso: null,
      new_end_iso: null,
    },
    { onConflict: "recurrence_id,day_key" }
  );

  if (error) throw error;
}

/**
 * Remarca uma única ocorrência (nova data/hora), mantendo o vínculo com a
 * série — ao contrário de "cancelar", a ocorrência não vira um evento
 * avulso: ela continua fazendo parte da recorrência, só que exibida em
 * outro horário.
 */
export async function saveRescheduleException(
  ownerId,
  recurrenceId,
  dayKey,
  newStartISO,
  newEndISO
) {
  if (!ownerId) throw new Error("ownerId é obrigatório");

  const { error } = await supabase.from("recurrence_exceptions").upsert(
    {
      user_id: ownerId,
      recurrence_id: recurrenceId,
      day_key: dayKey,
      type: "reschedule",
      new_start_iso: newStartISO,
      new_end_iso: newEndISO,
    },
    { onConflict: "recurrence_id,day_key" }
  );

  if (error) throw error;
}

export async function deleteRecurrenceExceptions(ownerId, recurrenceId) {
  if (!ownerId) throw new Error("ownerId é obrigatório");

  const { error } = await supabase
    .from("recurrence_exceptions")
    .delete()
    .eq("user_id", ownerId)
    .eq("recurrence_id", recurrenceId);

  if (error) throw error;
}
