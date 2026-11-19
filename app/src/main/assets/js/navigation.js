function filterByWallet(walletName) {
  nativeVibrate(20);
  switchTab('viewHome');
  state.activeFilter = walletName.toLowerCase();
  renderFilterChips();
  renderTransactions();
  setTimeout(() => {
    const activeChip = document.querySelector('#typeFilterRow .pill-chip.active');
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, 50);
}

// ── THEME TOGGLE ───────────────────────────────────────────────
function toggleTheme() {
  nativeVibrate(20);
  const isDark = document.documentElement.dataset.theme === 'dark' || document.body.dataset.theme === 'dark';
  state.settings.theme = isDark ? 'light' : 'dark';
  updateTheme();
  saveState();
}

function updateTheme() {
  const theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;

  const themeIcon = document.getElementById('themeToggleIcon');
  if (themeIcon) {
    themeIcon.innerHTML = mi(theme === 'dark' ? 'light_mode' : 'dark_mode');
  }

  if (window.AndroidBridge && window.AndroidBridge.setStatusBarColor) {
    if (theme === 'dark') {
      window.AndroidBridge.setStatusBarColor('#121316', false);
    } else {
      window.AndroidBridge.setStatusBarColor('#F8F9FA', true);
    }
  }
}

// ── TAB SWITCHING ──────────────────────────────────────────────
function switchTab(viewId) {
  nativeVibrate(15);
  document.querySelectorAll('.view-page').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  const targetNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
  if (targetNav) targetNav.classList.add('active');

  const titleMap = {
    'viewHome': 'Paisa',
    'viewAnalytics': 'Insights',
    'viewWallets': 'Wallets',
    'viewSettings': 'Settings'
  };
  document.getElementById('pageTitle').textContent = titleMap[viewId] || 'Paisa';

  // Hide or show search icon
  document.getElementById('searchToggleBtn').style.display = (viewId === 'viewHome') ? 'flex' : 'none';
  if (viewId !== 'viewHome') {
    document.getElementById('searchBarWrap').classList.remove('show');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── ANDROID HARDWARE BACK BUTTON HOOK ──────────────────────────
window.handleAndroidBack = function() {
  // If app is locked, let Android close/minimize without unlocking
  if (state.isLocked) {
    return false;
  }
  // Check dialogs first
  const openDialog = document.querySelector('.md-dialog-backdrop.show');
  if (openDialog) {
    openDialog.classList.remove('show');
    return true;
  }
  const modal = document.getElementById('txModal');
  if (modal && modal.classList.contains('show')) {
    closeModal();
    return true;
  }
  const search = document.getElementById('searchBarWrap');
  if (search && search.classList.contains('show')) {
    search.classList.remove('show');
    return true;
  }
  const detail = document.getElementById('txDetailModal');
  if (detail && detail.classList.contains('show')) {
    closeDetailModal();
    return true;
  }
  return false; // let Android close app
};
