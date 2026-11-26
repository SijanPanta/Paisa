function exportCsv() {
  nativeVibrate(20);
  if (state.transactions.length === 0) {
    nativeToast('No transactions to export');
    return;
  }

  let csv = 'ID,Date,Time,Type,Amount,Currency,Category,Account,ToAccount,Note\n';
  state.transactions.forEach(t => {
    csv += `"${t.id}","${t.date}","${t.time || ''}","${t.type}",${t.amount},"${state.settings.currency}","${t.categoryName || ''}","${t.account || ''}","${t.toAccount || ''}","${(t.note || '').replace(/"/g, '""')}"\n`;
  });

  nativeSaveFile(`Paisa-Transactions-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv', csv);
}

function backupJson() {
  nativeVibrate(20);
  const json = JSON.stringify(state, null, 2);
  nativeSaveFile(`Paisa-Backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json', json);
}

function restoreJson() {
  document.getElementById('restoreFileInput').click();
}

function handleFileRestore(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (Array.isArray(parsed.transactions)) {
        state = {
          transactions: parsed.transactions || [],
          bankAccounts: parsed.bankAccounts || [],
          loans: parsed.loans || [],
          splits: parsed.splits || [],
          friends: parsed.friends || [],
          reminders: Array.isArray(parsed.reminders) ? parsed.reminders.slice() : [],
          settings: Object.assign({
            currency: 'Rs.',
            budget: 35000,
            haptics: true,
            biometricLock: true,
            dailySpendReminder: false,
            rentReminderSeeded: false,
            theme: 'light'
          }, parsed.settings || {}),
          activeFilter: 'all',
          searchQuery: '',
          editingTxId: null,
          viewingTxId: null,
          viewingSplitId: null,
          selectedType: 'expense',
          selectedCat: 'food'
        };
        clearUndoHistory();
        seedDefaultRentReminder();
        saveState();
        if (window.AndroidBridge && window.AndroidBridge.setDailySpendReminderEnabled) {
          window.AndroidBridge.setDailySpendReminderEnabled(state.settings.dailySpendReminder);
        }
        nativeSyncReminders();
        document.querySelectorAll('#typeFilterRow .pill-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.filter === 'all');
        });
        render();
        nativeToast('Successfully restored backup!');
      } else {
        nativeToast('Invalid backup file');
      }
    } catch (err) {
      nativeToast('Failed to read backup file');
    }
  };
  reader.readAsText(file);
}
