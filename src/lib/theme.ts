"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_KEY } from "./theme-script";

// Light or dark app theme, remembered per browser. <html class="dark"> switches the ob-* colours
// (globals.css). The inline script in the root layout applies it before the first paint.

export type ThemeChoice = "light" | "dark" | "system";

function isDark(choice: ThemeChoice): boolean {
  return choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("light");

  useEffect(() => setChoice(read()), []);

  // "System" follows the device when it switches between light and dark
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => document.documentElement.classList.toggle("dark", media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [choice]);

  const set = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable: the choice lasts until reload
    }
    document.documentElement.classList.toggle("dark", isDark(next));
    setChoice(next);
  }, []);

  return { choice, setTheme: set };
}
