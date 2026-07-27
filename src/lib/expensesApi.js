import { supabase } from "./supabase";

function mapRow(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    amount: Number(r.amount),
    expenseDate: r.expense_date,
    notes: r.notes,
    createdByName: r.created_by_name ?? null,
    createdByUserId: r.created_by_user_id ?? null,
  };
}

export async function fetchExpenses(ownerId) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", ownerId)
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function addExpense(ownerId, expense) {
  const payload = {
    user_id: ownerId,
    title: expense.title,
    category: expense.category || "outro",
    amount: expense.amount,
    expense_date: expense.expenseDate || new Date().toISOString().slice(0, 10),
    notes: expense.notes || null,
  };

  const { data, error } = await supabase
    .from("expenses")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
