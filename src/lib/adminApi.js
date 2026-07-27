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
    blocked: !!r.blocked,
    blockedAt: r.blocked_at,
  };
}

export async function fetchAdminAccounts() {
  const { data, error } = await supabase.rpc("admin_list_accounts");
  if (error) throw error;
  return (data || []).map(mapAccountRow);
}

async function extractFunctionError(error, fallback) {
  const message = error?.context?.body
    ? await error.context
        .json()
        .then((b) => b?.error)
        .catch(() => null)
    : null;
  return new Error(message || error.message || fallback);
}

export async function createAdminAccount({ email, displayName, title, password, asPlatformAdmin }) {
  const { data, error } = await supabase.functions.invoke("admin-create-account", {
    body: { email, displayName, title, password, asPlatformAdmin: !!asPlatformAdmin },
  });

  if (error) throw await extractFunctionError(error, "Erro ao criar conta.");
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function setAccountBlocked(userId, blocked) {
  const { error } = await supabase.rpc("admin_set_blocked", {
    target_user_id: userId,
    p_blocked: blocked,
  });
  if (error) throw error;
}

export async function deleteAccount(userId) {
  const { data, error } = await supabase.functions.invoke("admin-delete-account", {
    body: { userId },
  });

  if (error) throw await extractFunctionError(error, "Erro ao excluir conta.");
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function sendPasswordRecovery(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}
