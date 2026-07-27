import React, { useEffect, useState } from "react";
import { fetchAdminAccounts, createAdminAccount } from "../lib/adminApi.js";
import { useToast } from "../components/Toast.jsx";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

const sectionTitle =
  "text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200";

const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:ring-sky-400";

const outlineBtn =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

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

export default function Admin({ onBack }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchAdminAccounts();
      setAccounts(list || []);
    } catch (err) {
      console.error("Erro ao carregar contas:", err);
      setError(err?.message || "Erro ao carregar contas. Acesso restrito ao administrador da plataforma.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setCreating(true);
      await createAdminAccount({
        email: email.trim(),
        displayName: displayName.trim(),
        title: title.trim(),
      });
      toast.show("Convite enviado e conta pré-cadastrada com sucesso.", { type: "success" });
      setEmail("");
      setDisplayName("");
      setTitle("");
      await load();
    } catch (err) {
      console.error("Erro ao criar conta:", err);
      toast.show(err?.message || "Erro ao criar conta.", { type: "error" });
    } finally {
      setCreating(false);
    }
  }

  const totalMembers = accounts.reduce((acc, a) => acc + (a.membersCount || 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-2">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Painel administrativo
        </h2>
        <button type="button" onClick={onBack} className={outlineBtn}>
          ← Voltar
        </button>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Resumo de uso */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Resumo de uso</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            valores financeiros de nenhuma conta — cada conta é isolada e só
            seus próprios dados são visíveis para o dono.
          </p>
        </div>

        {/* Criar nova conta */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Criar nova conta / enviar convite</span>
          </div>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Cria uma conta independente (novo médico/dono de agenda) e envia um
            convite por e-mail para que a pessoa defina sua senha.
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
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className={primaryBtn}>
                {creating ? "Criando..." : "Criar conta e enviar convite"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de contas */}
        <div className={card}>
          <div className="mb-1 flex items-center">
            <span className={sectionTitle}>Contas cadastradas</span>
          </div>

          {loading && <p className="text-xs text-slate-500">Carregando contas...</p>}
          {!loading && accounts.length === 0 && !error && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nenhuma conta encontrada.
            </p>
          )}

          <div className="mt-2 space-y-2">
            {accounts.map((a) => (
              <div
                key={a.userId}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {[a.title, a.displayName].filter(Boolean).join(" ") || a.email}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {a.email}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                    <div>Criada em: {formatDateTime(a.createdAt)}</div>
                    <div>Último acesso: {formatDateTime(a.lastSignInAt)}</div>
                    <div>{a.membersCount} assistente(s)/secretária(s)</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
