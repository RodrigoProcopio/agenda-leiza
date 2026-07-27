import React, { useEffect, useState } from "react";
import {
  fetchAdminAccounts,
  createAdminAccount,
  setAccountBlocked,
  deleteAccount,
  sendPasswordRecovery,
} from "../lib/adminApi.js";
import {
  saveOwnProfile,
  uploadOwnAvatar,
  changeOwnEmail,
  changeOwnPassword,
} from "../lib/profileApi.js";
import { useToast } from "../components/Toast.jsx";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

const sectionTitle =
  "text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200";

const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:ring-sky-400";

const outlineBtn =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

const dangerBtn =
  "inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10";

const warnBtn =
  "inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-700 shadow-sm hover:bg-amber-50 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-500/10";

const inputBase =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

const miniLabel =
  "mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

function formatDateTime(iso) {
  if (!iso) return "Nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function AdminHome({ profile, refreshProfile, onLogout }) {
  const toast = useToast();

  return (
    <div className="min-h-dvh bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-sky-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-blue-900 dark:text-sky-200">
              Administrador da plataforma
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Painel administrativo
            </h1>
          </div>
          <button
            onClick={onLogout}
            title="Sair"
            className="rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            ⏻
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-16 pt-4">
        <div className="space-y-4">
          <AdminProfileSection profile={profile} refreshProfile={refreshProfile} toast={toast} />
          <AdminSecuritySection toast={toast} />
          <AccountsSection toast={toast} />
          <CreateAccountSection toast={toast} />
          <PlatformInfoSection />
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
//   PERFIL DO ADMIN
// -----------------------------------------------------------------------
function AdminProfileSection({ profile, refreshProfile, toast }) {
  const [displayName, setDisplayName] = useState("");
  const [info, setInfo] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "");
    setInfo(profile.info || "");
    setSecondaryEmail(profile.secondaryEmail || "");
  }, [profile?.id, profile?.displayName, profile?.info, profile?.secondaryEmail]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await saveOwnProfile({
        displayName: displayName.trim(),
        title: profile?.title || "",
        secondaryEmail: secondaryEmail.trim(),
        info: info.trim(),
      });
      await refreshProfile?.();
      toast.show("Perfil atualizado.", { type: "success" });
    } catch (err) {
      console.error("Erro ao salvar perfil admin:", err);
      toast.show(err?.message || "Erro ao salvar perfil.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      setUploading(true);
      await uploadOwnAvatar(file);
      await refreshProfile?.();
      toast.show("Foto atualizada.", { type: "success" });
    } catch (err) {
      console.error("Erro ao enviar foto:", err);
      toast.show(err?.message || "Erro ao enviar foto.", { type: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleChangeEmail(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const ok = window.confirm(
      `Trocar o e-mail de login para "${newEmail.trim()}"? Você vai precisar confirmar pelo link enviado antes que a troca seja concluída.`
    );
    if (!ok) return;

    try {
      setSavingEmail(true);
      await changeOwnEmail(newEmail.trim());
      toast.show(
        "Enviamos um e-mail de confirmação. A troca só é concluída depois de confirmar o link.",
        { type: "success" }
      );
      setNewEmail("");
    } catch (err) {
      console.error("Erro ao trocar e-mail:", err);
      toast.show(err?.message || "Erro ao trocar e-mail.", { type: "error" });
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 flex items-center">
        <span className={sectionTitle}>Perfil do administrador</span>
      </div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Essas informações são exclusivas da conta administrativa.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg text-slate-400">
              📷
            </div>
          )}
        </div>
        <div>
          <input
            type="file"
            accept="image/*"
            id="admin-avatar-file-input"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => document.getElementById("admin-avatar-file-input")?.click()}
            disabled={uploading}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {uploading ? "Enviando..." : "Alterar foto"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={miniLabel}>Nome</span>
          <input
            className={inputBase}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>
        <div>
          <span className={miniLabel}>E-mail secundário (opcional)</span>
          <input
            className={inputBase}
            type="email"
            value={secondaryEmail}
            onChange={(e) => setSecondaryEmail(e.target.value)}
            placeholder="contato-alternativo@exemplo.com"
          />
        </div>
        <div className="sm:col-span-2">
          <span className={miniLabel}>Informações</span>
          <textarea
            className={`${inputBase} min-h-[80px] resize-y`}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            placeholder="Anotações internas sobre a administração da plataforma..."
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </form>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <span className={miniLabel}>E-mail de login atual</span>
        <input className={inputBase} value={profile?.email || ""} disabled readOnly />

        <form onSubmit={handleChangeEmail} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className={inputBase}
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Novo e-mail de login"
          />
          <button type="submit" disabled={savingEmail} className={outlineBtn}>
            {savingEmail ? "Enviando..." : "Trocar e-mail"}
          </button>
        </form>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          A troca só é concluída após confirmar o link enviado para o novo e-mail.
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
//   SEGURANÇA (TROCAR SENHA)
// -----------------------------------------------------------------------
function AdminSecuritySection({ toast }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.show("A senha deve ter pelo menos 8 caracteres.", { type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.show("As senhas não coincidem.", { type: "error" });
      return;
    }

    try {
      setSaving(true);
      await changeOwnPassword(newPassword);
      toast.show("Senha atualizada com sucesso.", { type: "success" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Erro ao trocar senha:", err);
      toast.show(err?.message || "Erro ao trocar senha.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 flex items-center">
        <span className={sectionTitle}>Segurança</span>
      </div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Troque a senha da sua própria conta de administrador.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={miniLabel}>Nova senha</span>
          <input
            type="password"
            className={inputBase}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <div>
          <span className={miniLabel}>Confirmar nova senha</span>
          <input
            type="password"
            className={inputBase}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? "Salvando..." : "Trocar senha"}
          </button>
        </div>
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------
//   CONTAS DE USUÁRIOS
// -----------------------------------------------------------------------
function AccountsSection({ toast }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchAdminAccounts();
      setAccounts(list || []);
    } catch (err) {
      console.error("Erro ao carregar contas:", err);
      setError(err?.message || "Erro ao carregar contas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalMembers = accounts.reduce((acc, a) => acc + (a.membersCount || 0), 0);

  async function handleToggleBlocked(a) {
    const next = !a.blocked;
    const ok = window.confirm(
      next
        ? `Bloquear o acesso de "${a.email}"? A pessoa verá uma tela informando o bloqueio no próximo login.`
        : `Desbloquear o acesso de "${a.email}"?`
    );
    if (!ok) return;

    try {
      setBusyId(a.userId);
      await setAccountBlocked(a.userId, next);
      toast.show(next ? "Conta bloqueada." : "Conta desbloqueada.", { type: "success" });
      await load();
    } catch (err) {
      console.error("Erro ao alterar bloqueio:", err);
      toast.show(err?.message || "Erro ao alterar bloqueio.", { type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(a) {
    const ok = window.confirm(
      `Excluir permanentemente a conta "${a.email}"? Isso apaga a agenda, pacientes e financeiro dessa conta. Essa ação não pode ser desfeita.`
    );
    if (!ok) return;

    try {
      setBusyId(a.userId);
      await deleteAccount(a.userId);
      toast.show("Conta excluída.", { type: "info" });
      await load();
    } catch (err) {
      console.error("Erro ao excluir conta:", err);
      toast.show(err?.message || "Erro ao excluir conta.", { type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendRecovery(a) {
    try {
      setBusyId(a.userId);
      await sendPasswordRecovery(a.email);
      toast.show(`E-mail de recuperação enviado para ${a.email}.`, { type: "success" });
    } catch (err) {
      console.error("Erro ao enviar recuperação:", err);
      toast.show(err?.message || "Erro ao enviar e-mail de recuperação.", { type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 flex items-center">
        <span className={sectionTitle}>Contas de usuários</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-800">
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {loading ? "…" : accounts.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Contas independentes
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-800">
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {loading ? "…" : totalMembers}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Secretárias/assistentes no total
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Por segurança, este painel não exibe agendas, dados de pacientes ou
        valores financeiros de nenhuma conta — cada conta é isolada e só seus
        próprios dados são visíveis para o dono.
      </p>

      {error && (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && <p className="mt-3 text-xs text-slate-500">Carregando contas...</p>}
      {!loading && accounts.length === 0 && !error && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Nenhuma conta encontrada.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {accounts.map((a) => (
          <div
            key={a.userId}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                  {[a.title, a.displayName].filter(Boolean).join(" ") || a.email}
                  {a.blocked && (
                    <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
                      Bloqueada
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{a.email}</div>
              </div>
              <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                <div>Criada em: {formatDateTime(a.createdAt)}</div>
                <div>Último acesso: {formatDateTime(a.lastSignInAt)}</div>
                <div>{a.membersCount} assistente(s)/secretária(s)</div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleToggleBlocked(a)}
                disabled={busyId === a.userId}
                className={warnBtn}
              >
                {a.blocked ? "Desbloquear" : "Bloquear"}
              </button>
              <button
                type="button"
                onClick={() => handleSendRecovery(a)}
                disabled={busyId === a.userId}
                className={outlineBtn}
              >
                Enviar recuperação de senha
              </button>
              <button
                type="button"
                onClick={() => handleDelete(a)}
                disabled={busyId === a.userId}
                className={dangerBtn}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
//   CRIAR NOVA CONTA
// -----------------------------------------------------------------------
function CreateAccountSection({ toast }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [asPlatformAdmin, setAsPlatformAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setCreating(true);
      await createAdminAccount({
        email: email.trim(),
        displayName: displayName.trim(),
        title: title.trim(),
        password: password.trim() || undefined,
        asPlatformAdmin,
      });
      toast.show(
        password.trim()
          ? "Conta criada com a senha definida."
          : "Convite enviado e conta pré-cadastrada com sucesso.",
        { type: "success" }
      );
      setEmail("");
      setDisplayName("");
      setTitle("");
      setPassword("");
      setAsPlatformAdmin(false);
    } catch (err) {
      console.error("Erro ao criar conta:", err);
      toast.show(err?.message || "Erro ao criar conta.", { type: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 flex items-center">
        <span className={sectionTitle}>Criar nova conta</span>
      </div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Cria uma conta independente (novo médico/dono de agenda). Se você
        definir uma senha, a conta já é criada pronta para uso (sem passar
        pelo fluxo de convite por e-mail); se deixar em branco, enviamos um
        convite para a pessoa definir a própria senha.
      </p>

      <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={miniLabel}>E-mail</span>
          <input
            className={inputBase}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="medico@exemplo.com"
            required
          />
        </div>
        <div>
          <span className={miniLabel}>Nome (opcional)</span>
          <input
            className={inputBase}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nome completo"
          />
        </div>
        <div>
          <span className={miniLabel}>Título (opcional)</span>
          <input
            className={inputBase}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dr., Dra., etc."
          />
        </div>
        <div>
          <span className={miniLabel}>Senha (opcional)</span>
          <input
            className={inputBase}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Deixe em branco para enviar convite"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={asPlatformAdmin}
              onChange={(e) => setAsPlatformAdmin(e.target.checked)}
            />
            Esta conta é administradora da plataforma
          </label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={creating} className={primaryBtn}>
            {creating ? "Criando..." : "Criar conta"}
          </button>
        </div>
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------
//   REFERÊNCIA TÉCNICA DA PLATAFORMA
// -----------------------------------------------------------------------
function PlatformInfoSection() {
  return (
    <div className={card}>
      <div className="mb-1 flex items-center">
        <span className={sectionTitle}>Como a plataforma funciona</span>
      </div>
      <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        <div>
          <span className={miniLabel}>Hospedagem e backend</span>
          Frontend (React + Vite) publicado na Netlify. Banco de dados,
          autenticação, storage de arquivos e funções de servidor rodam no
          Supabase (projeto <code>qbtihwrheorjxftwlfvv</code>).
        </div>
        <div>
          <span className={miniLabel}>Isolamento entre contas</span>
          Cada conta de médico(a) é um "tenant" independente: as tabelas de
          eventos, pacientes, pagamentos e despesas usam Row Level Security
          filtrando por <code>user_id</code>, então uma conta nunca enxerga
          dados de outra. Secretárias/assistentes recebem acesso à agenda do
          médico via a tabela <code>practice_members</code>, com permissões
          separadas (ver, criar, editar, ver financeiro).
        </div>
        <div>
          <span className={miniLabel}>Funções de servidor (Edge Functions)</span>
          <code>invite-member</code> (convida secretária/assistente),{" "}
          <code>admin-create-account</code> (cria contas novas de médico, com
          ou sem senha definida, opcionalmente já como admin),{" "}
          <code>admin-delete-account</code> (exclui uma conta e todos os
          dados vinculados, em cascata).
        </div>
        <div>
          <span className={miniLabel}>Bloqueio de acesso</span>
          Bloquear uma conta grava um sinalizador no perfil dela. No próximo
          login, em vez do sistema normal, a pessoa vê uma tela informando o
          bloqueio e pedindo contato com procorptecnologia@gmail.com. Os
          dados da conta não são apagados ao bloquear — só ao excluir.
        </div>
        <div>
          <span className={miniLabel}>Recuperação de senha</span>
          Tanto na tela de login quanto neste painel (por conta), o envio de
          e-mail de recuperação usa o fluxo padrão de autenticação do
          Supabase.
        </div>
      </div>
    </div>
  );
}
