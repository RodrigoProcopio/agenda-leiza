import { supabase } from "./supabase";

export async function checkIsPlatformAdmin() {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) {
    console.error("Erro ao verificar admin da plataforma:", error);
    return false;
  }
  return !!data;
}

function mapAccountRow(r) {
  return {
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    title: r.title,
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at,
    membersCount: Number(r.members_count || 0),
  };
}

export async function fetchAdminAccounts() {
  const { data, error } = await supabase.rpc("admin_list_accounts");
  if (error) throw error;
  return (data || []).map(mapAccountRow);
}

export async function createAdminAccount({ email, displayName, title }) {
  const { data, error } = await supabase.functions.invoke("admin-create-account", {
    body: { email, displayName, title },
  });

  if (error) {
    const message = error?.context?.body
      ? await error.context
          .json()
          .then((b) => b?.error)
          .catch(() => null)
      : null;
    throw new Error(message || error.message || "Erro ao criar conta.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
