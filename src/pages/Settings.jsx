import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { fetchEvents, restoreBackupEvents } from "../lib/eventsApi.js";
import {
  fetchMembers,
  inviteMember,
  updateMemberPermissions,
  removeMember,
} from "../lib/practiceApi.js";
import {
  createPatient,
  updatePatient,
  deletePatient,
} from "../lib/patientsApi.js";
import { saveOwnProfile, uploadOwnAvatar, changeOwnPassword } from "../lib/profileApi.js";
import { useToast } from "../components/Toast.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

// -----------------------------------------------------------------------
//   SEÇÃO RECOLHÍVEL (menu suspenso)
// -----------------------------------------------------------------------
// Cada seção de Configurações usa esse wrapper para poder ser aberta/fechada
// pelo próprio usuário. `defaultOpen` controla o estado inicial: a maioria
// das seções vem aberta, exceto "Trocar senha", que vem fechada.
function Collapsible({ card, sectionTitle, title, badge, defaultOpen = true, nested = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={nested ? "mt-5 border-t border-slate-200 pt-4 dark:border-slate-800" : card}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center">
          <span className={sectionTitle}>{title}</span>
          {badge}
        </span>
        <span
          className={`shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function Settings({
  theme,
  onToggleTheme,
  onExportFinance,
  onExportAgenda,
  ownerId,
  isOwner = true,
  canEdit = true,
  canViewFinance = true,
  canManagePatients = true,
  patients = [],
  refreshPatients,
  profile,
  refreshProfile,
}) {
  const toast = useToast();
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState(null);

  const card =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

  const sectionTitle =
    "text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200";

  const badgeSoon =
    "ml-2 rounded-lg bg-amber-200/60 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-300";

  const badgeNew =
    "ml-2 rounded-lg bg-emerald-200/70 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300";

  const primaryBtn =
    "inline-flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:ring-sky-400";

  const outlineBtn =
    "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

  const dangerBtn =
    "inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10";

  const inputBase =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

  const miniLabel =
    "mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

  async function handleBackupClick() {
    try {
      setBackupLoading(true);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;

      const events = (await fetchEvents(ownerId)) || [];

      const payload = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        events,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "backup_agenda_completo.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao gerar backup:", err);
      toast.show("Erro ao gerar backup. Tente novamente.", { type: "error" });
    } finally {
      setBackupLoading(false);
    }
  }

  function handleRestoreBackupChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // permite escolher o mesmo arquivo novamente se der erro
    event.target.value = "";

    setPendingRestoreFile(file);
  }

  async function confirmRestoreBackup() {
    const file = pendingRestoreFile;
    if (!file) return;

    try {
      setRestoreLoading(true);

      const text = await file.text();
      const json = JSON.parse(text);

      if (!json || !Array.isArray(json.events)) {
        toast.show(
          "Arquivo de backup inválido. Certifique-se de usar um arquivo gerado pelo próprio sistema.",
          { type: "error" }
        );
        return;
      }

      const eventsFromBackup = json.events;

      await restoreBackupEvents(ownerId, eventsFromBackup);

      // Recarrega a aplicação para refletir os novos dados
      window.location.reload();
    } catch (err) {
      console.error("Erro ao restaurar backup:", err);
      toast.show(
        err?.message ||
          "Ocorreu um erro ao restaurar o backup. Verifique se o arquivo é válido e tente novamente.",
        { type: "error" }
      );
    } finally {
      setRestoreLoading(false);
      setPendingRestoreFile(null);
    }
  }

  const isDark = theme === "dark";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-2">
      <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-50">
      </h2>

      <div className="space-y-4">
        {/* Perfil do usuário */}
        <ProfileSection
          profile={profile}
          refreshProfile={refreshProfile}
          card={card}
          sectionTitle={sectionTitle}
          badgeNew={badgeNew}
          inputBase={inputBase}
          primaryBtn={primaryBtn}
          miniLabel={miniLabel}
        />

        {/* Aparência e tema */}
        <Collapsible
          card={card}
          sectionTitle={sectionTitle}
          title="Aparência e tema"
          badge={<span className={badgeNew}>Novo</span>}
          defaultOpen
        >
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Escolha entre tema claro ou escuro. Essa configuração afeta todo o
            sistema e pode ser alterada a qualquer momento.
          </p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className={miniLabel}>Tema atual:</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {isDark ? "Tema escuro" : "Tema claro"}
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
              title={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-500"
                  : "border-amber-300 bg-amber-100 text-amber-500"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 21h6M10 18.5h4M12 3a6.5 6.5 0 00-3.2 12.16c.53.3.7.87.7 1.34v.5h5v-.5c0-.47.17-1.04.7-1.34A6.5 6.5 0 0012 3z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="currentColor"
                  fillOpacity={isDark ? 0 : 0.35}
                />
              </svg>
            </button>
          </div>
        </Collapsible>

        {/* Notificações (apenas para o dono da agenda) */}
        {isOwner && (
          <NotificationsSection card={card} sectionTitle={sectionTitle} miniLabel={miniLabel} />
        )}

        {/* Pacientes */}
        {canManagePatients && (
          <PatientsSection
            ownerId={ownerId}
            patients={patients}
            refreshPatients={refreshPatients}
            card={card}
            sectionTitle={sectionTitle}
            badgeNew={badgeNew}
            inputBase={inputBase}
            primaryBtn={primaryBtn}
            dangerBtn={dangerBtn}
            miniLabel={miniLabel}
          />
        )}

        {/* Financeiro e exportações */}
        {canViewFinance && (
          <Collapsible
            card={card}
            sectionTitle={sectionTitle}
            title="Financeiro e exportações"
            badge={<span className={badgeNew}>Novo</span>}
            defaultOpen
          >
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              Gere planilhas com os dados da agenda e do financeiro para análise
              externa, envio à contabilidade ou conferência manual.
            </p>

            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span className={miniLabel}>Exportações disponíveis:</span>
              </div>
              <ul className="list-inside list-disc">
                <li>agenda completa (todos os tipos de eventos) em CSV</li>
                <li>financeiro de cirurgias (valores, status, observações) em CSV</li>
              </ul>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onExportAgenda}
                className={`${outlineBtn} flex w-full items-center justify-center gap-2`}
              >
                📅 Exportar agenda (CSV)
              </button>
              <button
                type="button"
                onClick={onExportFinance}
                className={`${outlineBtn} flex w-full items-center justify-center gap-2`}
              >
                💳 Exportar financeiro (CSV)
              </button>
            </div>
          </Collapsible>
        )}

        {/* Integração com Google Agenda (em breve) */}
        <Collapsible
          card={card}
          sectionTitle={sectionTitle}
          title="Integração com Google Agenda"
          badge={<span className={badgeSoon}>Em breve</span>}
          defaultOpen
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Em breve será possível sincronizar sua agenda com o Google Agenda.
          </p>
        </Collapsible>

        {/* Usuários e permissões */}
        {isOwner && (
          <MembersSection
            ownerId={ownerId}
            card={card}
            sectionTitle={sectionTitle}
            badgeNew={badgeNew}
            inputBase={inputBase}
            primaryBtn={primaryBtn}
            dangerBtn={dangerBtn}
            miniLabel={miniLabel}
          />
        )}

        {/* Backup e segurança (apenas para o dono da agenda) */}
        {isOwner && (
          <Collapsible
            card={card}
            sectionTitle={sectionTitle}
            title="Backup e segurança"
            badge={<span className={badgeNew}>Novo</span>}
            defaultOpen
          >
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
              Gere um arquivo de backup completo com todos os eventos da agenda.
              Esse arquivo pode ser guardado como cópia de segurança ou usado para
              migrações futuras.
            </p>

            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span className={miniLabel}>Conteúdo do backup:</span>
              </div>
              <ul className="list-inside list-disc">
                <li>todos os eventos da agenda (consultório, cirurgias, pessoal)</li>
                <li>detalhes de cirurgias (valores, status de pagamento, notas)</li>
                <li>dados básicos da usuária (id, e-mail do Supabase)</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleBackupClick}
              disabled={backupLoading}
              className={`${primaryBtn} mt-3 flex w-full items-center justify-center gap-2`}
            >
              🛡️{" "}
              {backupLoading
                ? "Gerando backup..."
                : "Baixar backup completo (JSON)"}
            </button>

            {/* Input escondido para restaurar backup */}
            <input
              type="file"
              accept="application/json"
              id="backup-file-input"
              className="hidden"
              onChange={handleRestoreBackupChange}
            />

            <button
              type="button"
              onClick={() => {
                const input = document.getElementById("backup-file-input");
                if (input && !restoreLoading) {
                  input.click();
                }
              }}
              disabled={restoreLoading}
              className={`${outlineBtn} mt-2 flex w-full items-center justify-center gap-2`}
            >
              📤{" "}
              {restoreLoading
                ? "Restaurando backup..."
                : "Restaurar a partir de backup (JSON)"}
            </button>

            <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Atenção: a restauração vai substituir todos os eventos atuais da
              agenda pelos eventos contidos no arquivo de backup selecionado.
            </p>
          </Collapsible>
        )}
      </div>

      <ConfirmModal
        open={!!pendingRestoreFile}
        title="Restaurar backup"
        description="Restaurar o backup vai substituir TODOS os eventos atuais da agenda pelos eventos do arquivo selecionado. Deseja continuar?"
        confirmLabel={restoreLoading ? "Restaurando..." : "Restaurar"}
        onConfirm={confirmRestoreBackup}
        onCancel={() => setPendingRestoreFile(null)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------
//   PERFIL DO USUÁRIO
// -----------------------------------------------------------------------
const TITLE_OPTIONS = ["Dr.", "Dra.", "Sr.", "Sra.", "Prof.", "Profa."];
const CUSTOM_TITLE_VALUE = "__custom__";

function ProfileSection({
  profile,
  refreshProfile,
  card,
  sectionTitle,
  badgeNew,
  inputBase,
  primaryBtn,
  miniLabel,
}) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState("");
  const [titleSelect, setTitleSelect] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "");
    const t = profile.title || "";
    if (t && !TITLE_OPTIONS.includes(t)) {
      setTitleSelect(CUSTOM_TITLE_VALUE);
      setCustomTitle(t);
    } else {
      setTitleSelect(t);
      setCustomTitle("");
    }
  }, [profile?.id, profile?.title, profile?.displayName]);

  const effectiveTitle =
    titleSelect === CUSTOM_TITLE_VALUE ? customTitle.trim() : titleSelect;

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await saveOwnProfile({ displayName: displayName.trim(), title: effectiveTitle });
      await refreshProfile?.();
      toast.show("Perfil atualizado.", { type: "success" });
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      toast.show(err?.message || "Erro ao salvar perfil.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.show("A nova senha precisa ter pelo menos 6 caracteres.", { type: "error" });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.show("As senhas novas não coincidem.", { type: "error" });
      return;
    }

    if (!profile?.email) {
      toast.show("Não foi possível confirmar seu e-mail. Recarregue a página e tente novamente.", {
        type: "error",
      });
      return;
    }

    try {
      setChangingPassword(true);

      // Confirma a senha atual reautenticando antes de trocar, para evitar
      // que alguém com a sessão aberta troque a senha sem saber a atual.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: oldPassword,
      });

      if (signInError) {
        toast.show("Senha atual incorreta.", { type: "error" });
        return;
      }

      await changeOwnPassword(newPassword);
      toast.show("Senha atualizada com sucesso.", { type: "success" });
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      console.error("Erro ao trocar senha:", err);
      toast.show(err?.message || "Erro ao trocar senha.", { type: "error" });
    } finally {
      setChangingPassword(false);
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

  return (
    <Collapsible
      card={card}
      sectionTitle={sectionTitle}
      title="Perfil e conta"
      badge={<span className={badgeNew}>Novo</span>}
      defaultOpen
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Essas informações aparecem no topo do sistema.
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
            id="avatar-file-input"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => document.getElementById("avatar-file-input")?.click()}
            disabled={uploading}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {uploading ? "Enviando..." : "Alterar foto"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={miniLabel}>Como deseja ser chamado(a)</span>
          <select
            className={inputBase}
            value={titleSelect}
            onChange={(e) => setTitleSelect(e.target.value)}
          >
            <option value="">Nenhum</option>
            {TITLE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={CUSTOM_TITLE_VALUE}>Outro...</option>
          </select>
          {titleSelect === CUSTOM_TITLE_VALUE && (
            <input
              className={`${inputBase} mt-2`}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ex: Enfermeiro(a)"
            />
          )}
        </div>

        <div>
          <span className={miniLabel}>Nome</span>
          <input
            className={inputBase}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        <div className="sm:col-span-2">
          <span className={miniLabel}>E-mail (login)</span>
          <input className={inputBase} value={profile?.email || ""} disabled readOnly />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Para trocar o e-mail de login, entre em contato com o administrador do sistema.
          </p>
        </div>

        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </form>

      <Collapsible
        sectionTitle={sectionTitle}
        title="Trocar senha"
        defaultOpen={false}
        nested
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Para trocar a senha, informe sua senha atual e a nova senha desejada.
        </p>

        <form onSubmit={handleChangePassword} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className={miniLabel}>Senha atual</span>
            <input
              type="password"
              className={inputBase}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <span className={miniLabel}>Nova senha</span>
            <input
              type="password"
              className={inputBase}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <span className={miniLabel}>Confirmar nova senha</span>
            <input
              type="password"
              className={inputBase}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" disabled={changingPassword} className={primaryBtn}>
              {changingPassword ? "Trocando..." : "Trocar senha"}
            </button>
          </div>
        </form>
      </Collapsible>
    </Collapsible>
  );
}

// -----------------------------------------------------------------------
//   PACIENTES
// -----------------------------------------------------------------------
function PatientsSection({
  ownerId,
  patients,
  refreshPatients,
  card,
  sectionTitle,
  badgeNew,
  inputBase,
  primaryBtn,
  dangerBtn,
  miniLabel,
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [patientToRemove, setPatientToRemove] = useState(null);

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      if (editingId) {
        await updatePatient(editingId, { name: name.trim(), phone, email });
        toast.show("Paciente atualizado.", { type: "success" });
      } else {
        await createPatient(ownerId, { name: name.trim(), phone, email });
        toast.show("Paciente cadastrado.", { type: "success" });
      }
      resetForm();
      await refreshPatients?.();
    } catch (err) {
      console.error("Erro ao salvar paciente:", err);
      toast.show("Erro ao salvar paciente.", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setName(p.name || "");
    setPhone(p.phone || "");
    setEmail(p.email || "");
  }

  function handleDelete(p) {
    setPatientToRemove(p);
  }

  async function confirmDeletePatient() {
    const p = patientToRemove;
    if (!p) return;

    try {
      await deletePatient(p.id);
      toast.show("Paciente removido.", { type: "info" });
      if (editingId === p.id) resetForm();
      await refreshPatients?.();
    } catch (err) {
      console.error("Erro ao remover paciente:", err);
      toast.show("Erro ao remover paciente.", { type: "error" });
    } finally {
      setPatientToRemove(null);
    }
  }

  return (
    <Collapsible
      card={card}
      sectionTitle={sectionTitle}
      title="Pacientes"
      badge={<span className={badgeNew}>Novo</span>}
      defaultOpen
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Cadastre pacientes para vincular aos compromissos da agenda.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <span className={miniLabel}>Nome</span>
          <input
            className={inputBase}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do paciente"
            required
          />
        </div>
        <div className="sm:col-span-1">
          <span className={miniLabel}>Telefone</span>
          <input
            className={inputBase}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="sm:col-span-1">
          <span className={miniLabel}>E-mail</span>
          <input
            className={inputBase}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            type="email"
          />
        </div>

        <div className="sm:col-span-3 flex gap-2">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {editingId ? "Salvar alterações" : "Adicionar paciente"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:underline">
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <div className="mt-4 space-y-1">
        {patients.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum paciente cadastrado ainda.
          </p>
        )}

        {patients.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
          >
            <div>
              <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {[p.phone, p.email].filter(Boolean).join(" · ")}
              </div>
              {p.createdByName && (
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  Criado por: {p.createdByName}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => startEdit(p)}
                className="rounded-lg px-2 py-1 text-xs text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-500/10"
              >
                Editar
              </button>
              <button type="button" onClick={() => handleDelete(p)} className={dangerBtn}>
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!patientToRemove}
        title="Remover paciente"
        description={
          patientToRemove ? `Remover o paciente "${patientToRemove.name}"?` : ""
        }
        confirmLabel="Remover"
        onConfirm={confirmDeletePatient}
        onCancel={() => setPatientToRemove(null)}
      />
    </Collapsible>
  );
}

// -----------------------------------------------------------------------
//   MEMBROS DA EQUIPE (secretária / assistente / convidado)
// -----------------------------------------------------------------------
function MembersSection({
  ownerId,
  card,
  sectionTitle,
  badgeNew,
  inputBase,
  primaryBtn,
  dangerBtn,
  miniLabel,
}) {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("secretary");
  const [canEditNew, setCanEditNew] = useState(false);
  const [canCreateNew, setCanCreateNew] = useState(false);
  const [canViewFinanceNew, setCanViewFinanceNew] = useState(false);
  const [canManagePatientsNew, setCanManagePatientsNew] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  async function load() {
    if (!ownerId) return;
    try {
      setLoading(true);
      const list = await fetchMembers(ownerId);
      setMembers(list || []);
    } catch (err) {
      console.error("Erro ao carregar membros:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  async function handleInvite(e) {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setInviting(true);
      await inviteMember({
        email: email.trim(),
        role,
        canEdit: canEditNew,
        canCreate: canCreateNew,
        canViewFinance: canViewFinanceNew,
        canManagePatients: canManagePatientsNew,
      });
      toast.show("Convite enviado com sucesso.", { type: "success" });
      setEmail("");
      await load();
    } catch (err) {
      console.error("Erro ao convidar membro:", err);
      toast.show(err?.message || "Erro ao convidar usuário.", { type: "error" });
    } finally {
      setInviting(false);
    }
  }

  async function togglePerm(member, field) {
    const next = {
      canEdit: field === "canEdit" ? !member.can_edit : !!member.can_edit,
      canCreate: field === "canCreate" ? !member.can_create : member.can_create !== false,
      canViewFinance:
        field === "canViewFinance" ? !member.can_view_finance : !!member.can_view_finance,
      canManagePatients:
        field === "canManagePatients"
          ? !member.can_manage_patients
          : member.can_manage_patients !== false,
    };

    try {
      await updateMemberPermissions(member.id, next);
      await load();
    } catch (err) {
      console.error("Erro ao atualizar permissões:", err);
      toast.show("Erro ao atualizar permissões.", { type: "error" });
    }
  }

  function handleRemove(member) {
    setMemberToRemove(member);
  }

  async function confirmRemove() {
    if (!memberToRemove) return;
    try {
      setRemoving(true);
      await removeMember(memberToRemove.id);
      toast.show("Acesso removido.", { type: "info" });
      setMemberToRemove(null);
      await load();
    } catch (err) {
      console.error("Erro ao remover membro:", err);
      toast.show("Erro ao remover membro.", { type: "error" });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Collapsible
      card={card}
      sectionTitle={sectionTitle}
      title="Usuários e permissões"
      badge={<span className={badgeNew}>Novo</span>}
      defaultOpen
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Convide secretária(s), assistente(s) ou convidado(s) para acessar a
        agenda com permissões controladas.
      </p>

      <form onSubmit={handleInvite} className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={miniLabel}>E-mail do convidado</span>
          <input
            className={inputBase}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@exemplo.com"
            required
          />
        </div>

        <div>
          <span className={miniLabel}>Papel</span>
          <select className={inputBase} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="secretary">Secretária</option>
            <option value="assistant">Assistente</option>
            <option value="guest">Convidado</option>
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={canCreateNew}
              onChange={(e) => setCanCreateNew(e.target.checked)}
            />
            Pode criar compromissos
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={canEditNew}
              onChange={(e) => setCanEditNew(e.target.checked)}
            />
            Pode editar
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={canViewFinanceNew}
              onChange={(e) => setCanViewFinanceNew(e.target.checked)}
            />
            Vê financeiro
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={canManagePatientsNew}
              onChange={(e) => setCanManagePatientsNew(e.target.checked)}
            />
            Pode gerenciar pacientes
          </label>
        </div>

        <div className="sm:col-span-2">
          <button type="submit" disabled={inviting} className={primaryBtn}>
            {inviting ? "Convidando..." : "Convidar"}
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-1">
        {loading && <p className="text-xs text-slate-500">Carregando membros...</p>}
        {!loading && members.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum membro convidado ainda.
          </p>
        )}

        {members.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-slate-800 dark:text-slate-100">
                  {m.invited_email || m.member_user_id}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {m.role === "secretary"
                    ? "Secretária"
                    : m.role === "assistant"
                    ? "Assistente"
                    : "Convidado"}
                </div>
              </div>
              <button type="button" onClick={() => handleRemove(m)} className={dangerBtn}>
                Remover
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={m.can_create !== false}
                  onChange={() => togglePerm(m, "canCreate")}
                />
                Pode criar compromissos
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={!!m.can_edit}
                  onChange={() => togglePerm(m, "canEdit")}
                />
                Pode editar
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={!!m.can_view_finance}
                  onChange={() => togglePerm(m, "canViewFinance")}
                />
                Vê financeiro
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={m.can_manage_patients !== false}
                  onChange={() => togglePerm(m, "canManagePatients")}
                />
                Pode gerenciar pacientes
              </label>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!memberToRemove}
        title="Remover acesso"
        description={
          memberToRemove
            ? `Remover o acesso de "${
                memberToRemove.invited_email || memberToRemove.member_user_id
              }"?`
            : ""
        }
        confirmLabel={removing ? "Removendo..." : "Remover"}
        onConfirm={confirmRemove}
        onCancel={() => setMemberToRemove(null)}
      />
    </Collapsible>
  );
}

// -----------------------------------------------------------------------
//   NOTIFICAÇÕES POR E-MAIL
// -----------------------------------------------------------------------
function NotificationsSection({ card, sectionTitle, miniLabel }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Erro ao carregar preferência de notificações:", error);
      } else {
        const stored = data?.user?.user_metadata?.email_notifications;
        setEnabled(stored !== false); // padrão: ativado
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next); // otimista
    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { email_notifications: next },
      });
      if (error) throw error;
      toast.show(
        next
          ? "Notificações por e-mail ativadas."
          : "Notificações por e-mail desativadas.",
        { type: "success" }
      );
    } catch (err) {
      console.error("Erro ao salvar preferência de notificações:", err);
      setEnabled(!next); // reverte
      toast.show("Erro ao salvar preferência. Tente novamente.", {
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Collapsible card={card} sectionTitle={sectionTitle} title="Notificações" defaultOpen>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Receba um lembrete por e-mail dos seus compromissos.
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className={miniLabel}>E-mail:</span>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {loading ? "Carregando..." : enabled ? "Ativado" : "Desativado"}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={loading || saving}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${
            enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
    </Collapsible>
  );
}
