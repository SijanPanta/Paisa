function initApp() {
  loadState();
  render();
  initializeBiometricLock();
  bindNavigationEvents();
  bindTransactionEvents();
  bindSearchEvents();
  bindWalletEvents();
  bindSettingsEvents();
  bindCurrencyEvents();
  bindBudgetEvents();
  bindDataEvents();
  bindDialogDismissalEvents();
}

function bindNavigationEvents() {
  // Bottom Nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.target));
  });

  // Theme toggle
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
}

function bindTransactionEvents() {
  // FAB
  document.getElementById('fabAddBtn').addEventListener('click', () => openAddModal('expense'));

  // Quick Type Switcher in Modal
  document.querySelectorAll('.type-tab').forEach(el => {
    el.addEventListener('click', () => {
      nativeVibrate(15);
      state.selectedType = el.dataset.type;
      updateModalTypeUI();
    });
  });

  // Modal buttons
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('saveTxBtn').addEventListener('click', saveTransaction);
  document.getElementById('deleteTxBtn').addEventListener('click', deleteTransaction);

  // Delete Single Transaction Dialog (Material 3)
  document.getElementById('cancelDeleteTxBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeDeleteTxDialog();
  });
  document.getElementById('confirmDeleteTxBtn').addEventListener('click', () => {
    nativeVibrate(35);
    executeDeleteTransaction();
  });

  // Transaction Detail sheet (View Only)
  document.getElementById('closeDetailBtn').addEventListener('click', closeDetailModal);
  document.getElementById('editTxFromDetailBtn').addEventListener('click', () => {
    nativeVibrate(20);
    if (!state.viewingTxId) return;
    const id = state.viewingTxId;
    closeDetailModal();
    openEditModal(id);
  });
  document.getElementById('deleteTxFromDetailBtn').addEventListener('click', () => {
    nativeVibrate(20);
    if (!state.viewingTxId) return;
    state.editingTxId = state.viewingTxId;
    closeDetailModal();
    openDeleteTxDialog();
  });

  // Dismiss txDetailModal when tapping backdrop
  document.getElementById('txDetailModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('txDetailModal')) {
      closeDetailModal();
    }
  });
}

function bindSearchEvents() {
  // Search toggle
  document.getElementById('searchToggleBtn').addEventListener('click', () => {
    nativeVibrate(15);
    const wrap = document.getElementById('searchBarWrap');
    wrap.classList.toggle('show');
    if (wrap.classList.contains('show')) {
      document.getElementById('searchInput').focus();
    } else {
      state.searchQuery = '';
      document.getElementById('searchInput').value = '';
      renderTransactions();
    }
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTransactions();
  });
}

function bindWalletEvents() {
  // Quick Transfer & Add Bank buttons in Wallets tab
  document.getElementById('quickTransferBtn').addEventListener('click', () => openAddModal('transfer'));
  document.getElementById('addBankBtn').addEventListener('click', openAddBankDialog);
  document.getElementById('cancelAddBankBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeAddBankDialog();
  });
  document.getElementById('saveBankBtn').addEventListener('click', saveNewBank);

  document.querySelectorAll('#bankPresets .preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      nativeVibrate(15);
      document.querySelectorAll('#bankPresets .preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('bankNameInput').value = chip.dataset.bank;
      document.getElementById('bankNameInput').focus();
    });
  });

  document.getElementById('bankNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNewBank();
    }
  });

  // Delete Bank Account Dialog (Material 3)
  document.getElementById('cancelDeleteBankBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeDeleteBankDialog();
  });
  document.getElementById('confirmDeleteBankBtn').addEventListener('click', confirmDeleteBank);
}

function bindSettingsEvents() {
  // Reset Data Dialog (Material 3)
  document.getElementById('resetDataBtn').addEventListener('click', openResetDialog);
  document.getElementById('cancelResetBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeResetDialog();
  });
  document.getElementById('confirmResetBtn').addEventListener('click', () => {
    nativeVibrate(35);
    state.transactions = [];
    saveState();
    closeResetDialog();
    render();
    nativeToast('All data cleared');
  });

  // Settings other actions
  document.getElementById('setHapticItem').addEventListener('click', () => {
    state.settings.haptics = !state.settings.haptics;
    nativeVibrate(25);
    saveState();
    renderSettings();
  });

  document.getElementById('setBiometricItem').addEventListener('click', () => {
    nativeVibrate(20);
    if (!isBiometricSupported()) {
      nativeToast('Biometrics not available on this device');
      return;
    }
    triggerBiometricAuth('toggle');
  });
}

function bindCurrencyEvents() {
  // Currency Dialog (Material 3)
  document.getElementById('setCurrencyItem').addEventListener('click', openCurrencyDialog);
  document.getElementById('cancelCurrencyBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeCurrencyDialog();
  });
  document.querySelectorAll('#currencyPresets .preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      nativeVibrate(15);
      document.querySelectorAll('#currencyPresets .preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      tempSelectedCurrency = chip.dataset.curr;
      document.getElementById('customCurrencyInput').value = tempSelectedCurrency;
    });
  });
  document.getElementById('customCurrencyInput').addEventListener('input', (e) => {
    tempSelectedCurrency = e.target.value.trim();
    document.querySelectorAll('#currencyPresets .preset-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.curr === tempSelectedCurrency);
    });
  });
  document.getElementById('saveCurrencyBtn').addEventListener('click', () => {
    nativeVibrate(25);
    const val = document.getElementById('customCurrencyInput').value.trim() || tempSelectedCurrency || 'Rs.';
    state.settings.currency = val;
    saveState();
    closeCurrencyDialog();
    render();
    nativeToast(`Currency set to ${val}`);
  });
}

function bindBudgetEvents() {
  // Monthly Budget Dialog (Material 3)
  document.getElementById('setBudgetItem').addEventListener('click', openBudgetDialog);
  document.getElementById('cancelBudgetBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeBudgetDialog();
  });
  document.querySelectorAll('#budgetPresets .preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      nativeVibrate(15);
      document.querySelectorAll('#budgetPresets .preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('budgetAmountInput').value = chip.dataset.budget;
    });
  });
  document.getElementById('saveBudgetBtn').addEventListener('click', () => {
    nativeVibrate(25);
    const amt = parseFloat(document.getElementById('budgetAmountInput').value);
    if (!isNaN(amt) && amt >= 0) {
      state.settings.budget = amt;
      saveState();
      closeBudgetDialog();
      render();
      nativeToast(`Budget set to ${formatCurrency(amt)}`);
    } else {
      nativeToast('Please enter a valid amount');
    }
  });
}

function bindDataEvents() {
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
  document.getElementById('backupJsonBtn').addEventListener('click', backupJson);
  document.getElementById('restoreJsonBtn').addEventListener('click', restoreJson);
  document.getElementById('restoreFileInput').addEventListener('change', handleFileRestore);
}

function bindDialogDismissalEvents() {
  // Dismiss dialogs when tapping backdrop
  document.querySelectorAll('.md-dialog-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        nativeVibrate(15);
        backdrop.classList.remove('show');
      }
    });
  });

  // Dismiss txModal when tapping backdrop
  document.getElementById('txModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('txModal')) {
      closeModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
