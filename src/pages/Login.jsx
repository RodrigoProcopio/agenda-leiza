import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function signIn(e) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) setMsg(error.message);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-sky-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Entrar</h1>

        <form className="mt-4 space-y-3" onSubmit={signIn}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
            placeholder="senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {msg && <div className="text-sm text-slate-600 dark:text-slate-300">{msg}</div>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
