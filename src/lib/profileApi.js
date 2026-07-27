import { supabase } from "./supabase";

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    displayName: r.display_name,
    title: r.title,
    avatarUrl: r.avatar_url,
    secondaryEmail: r.secondary_email,
    info: r.info,
    blocked: !!r.blocked,
    blockedAt: r.blocked_at,
  };
}

export async function fetchOwnProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    ...(mapRow(data) || {
      id: user.id,
      displayName: null,
      title: null,
      avatarUrl: null,
      secondaryEmail: null,
      info: null,
      blocked: false,
      blockedAt: null,
    }),
    email: user.email,
  };
}

export async function saveOwnProfile({ displayName, title, secondaryEmail, info }) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Sessão inválida.");

  const payload = { id: user.id };
  if (displayName !== undefined) payload.display_name = displayName || null;
  if (title !== undefined) payload.title = title || null;
  if (secondaryEmail !== undefined) payload.secondary_email = secondaryEmail || null;
  if (info !== undefined) payload.info = info || null;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return { ...mapRow(data), email: user.email };
}

export async function uploadOwnAvatar(file) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Sessão inválida.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  // adiciona um "cache-buster" para a imagem atualizar na hora na UI
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, avatar_url: avatarUrl }, { onConflict: "id" });

  if (updateError) throw updateError;

  return avatarUrl;
}

// Troca o e-mail de login da própria conta. O Supabase dispara um e-mail de
// confirmação (para o e-mail novo, e possivelmente para o antigo também,
// dependendo da configuração do projeto) antes de efetivar a troca.
export async function changeOwnEmail(newEmail) {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

// Troca a senha da própria conta (usuário já autenticado).
export async function changeOwnPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
