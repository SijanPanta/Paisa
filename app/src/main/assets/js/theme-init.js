// Applies the saved theme to <html> immediately, before first paint,
// to prevent a flash of white when the user has dark mode enabled.
// Only reads localStorage — the native backup fallback is intentionally
// skipped here because loadState() will apply the theme shortly after.
(function () {
  try {
    var raw = localStorage.getItem('paisa_state');
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && saved.settings && saved.settings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  } catch (e) { /* ignore parse errors — defaults to light */ }
})();
