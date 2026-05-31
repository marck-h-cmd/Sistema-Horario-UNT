export const THEME_STORAGE_KEY = 'unt-theme-preference';

export type ThemePreference = 'light' | 'dark';

export function getStoredTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveTheme(stored: ThemePreference | null): ThemePreference {
  return stored ?? 'light';
}

export function applyThemeToDocument(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}
