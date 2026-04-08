"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@heroui/react";

type Theme = "light" | "dark";

/**
 * Selects the initial theme for the application.
 *
 * @returns The chosen theme: `light` when executed outside the browser, the stored `"light"` or `"dark"` value from `localStorage` when present, otherwise `dark` if the system prefers a dark color scheme and `light` otherwise.
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Produce a no-op unsubscribe function.
 *
 * @returns A function that performs no action and returns `undefined`.
 */
function subscribeNoop() {
  return () => undefined;
}

/**
 * Renders a theme toggle button that switches between "light" and "dark".
 *
 * After hydration completes, persists the selected theme to localStorage and toggles the "dark" class on document.documentElement.
 * While hydration has not completed, renders a small placeholder to avoid layout shift.
 *
 * @returns The ThemeSwitcher component's JSX element (a button that toggles the current theme).
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [hydrated, theme]);

  if (!hydrated) {
    return <div className="w-10 h-10" />;
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }

  return (
    <Button isIconOnly variant="light" onPress={toggleTheme} aria-label="Toggle dark mode" className="text-default-600">
      {theme === "light" ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      )}
    </Button>
  );
}
