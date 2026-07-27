import { supabase } from "./supabase";

function mapRow(r) {
  return {
    id: r.id,
    eventId: r.event_id,
    amount: Number(r.amount),
    method: r.method,
    paidAt: r.paid_at,
    notes: r.notes,
    createdByName: r.created_by_name ?? null,
    createdByUserId: r.created_by_user_id ?? null,
  };
}

export const PAYMENT_METHODS = [
  { id: "pix", label: "Pix" },
  { id: "cartao", label: "Cartão" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "transferencia", label: "Transferência" },
  { id: "outro", label: "Outro" },
];

export async function fetchPaymentsForEvent(eventId) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("event_id", eventId)
    .order("paid_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function fetchPaymentsForOwner(ownerId) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", ownerId)
    .order("paid_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function addPayment(ownerId, eventId, payment) {
  const payload = {
    user_id: ownerId,
    event_id: eventId,
    amount: payment.amount,
    method: payment.method || "outro",
    paid_at: payment.paidAt || new Date().toISOString().slice(0, 10),
    notes: payment.notes || null,
  };

  const { data, error } = await supabase
    .from("payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deletePayment(id) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}
