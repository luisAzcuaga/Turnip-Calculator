import { refreshChartTheme } from "./chart.js";

// Debe coincidir con la clave del script en línea de index.html, que resuelve
// el tema antes del primer pintado para que no haya parpadeo al cargar.
const THEME_PREF_KEY = 'turnip_theme_pref';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Ausencia de preferencia guardada = seguir al sistema.
function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_PREF_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_PREF_KEY, theme);
  } catch {
    // Almacenamiento bloqueado (modo privado): el tema igual se aplica, solo
    // no sobrevive a la recarga.
  }
}

function systemTheme() {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

// La barra del navegador no se puede pintar desde CSS; se copia el token.
function syncThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-color-meta').trim();
  if (color) meta.setAttribute('content', color);
}

function applyTheme(theme, button) {
  document.documentElement.dataset.theme = theme;
  syncThemeColorMeta();
  refreshChartTheme();

  if (!button) return;
  const goingDark = theme === 'light';
  button.textContent = goingDark ? '🌙' : '☀️';
  button.setAttribute('aria-label', goingDark ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  button.title = button.getAttribute('aria-label');
}

export function initThemeToggle() {
  const button = document.getElementById('themeToggleBtn');
  const stored = readStoredTheme();

  applyTheme(stored ?? systemTheme(), button);

  // Mientras no haya una elección explícita, el tema sigue al sistema en vivo.
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (!readStoredTheme()) applyTheme(systemTheme(), button);
  });

  button?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    applyTheme(next, button);
  });
}
