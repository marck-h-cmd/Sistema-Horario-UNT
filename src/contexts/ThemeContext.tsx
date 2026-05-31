'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyThemeToDocument,
  getStoredTheme,
  setStoredTheme,
  type ThemePreference,
} from '@/lib/theme-storage';

interface ThemeContextValue {
  theme: ThemePreference;
  isDark: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Siempre iniciar en 'light' para coincidir con el render del servidor
  // El useEffect sincronizará con localStorage en el cliente
  const [theme, setThemeState] = useState<ThemePreference>('light');

  useEffect(() => {
    // Leer preferencia guardada; si no existe, guardar 'light' como predeterminado
    const stored = getStoredTheme();
    const resolved: ThemePreference = stored ?? 'light';
    if (!stored) {
      setStoredTheme('light');
    }
    setThemeState(resolved);
    applyThemeToDocument(resolved);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    setStoredTheme(next);
    applyThemeToDocument(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemePreference = prev === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return ctx;
}
