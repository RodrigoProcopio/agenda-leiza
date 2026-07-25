import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // 👉 Passa o usuário autenticado pro App.jsx
      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      console.error("Erro ao fazer login:", err);
      setErrorMsg("E-mail ou senha inválidos ou erro na autenticação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setForgotMsg("");

    if (!email) {
      setForgotMsg("Informe seu e-mail no campo acima primeiro.");
      return;
    }

    try {
      setForgotLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setForgotMsg(
        "Se esse e-mail estiver cadastrado, você vai receber um link para redefinir a senha."
      );
    } catch (err) {
      console.error("Erro ao solicitar redefinição de senha:", err);
      setForgotMsg(
        "Se esse e-mail estiver cadastrado, você vai receber um link para redefinir a senha."
      );
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-sky-50 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
        <h1 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
          {mode === "login" ? "Entrar" : "Redefinir senha"}
        </h1>

        {mode === "login" && errorMsg && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              E-mail
            </label>
            <input
              type="email"
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode === "login" ? (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Senha
                </label>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setForgotMsg("");
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={handleForgotSubmit}>
              {forgotMsg && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                  {forgotMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forgotLoading ? "Enviando..." : "Enviar link de redefinição"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setForgotMsg("");
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Voltar para o login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
