import { useEffect, useState } from "react";

const KEY = "theme"; // "light" | "dark"

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
    // padrão: claro
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement; // <html>

    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark"); // ✅ ESSENCIAL

    localStorage.setItem(KEY, theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return { theme, toggle, setTheme };
}
