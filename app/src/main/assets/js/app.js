let searchDebounceTimer = null;

function initApp() {
  loadState();
  render();
  initScrollLock();
  initializeBiometricLock();
  bindNavigationEvents();
  bindTransactionEvents();
  bindSearchEvents();
  bindWalletEvents();
  bindLoanEvents();
  bindFriendEvents();
  bindSplitEvents();
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
  document.getElementById('undoBtn').addEventListener('click', requestGlobalUndo);

  document.getElementById('cancelUndoConfirmBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeUndoConfirmDialog();
  });
  document.getElementById('confirmUndoBtn').addEventListener('click', () => {
    nativeVibrate(30);
    confirmUndo();
  });
}

function bindTransactionEvents() {
  // FAB: normal transactions on Timeline, quick loan entry on the balance sheet
  document.getElementById('fabAddBtn').addEventListener('click', () => {
    if (document.getElementById('viewLoans').classList.contains('active')) {
      openLoanModal('pay');
    } else {
      openAddModal('expense');
    }
  });

  // Quick Type Switcher in Modal
  document.querySelectorAll('.type-tab').forEach(el => {
    el.addEventListener('click', () => {
      nativeVibrate(15);
      if (el.dataset.type === 'split') {
        openSplitFromAction();
        return;
      }
      restoreTxFormHome();
      document.getElementById('sheetTitle').textContent = state.editingTxId ? 'Edit Transaction' : 'New Transaction';
      state.selectedType = el.dataset.type;
      updateModalTypeUI();
    });
  });

  document.getElementById('txAccountPickerBtn').addEventListener('click', () => openAccountPicker('txAccountSelect'));
  document.getElementById('txToAccountPickerBtn').addEventListener('click', () => openAccountPicker('txToAccountSelect'));
  document.getElementById('cancelAccountPickerBtn').addEventListener('click', closeAccountPicker);

  // Modal buttons
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('saveTxBtn').addEventListener('click', saveTransaction);
  document.getElementById('deleteTxBtn').addEventListener('click', deleteTransaction);
  document.getElementById('undoTxBtn').addEventListener('click', requestGlobalUndo);
  document.getElementById('undoTxModalBtn').addEventListener('click', requestGlobalUndo);

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
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(renderTransactions, 120);
  });
}

function bindWalletEvents() {
  document.getElementById('closeBankAccountsBtn').addEventListener('click', () => closeBankAccounts());
  document.getElementById('bankTimelineBtn').addEventListener('click', () => filterByWallet('Bank'));
  // Bank management lives inside the Bank Account wallet.
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

function bindLoanEvents() {
  document.getElementById('loanPageToPayBtn').addEventListener('click', () => openLoanModal('pay'));
  document.getElementById('loanPageToReceiveBtn').addEventListener('click', () => openLoanModal('receive'));
  document.getElementById('loanPageLendBtn').addEventListener('click', () => openLoanModal('lend'));
  document.getElementById('openLoansBtn').addEventListener('click', () => switchTab('viewLoans'));

  document.querySelectorAll('#loanDirectionSwitcher .loan-direction-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      nativeVibrate(15);
      if (tab.dataset.direction === 'split') {
        openLoanSplitTab();
        return;
      }
      setLoanDirection(tab.dataset.direction);
    });
  });

  document.getElementById('loanAccountPickerBtn').addEventListener('click', () => openAccountPicker('loanAccountSelect'));
  document.getElementById('closeLoanModalBtn').addEventListener('click', closeLoanModal);
  document.getElementById('saveLoanBtn').addEventListener('click', saveLoan);
  document.getElementById('loanPersonInput').addEventListener('input', () => {
    const friend = findFriendByName(document.getElementById('loanPersonInput').value);
    renderLoanFriendChips(friend ? friend.id : null);
  });
  document.getElementById('deleteLoanBtn').addEventListener('click', () => {
    if (editingLoanId) promptDeleteLoan(editingLoanId);
  });

  document.getElementById('loanAddMoneyBtn').addEventListener('click', () => {
    if (editingLoanId) openLoanAdjustDialog('add', editingLoanId);
  });
  document.getElementById('loanReduceMoneyBtn').addEventListener('click', () => {
    if (editingLoanId) openLoanAdjustDialog('reduce', editingLoanId);
  });

  document.getElementById('closeLoanDetailBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeLoanDetail();
  });
  document.getElementById('loanDetailAddBtn').addEventListener('click', () => {
    if (viewingLoanId) openLoanAdjustDialog('add', viewingLoanId);
  });
  document.getElementById('loanDetailReduceBtn').addEventListener('click', () => {
    if (viewingLoanId) openLoanAdjustDialog('reduce', viewingLoanId);
  });
  document.getElementById('editLoanFromDetailBtn').addEventListener('click', () => {
    if (viewingLoanId) editLoan(viewingLoanId);
  });
  document.getElementById('deleteLoanFromDetailBtn').addEventListener('click', () => {
    if (viewingLoanId) promptDeleteLoan(viewingLoanId);
  });
  document.getElementById('toggleLoanApprovalBtn').addEventListener('click', () => {
    const loan = findLoan(viewingLoanId);
    if (!loan) return;
    if (isLoanApproved(loan)) requestLoanApprovalUndo(viewingLoanId);
    else approveLoan(viewingLoanId);
  });

  document.getElementById('cancelLoanAdjustBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeLoanAdjustDialog();
  });
  document.getElementById('loanAdjustConfirmBtn').addEventListener('click', confirmLoanAdjust);

  document.getElementById('cancelApproveLoanBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeApproveLoanDialog();
  });
  document.getElementById('confirmApproveLoanBtn').addEventListener('click', confirmApproveLoan);

  document.getElementById('cancelDeleteLoanBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeDeleteLoanDialog();
  });
  document.getElementById('confirmDeleteLoanBtn').addEventListener('click', confirmDeleteLoan);
}

