"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

const THEME_COOKIE = "usha-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);

    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    localStorage.setItem(THEME_COOKIE, next ? "dark" : "light");
    document.cookie = `${THEME_COOKIE}=${next ? "dark" : "light"};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className={
        className ??
        "flex items-center justify-center rounded-lg p-2 text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-[var(--usha-white)]"
      }
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
