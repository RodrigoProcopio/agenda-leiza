import { useEffect, useState } from "react";

const KEY = "theme"; // "light" | "dark"

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;

    // default: segue o sistema, mas você pode fixar "light" se preferir
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem(KEY, theme);
    applyTheme(theme);
  }, [theme]);

  // garante aplicação no primeiro load
  useEffect(() => {
    applyTheme(theme);
  }, []);

  return { theme, setTheme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