function bindFriendEvents() {
  document.getElementById('friendsBtn').addEventListener('click', openFriendsSheet);
  document.getElementById('closeFriendsBtn').addEventListener('click', closeFriendsSheet);
  document.getElementById('addFriendBtn').addEventListener('click', openAddFriendDialog);
  document.getElementById('cancelAddFriendBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeAddFriendDialog();
  });
  document.getElementById('saveFriendBtn').addEventListener('click', saveFriend);
  document.getElementById('friendNameInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveFriend();
    }
  });
  document.getElementById('cancelDeleteFriendBtn').addEventListener('click', () => {
    nativeVibrate(15);
    closeDeleteFriendDialog();
  });
  document.getElementById('confirmDeleteFriendBtn').addEventListener('click', confirmDeleteFriend);
}

function bindSplitEvents() {
  document.getElementById('splitBillBtn').addEventListener('click', openSplitModal);
  document.getElementById('closeSplitModalBtn').addEventListener('click', closeSplitModal);
  document.getElementById('splitEqualBtn').addEventListener('click', fillSplitEvenly);
  document.getElementById('splitAmountInput').addEventListener('input', renderSplitPreview);
  document.getElementById('splitAccountPickerBtn').addEventListener('click', () => openAccountPicker('splitAccountSelect'));
  document.getElementById('saveSplitBtn').addEventListener('click', saveSplit);
  document.getElementById('closeSplitDetailBtn').addEventListener('click', closeSplitDetailModal);
  document.getElementById('deleteSplitFromDetailBtn').addEventListener('click', deleteSplitFromDetail);
  document.getElementById('cancelDeleteSplitBtn').addEventListener('click', closeDeleteSplitDialog);
  document.getElementById('confirmDeleteSplitBtn').addEventListener('click', confirmDeleteSplit);
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
    recordUndo('Clear all data');
    state.transactions = [];
    state.loans = [];
    state.splits = [];
    state.friends = [];
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

  document.getElementById('setDailyReminderItem').addEventListener('click', () => {
    nativeVibrate(20);
    state.settings.dailySpendReminder = !state.settings.dailySpendReminder;
    try {
      if (window.AndroidBridge && window.AndroidBridge.setDailySpendReminderEnabled) {
        window.AndroidBridge.setDailySpendReminderEnabled(state.settings.dailySpendReminder);
      }
    } catch (e) {
      console.error('Daily reminder toggle failed:', e);
    }
    saveState();
    renderSettings();
    nativeToast(state.settings.dailySpendReminder ? 'Daily reminder enabled for 5:30 PM' : 'Daily reminder disabled');
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
        if (backdrop.id === 'accountPickerDialog') closeAccountPicker();
        else if (backdrop.id === 'deleteBankDialog') closeDeleteBankDialog();
        else if (backdrop.id === 'loanAdjustDialog') closeLoanAdjustDialog();
        else if (backdrop.id === 'addFriendDialog') closeAddFriendDialog();
        else if (backdrop.id === 'deleteFriendDialog') closeDeleteFriendDialog();
        else if (backdrop.id === 'deleteSplitDialog') closeDeleteSplitDialog();
        else if (backdrop.id === 'undoConfirmDialog') closeUndoConfirmDialog();
        else backdrop.classList.remove('show');
      }
    });
  });

  // Dismiss txModal when tapping backdrop
  document.getElementById('txModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('txModal')) {
      closeModal();
    }
  });

  // Dismiss loanModal when tapping backdrop
  document.getElementById('loanModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('loanModal')) {
      closeLoanModal();
    }
  });

  // Dismiss loanDetailModal when tapping backdrop
  document.getElementById('loanDetailModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('loanDetailModal')) {
      closeLoanDetail();
    }
  });

  document.getElementById('splitModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('splitModal')) {
      closeSplitModal();
    }
  });

  document.getElementById('splitDetailModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('splitDetailModal')) {
      closeSplitDetailModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
