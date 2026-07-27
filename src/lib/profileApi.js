import { supabase } from "./supabase";

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    displayName: r.display_name,
    title: r.title,
    avatarUrl: r.avatar_url,
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
    ...(mapRow(data) || { id: user.id, displayName: null, title: null, avatarUrl: null }),
    email: user.email,
  };
}

export async function saveOwnProfile({ displayName, title }) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Sessão inválida.");

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName || null,
        title: title || null,
      },
      { onConflict: "id" }
    )
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
