import React, { useEffect, useMemo, useState } from "react";
import {
  fetchChecklistCustom,
  addChecklistCustom,
  deleteChecklistCustom,
} from "../lib/tripApi.js";

const card =
  "rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40";

export const customKey = (id) => "cc:" + id;

function CheckRow({ done, text, note, qty, saving, onToggle, onDelete }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        aria-pressed={done}
        aria-label={done ? "Desmarcar" : "Marcar como resolvido"}
        className={
          "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold transition " +
          (done
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-300 bg-white text-transparent hover:border-emerald-500 dark:border-slate-600 dark:bg-slate-900") +
          (saving ? " opacity-50" : "")
        }
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={
            "text-sm font-medium text-slate-900 dark:text-slate-50 " +
            (done ? "text-slate-400 line-through dark:text-slate-500" : "")
          }
        >
          {qty && (
            <span className="mr-1.5 inline-block rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 no-underline dark:bg-sky-500/15 dark:text-sky-200">
              {qty}
            </span>
          )}
          {text}
        </div>
        {note && (
          <div
            className={
              "mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400 " +
              (done ? "opacity-60" : "")
            }
          >
            {note}
          </div>
        )}
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remover item"
          title="Remover item"
          className="rounded-md px-1.5 py-0.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
        >
          ✕
        </button>
      )}
    </li>
  );
}

function AddItem({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const ok = await onAdd(t);
    setBusy(false);
    if (ok) {
      setText("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-xs font-medium text-sky-700 hover:underline dark:text-sky-300"
      >
        + Adicionar item
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <input
        autoFocus
        value={text}
        maxLength={300}
        onChange={(e) => setText(e.target.value)}
        placeholder="Novo item"
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Adicionar
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setText("");
        }}
        className="rounded-lg px-2 py-1.5 text-sm text-slate-500"
      >
        Cancelar
      </button>
    </form>
  );
}

export default function TripChecklist({
  trip,
  list,
  itemPrefix = "c:",
  status,
  saving,
  onToggle,
  toast,
}) {
  const checklist = list;
  const checklistKey = (id) => itemPrefix + id;
  const categories = checklist?.categories || [];

  const [custom, setCustom] = useState([]);
  const [hideDone, setHideDone] = useState(false);
  const [openCats, setOpenCats] = useState(() => new Set(categories.map((c) => c.id)));
  const [tipsOpen, setTipsOpen] = useState(false);

  useEffect(() => {
    if (!trip?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchChecklistCustom(trip.id);
        if (!cancelled) setCustom(rows);
      } catch (e) {
        console.error("Erro ao carregar itens extras do checklist:", e);
      }
    };
    load();
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [trip?.id]);

  const customByCat = useMemo(() => {
    const m = {};
    for (const r of custom) (m[r.category_id] ||= []).push(r);
    return m;
  }, [custom]);

  const allKeys = useMemo(() => {
    const keys = [];
    for (const c of categories) {
      for (const i of c.items) keys.push(checklistKey(i.id));
      for (const r of customByCat[c.id] || []) keys.push(customKey(r.id));
    }
    return keys;
  }, [categories, customByCat]);

  const doneCount = allKeys.filter((k) => status[k]?.done).length;
  const pct = allKeys.length ? Math.round((doneCount / allKeys.length) * 100) : 0;

  async function handleAdd(catId, text) {
    try {
      const row = await addChecklistCustom(trip.id, catId, text);
      setCustom((c) => [...c, row]);
      return true;
    } catch (e) {
      console.error(e);
      toast?.show?.("Não foi possível adicionar o item.", { type: "error" });
      return false;
    }
  }

  async function handleDelete(row) {
    const prev = custom;
    setCustom((c) => c.filter((r) => r.id !== row.id));
    try {
      await deleteChecklistCustom(row.id);
    } catch (e) {
      console.error(e);
      setCustom(prev);
      toast?.show?.("Não foi possível remover o item.", { type: "error" });
    }
  }

  function toggleCat(id) {
    setOpenCats((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  if (!checklist) {
    return <div className={card + " mt-3 text-sm"}>Lista ainda não disponível.</div>;
  }

  return (
    <div className="mt-3 space-y-3">
      <div className={card}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{checklist.title}</h2>
        {checklist.intro && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{checklist.intro}</p>
        )}
        {checklist.tips?.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/5">
            <button
              type="button"
              onClick={() => setTipsOpen((v) => !v)}
              aria-expanded={tipsOpen}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
            >
              <span>{checklist.tipsTitle || "Dicas"}</span>
              <span className="text-slate-400">{tipsOpen ? "▴" : "▾"}</span>
            </button>
            {tipsOpen && (
              <ul className="list-disc space-y-1 px-3 pb-3 pl-7 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {checklist.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-3 flex items-baseline justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>
            {doneCount} de {allKeys.length} itens resolvidos
          </span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: pct + "%" }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setOpenCats(new Set(categories.map((c) => c.id)))}
              className="text-sky-700 hover:underline dark:text-sky-300"
            >
              Abrir tudo
            </button>
            <button
              type="button"
              onClick={() => setOpenCats(new Set())}
              className="text-sky-700 hover:underline dark:text-sky-300"
            >
              Fechar tudo
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="h-4 w-4 accent-sky-600"
            />
            Ocultar resolvidos
          </label>
        </div>
      </div>

      {categories.map((cat) => {
        const extras = customByCat[cat.id] || [];
        const keys = [
          ...cat.items.map((i) => checklistKey(i.id)),
          ...extras.map((r) => customKey(r.id)),
        ];
        const catDone = keys.filter((k) => status[k]?.done).length;
        const complete = keys.length > 0 && catDone === keys.length;
        const open = openCats.has(cat.id);

        const baseRows = cat.items.filter((i) => !(hideDone && status[checklistKey(i.id)]?.done));
        const extraRows = extras.filter((r) => !(hideDone && status[customKey(r.id)]?.done));

        return (
          <div
            key={cat.id}
            className={
              card +
              (complete
                ? " border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                : "")
            }
          >
            <button
              type="button"
              onClick={() => toggleCat(cat.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{cat.title}</span>
              <span className="flex flex-shrink-0 items-center gap-2 text-xs">
                <span
                  className={
                    "rounded-full px-2 py-0.5 font-semibold " +
                    (complete
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")
                  }
                >
                  {complete ? "✓ " : ""}
                  {catDone}/{keys.length}
                </span>
                <span className="text-slate-400">{open ? "▴" : "▾"}</span>
              </span>
            </button>

            {open && (
              <>
                <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {baseRows.map((i) => {
                    const k = checklistKey(i.id);
                    const done = !!status[k]?.done;
                    return (
                      <CheckRow
                        key={k}
                        done={done}
                        text={i.text}
                        note={i.note}
                        qty={i.qty}
                        saving={!!saving[k]}
                        onToggle={() => onToggle(k, !done)}
                      />
                    );
                  })}
                  {extraRows.map((r) => {
                    const k = customKey(r.id);
                    const done = !!status[k]?.done;
                    return (
                      <CheckRow
                        key={k}
                        done={done}
                        text={r.text}
                        saving={!!saving[k]}
                        onToggle={() => onToggle(k, !done)}
                        onDelete={() => handleDelete(r)}
                      />
                    );
                  })}
                </ul>
                {hideDone && baseRows.length + extraRows.length === 0 && (
                  <div className="py-2 text-xs text-emerald-700 dark:text-emerald-300">
                    Tudo resolvido nesta categoria.
                  </div>
                )}
                <AddItem onAdd={(t) => handleAdd(cat.id, t)} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
