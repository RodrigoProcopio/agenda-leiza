import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 6) {
      setErrorMsg("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => onDone?.(), 1500);
    } catch (err) {
      console.error("Erro ao redefinir senha:", err);
      setErrorMsg("Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-sky-50 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
          Definir nova senha
        </h1>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Escolha uma nova senha para sua conta.
        </p>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            Senha atualizada com sucesso! Entrando...
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-200">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Nova senha
              </label>
              <input
                type="password"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Confirmar nova senha
              </label>
              <input
                type="password"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
