import { supabase } from "./supabase";

function mapRow(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    birthDate: r.birth_date,
    notes: r.notes,
  };
}

export async function fetchPatients(ownerId) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("user_id", ownerId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function createPatient(ownerId, patient) {
  const payload = {
    user_id: ownerId,
    name: patient.name,
    phone: patient.phone || null,
    email: patient.email || null,
    birth_date: patient.birthDate || null,
    notes: patient.notes || null,
  };

  const { data, error } = await supabase
    .from("patients")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updatePatient(id, patient) {
  const payload = {
    name: patient.name,
    phone: patient.phone || null,
    email: patient.email || null,
    birth_date: patient.birthDate || null,
    notes: patient.notes || null,
  };

  const { data, error } = await supabase
    .from("patients")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deletePatient(id) {
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) throw error;
}
