import { supabase } from "./supabase";

/**
 * Resolve o contexto de "prática" do usuário logado:
 * - Se o usuário é o próprio dono dos dados (médica), ownerId = seu próprio id.
 * - Se o usuário é um membro convidado (secretária/assistente), ownerId é o id
 *   do médico dono da agenda, e as permissões vêm da linha em practice_members.
 */
export async function resolvePracticeContext() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data, error: memberError } = await supabase
    .from("practice_members")
    .select("owner_user_id, role, can_edit, can_view_finance")
    .eq("member_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    console.error("Erro ao resolver contexto da prática:", memberError);
  }

  if (data) {
    return {
      userId: user.id,
      ownerId: data.owner_user_id,
      isOwner: false,
      role: data.role,
      canEdit: !!data.can_edit,
      canViewFinance: !!data.can_view_finance,
    };
  }

  return {
    userId: user.id,
    ownerId: user.id,
    isOwner: true,
    role: "owner",
    canEdit: true,
    canViewFinance: true,
  };
}

export async function fetchMembers(ownerId) {
  const { data, error } = await supabase
    .from("practice_members")
    .select("id, member_user_id, role, can_edit, can_view_finance, invited_email, created_at")
    .eq("owner_user_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function inviteMember({ email, role, canEdit, canViewFinance }) {
  const { data, error } = await supabase.functions.invoke("invite-member", {
    body: {
      email,
      role,
      can_edit: canEdit,
      can_view_finance: canViewFinance,
    },
  });

  if (error) {
    // Tenta extrair a mensagem de erro do corpo da resposta, se disponível
    const message = error?.context?.body
      ? await error.context
          .json()
          .then((b) => b?.error)
          .catch(() => null)
      : null;
    throw new Error(message || error.message || "Erro ao convidar usuário.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function updateMemberPermissions(id, { canEdit, canViewFinance }) {
  const { error } = await supabase
    .from("practice_members")
    .update({ can_edit: canEdit, can_view_finance: canViewFinance })
    .eq("id", id);

  if (error) throw error;
}

export async function removeMember(id) {
  const { error } = await supabase.from("practice_members").delete().eq("id", id);
  if (error) throw error;
}
