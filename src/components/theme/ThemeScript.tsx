import { THEME_STORAGE_KEY } from '@/lib/theme-storage';

/**
 * Script inline en <head> para evitar parpadeo de tema (FOUC).
 * Se ejecuta antes de que React hidrate la página.
 * Por defecto aplica modo claro; solo activa oscuro si está guardado explícitamente.
 */
export function ThemeScript() {
  const script = `
(function() {
  try {
    var t = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      if (!t) {
        localStorage.setItem('${THEME_STORAGE_KEY}', 'light');
      }
    }
  } catch (e) {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
