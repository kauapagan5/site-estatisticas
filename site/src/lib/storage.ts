// Favoritos e tema, guardados só neste navegador.
import { useCallback, useEffect, useState } from "react";

export interface Favorite { key: string; name: string; sub: string; href: string }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* navegador sem armazenamento */ }
}

const listeners = new Set<() => void>();

export function useFavorites() {
  const [favs, setFavs] = useState<Favorite[]>(() => read("favoritos", []));
  useEffect(() => {
    const update = () => setFavs(read("favoritos", []));
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  const toggle = useCallback((fav: Favorite) => {
    const cur = read<Favorite[]>("favoritos", []);
    const next = cur.some((f) => f.key === fav.key) ? cur.filter((f) => f.key !== fav.key) : [fav, ...cur];
    write("favoritos", next);
    listeners.forEach((l) => l());
  }, []);
  return { favs, toggle, has: (key: string) => favs.some((f) => f.key === key) };
}

export function useTheme() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme || "dark");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("tema", next); } catch { /* sem armazenamento */ }
    setTheme(next);
  };
  return { theme, toggle };
}
