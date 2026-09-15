/** Theme is 'auto' (follow the OS), 'dark' or 'light'. */
export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  updateStatusBarColor();
}

function updateStatusBarColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = bg || '#0d1016';
}

export function watchSystemTheme(getMode) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', () => { if (getMode() === 'auto') updateStatusBarColor(); });
}
