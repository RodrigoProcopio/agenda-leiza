import { supabase } from "./supabase";

/**
 * Viagens (roteiros) às quais o usuário logado tem acesso.
 * O conteúdo do roteiro fica no banco (protegido por RLS) e não no código,
 * para que dados pessoais da viagem não fiquem no repositório público.
 */
export async function fetchMyTrips() {
  const { data, error } = await supabase
    .from("trips")
    .select("id, title, data, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchTripStatus(tripId) {
  const { data, error } = await supabase
    .from("trip_item_status")
    .select("item_key, done, done_at, done_by")
    .eq("trip_id", tripId);

  if (error) throw error;

  const map = {};
  for (const r of data || []) {
    map[r.item_key] = { done: !!r.done, doneAt: r.done_at, doneBy: r.done_by };
  }
  return map;
}

export async function setTripItemDone(tripId, itemKey, done) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date().toISOString();
  const { error } = await supabase.from("trip_item_status").upsert(
    {
      trip_id: tripId,
      item_key: itemKey,
      done,
      done_at: done ? now : null,
      done_by: done ? user?.id ?? null : null,
      updated_at: now,
    },
    { onConflict: "trip_id,item_key" }
  );

  if (error) throw error;
}

// ---------------------------------------------------------------
// Itens extras do checklist, adicionados pelo casal no app
// ---------------------------------------------------------------
export async function fetchChecklistCustom(tripId) {
  const { data, error } = await supabase
    .from("trip_checklist_custom")
    .select("id, category_id, text, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addChecklistCustom(tripId, categoryId, text) {
  const { data, error } = await supabase
    .from("trip_checklist_custom")
    .insert({ trip_id: tripId, category_id: categoryId, text })
    .select("id, category_id, text, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChecklistCustom(id) {
  const { error } = await supabase.from("trip_checklist_custom").delete().eq("id", id);
  if (error) throw error;
}
