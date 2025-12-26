import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { fetchEvents, restoreBackupEvents } from "../lib/eventsApi.js";

export default function Settings({
  theme,
  onToggleTheme,
  onExportFinance,
  onExportAgenda,
}) {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

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

  const pillToggle =
    "inline-flex items-center rounded-full border border-slate-300 bg-slate-100 p-0.5 text-xs shadow-inner dark:border-slate-700 dark:bg-slate-800";

  const pillThumb =
    "inline-flex items-center justify-center rounded-full bg-white px-2 py-1 text-[11px] font-medium shadow-sm dark:bg-slate-900";

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

      const events = (await fetchEvents()) || [];

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
      alert("Erro ao gerar backup. Tente novamente.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestoreBackupChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // permite escolher o mesmo arquivo novamente se der erro
    event.target.value = "";

    const confirma = window.confirm(
      "Restaurar o backup vai substituir TODOS os eventos atuais da agenda pelos eventos do arquivo selecionado.\n\nDeseja continuar?"
    );

    if (!confirma) {
      return;
    }

    try {
      setRestoreLoading(true);

      const text = await file.text();
      const json = JSON.parse(text);

      if (!json || !Array.isArray(json.events)) {
        alert(
          "Arquivo de backup inválido. Certifique-se de usar um arquivo gerado pelo próprio sistema."
        );
        return;
      }

      const eventsFromBackup = json.events;

      await restoreBackupEvents(eventsFromBackup);

      // Recarrega a aplicação para refletir os novos dados
      window.location.reload();
    } catch (err) {
      console.error("Erro ao restaurar backup:", err);
      alert(
        "Ocorreu um erro ao restaurar o backup. Verifique se o arquivo é válido e tente novamente."
      );
    } finally {
      setRestoreLoading(false);
    }
  }

  const isDark = theme === "dark";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-2">
      <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-50">
      </h2>

      <div className="space-y-4">
        {/* Aparência e tema */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Aparência e tema</span>
            <span className={badgeNew}>Novo</span>
          </div>

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

            <button type="button" onClick={onToggleTheme} className={pillToggle}>
              <span
                className={`${pillThumb} ${
                  isDark
                    ? "translate-x-0 bg-slate-900 text-slate-100"
                    : "bg-white text-slate-800"
                }`}
              >
                {isDark ? "Escuro" : "Claro"}
              </span>
            </button>
          </div>
        </div>

        {/* Financeiro e exportações */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Financeiro e exportações</span>
            <span className={badgeNew}>Novo</span>
          </div>

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
        </div>

        {/* Integração com Google Agenda (em breve) */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Integração com Google Agenda</span>
            <span className={badgeSoon}>Em breve</span>
          </div>

          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
            No futuro, será possível conectar a agenda do consultório com o
            Google Agenda para sincronizar compromissos importantes.
          </p>

          <ul className="mb-3 list-inside list-disc text-xs text-slate-500 dark:text-slate-400">
            <li>visualizar atendimentos no Google Agenda</li>
            <li>receber lembretes em outros dispositivos</li>
            <li>opção de sincronização manual ou automática</li>
          </ul>

          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-400 shadow-sm dark:border-slate-700 dark:text-slate-500"
          >
            🔗 Conectar conta Google (em breve)
          </button>
        </div>

        {/* Usuários e permissões (em breve) */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Usuários e permissões</span>
            <span className={badgeSoon}>Em breve</span>
          </div>

          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
            No futuro, será possível adicionar outras pessoas com acesso limitado
            à agenda (por exemplo, secretária ou assistente).
          </p>

          <ul className="mb-3 list-inside list-disc text-xs text-slate-500 dark:text-slate-400">
            <li>controle de permissão de leitura e edição</li>
            <li>registro de quem criou ou alterou um agendamento</li>
            <li>limitação de acesso apenas ao necessário</li>
          </ul>

          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-400 shadow-sm dark:border-slate-700 dark:text-slate-500"
          >
            👥 Gerenciar usuários
          </button>
        </div>

        {/* Backup e segurança */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Backup e segurança</span>
            <span className={badgeNew}>Novo</span>
          </div>

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
        </div>
      </div>
    </div>
  );
}
