// ── DIALOG CONTROLLERS (MATERIAL 3) ────────────────────────────
function openResetDialog() {
  nativeVibrate(30);
  document.getElementById('resetConfirmDialog').classList.add('show');
}
function closeResetDialog() {
  document.getElementById('resetConfirmDialog').classList.remove('show');
}

function openDeleteTxDialog() {
  nativeVibrate(25);
  document.getElementById('deleteTxDialog').classList.add('show');
}
function closeDeleteTxDialog() {
  document.getElementById('deleteTxDialog').classList.remove('show');
}

let tempSelectedCurrency = 'Rs.';
function openCurrencyDialog() {
  nativeVibrate(20);
  tempSelectedCurrency = state.settings.currency || 'Rs.';
  document.getElementById('customCurrencyInput').value = tempSelectedCurrency;
  document.querySelectorAll('#currencyPresets .preset-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.curr === tempSelectedCurrency);
  });
  document.getElementById('currencyDialog').classList.add('show');
}
function closeCurrencyDialog() {
  document.getElementById('currencyDialog').classList.remove('show');
}

function openBudgetDialog() {
  nativeVibrate(20);
  const b = state.settings.budget || 35000;
  document.getElementById('budgetAmountInput').value = b;
  document.querySelectorAll('#budgetPresets .preset-chip').forEach(c => {
    c.classList.toggle('active', Number(c.dataset.budget) === Number(b));
  });
  document.getElementById('budgetDialog').classList.add('show');
}
function closeBudgetDialog() {
  document.getElementById('budgetDialog').classList.remove('show');
}

// ── BANK ACCOUNT DIALOGS (MATERIAL 3) ──────────────────────────
let pendingDeleteBankId = null;

function openAddBankDialog() {
  nativeVibrate(20);
  const input = document.getElementById('bankNameInput');
  input.value = '';
  document.querySelectorAll('#bankPresets .preset-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('addBankDialog').classList.add('show');
  setTimeout(() => input.focus(), 80);
}

function closeAddBankDialog() {
  document.getElementById('addBankDialog').classList.remove('show');
}

function saveNewBank() {
  const input = document.getElementById('bankNameInput');
  const name = (input.value || '').trim();
  if (!name) {
    nativeToast('Please enter a bank name');
    return;
  }

  if (!state.bankAccounts) state.bankAccounts = [];

  const existing = getAllWallets().some(w => w.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    nativeToast('A wallet with this name already exists');
    return;
  }

  recordUndo('Add bank');
  state.bankAccounts.push({
    id: name,
    name: name,
    icon: 'account_balance',
    isBank: true,
    createdAt: Date.now()
  });

  saveState();
  closeAddBankDialog();
  render();
  nativeVibrate(35);
  nativeToast(`Added ${name} to Bank Account`);
}

function promptDeleteBank(bankId) {
  nativeVibrate(20);
  pendingDeleteBankId = bankId;
  const bank = (state.bankAccounts || []).find(b => b.id === bankId || b.name === bankId);
  const name = bank ? bank.name : bankId;
  document.getElementById('deleteBankDesc').textContent = `Delete "${name}" and all its transactions permanently? Income, expenses and transfers involving this bank will be deleted. Other wallet balances may change when transfers are removed. This cannot be undone.`;
  document.getElementById('deleteBankDialog').classList.add('show');
}

function closeDeleteBankDialog() {
  pendingDeleteBankId = null;
  document.getElementById('deleteBankDialog').classList.remove('show');
}

function confirmDeleteBank() {
  if (!pendingDeleteBankId) return;
  const bank = (state.bankAccounts || []).find(b => b.id === pendingDeleteBankId || b.name === pendingDeleteBankId);
  recordUndo('Delete bank');
  const aliases = new Set([pendingDeleteBankId, bank && bank.id, bank && bank.name]
    .filter(Boolean).map(name => name.toLowerCase()));
  const matches = account => typeof account === 'string' && aliases.has(account.toLowerCase());
  const deletedIds = new Set();
  state.transactions = state.transactions.filter(tx => {
    if (!matches(tx.account) && !matches(tx.toAccount)) return true;
    deletedIds.add(tx.id);
    return false;
  });
  unlinkDeletedLoanTransactions(deletedIds);
  state.bankAccounts = (state.bankAccounts || []).filter(b => b !== bank);
  if (matches(state.activeFilter)) state.activeFilter = 'all';
  if (deletedIds.has(state.editingTxId)) {
    state.editingTxId = null;
    closeModal();
  }
  if (deletedIds.has(state.viewingTxId)) {
    state.viewingTxId = null;
    closeDetailModal();
  }
  saveState();
  closeDeleteBankDialog();
  render();
  nativeVibrate(30);
  nativeToast('Bank wallet and its transactions deleted');
}

let pendingReminderId = null;
let pendingDeleteReminderId = null;
let tempReminderRepeat = 'monthly';

function openReminderDialog(id = null) {
  nativeVibrate(20);
  pendingReminderId = id || null;
  const reminder = id ? (state.reminders || []).find(r => r.id === id) : null;
  document.getElementById('reminderDialogTitle').textContent = reminder ? 'Edit Reminder' : 'Add Reminder';
  document.getElementById('reminderTitleInput').value = reminder ? reminder.title || '' : '';
  document.getElementById('reminderAmountInput').value = reminder && reminder.amount ? reminder.amount : '';
  document.getElementById('reminderNoteInput').value = reminder ? reminder.note || '' : '';
  document.getElementById('reminderDateInput').value = reminder ? reminder.date || localDateString() : localDateString();
  document.getElementById('reminderTimeInput').value = reminder ? reminder.time || '09:00' : '09:00';
  tempReminderRepeat = reminder ? reminder.repeat || 'none' : 'monthly';
  document.querySelectorAll('#reminderRepeatPresets .preset-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.repeat === tempReminderRepeat);
  });
  document.getElementById('reminderDialog').classList.add('show');
  setTimeout(() => document.getElementById('reminderTitleInput').focus(), 80);
}

function closeReminderDialog() {
  pendingReminderId = null;
  document.getElementById('reminderDialog').classList.remove('show');
}

function saveReminder() {
  const title = (document.getElementById('reminderTitleInput').value || '').trim();
  const date = document.getElementById('reminderDateInput').value || '';
  const time = document.getElementById('reminderTimeInput').value || '';
  const note = (document.getElementById('reminderNoteInput').value || '').trim();
  const rawAmount = (document.getElementById('reminderAmountInput').value || '').trim();
  if (!title) {
    nativeToast('Please enter a reminder title');
    return;
  }
  if (!date || !/^\d{2}:\d{2}$/.test(time)) {
    nativeToast('Please choose a date and time');
    return;
  }
  if (tempReminderRepeat === 'none' && date < localDateString()) {
    nativeToast('One-time reminders need a today or future date');
    return;
  }
  const amount = rawAmount === '' ? null : Number(rawAmount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    nativeToast('Please enter a valid amount');
    return;
  }

  if (!Array.isArray(state.reminders)) state.reminders = [];
  const existing = pendingReminderId
    ? state.reminders.find(r => r.id === pendingReminderId)
    : null;
  const reminder = {
    id: existing ? existing.id : `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title, amount, note, date, time,
    repeat: tempReminderRepeat || 'monthly',
    enabled: existing ? existing.enabled !== false : true,
    createdAt: existing ? existing.createdAt || Date.now() : Date.now()
  };
  if (existing) {
    state.reminders[state.reminders.indexOf(existing)] = reminder;
  } else {
    state.reminders.push(reminder);
  }
  saveState();
  nativeSyncReminders();
  closeReminderDialog();
  renderSettings();
  nativeVibrate(35);
  nativeToast(existing ? 'Reminder updated' : 'Reminder added');
}

function promptDeleteReminder(id) {
  nativeVibrate(20);
  pendingDeleteReminderId = id;
  const reminder = (state.reminders || []).find(r => r.id === id);
  document.getElementById('deleteReminderDesc').textContent =
    `Delete "${reminder ? reminder.title : 'this reminder'}" and stop its notifications?`;
  document.getElementById('deleteReminderDialog').classList.add('show');
}

function closeDeleteReminderDialog() {
  pendingDeleteReminderId = null;
  document.getElementById('deleteReminderDialog').classList.remove('show');
}

function confirmDeleteReminder() {
  if (!pendingDeleteReminderId) return;
  state.reminders = (state.reminders || []).filter(r => r.id !== pendingDeleteReminderId);
  saveState();
  nativeSyncReminders();
  closeDeleteReminderDialog();
  renderSettings();
  nativeVibrate(30);
  nativeToast('Reminder deleted');
}

function toggleReminder(id) {
  const reminder = (state.reminders || []).find(r => r.id === id);
  if (!reminder) return;
  reminder.enabled = reminder.enabled === false;
  saveState();
  nativeSyncReminders();
  renderSettings();
  nativeToast(reminder.enabled ? 'Reminder enabled' : 'Reminder disabled');
}

function sendTestReminder(id) {
  nativeVibrate(20);
  if (nativeSendTestReminder(id)) nativeToast('Test reminder sent');
}

function handleReminderAction(event) {
  const button = event.target;
  const id = button.dataset.reminderId;
  const action = button.dataset.action;
  if (!id || !action) return;
  nativeVibrate(15);
  if (action === 'toggle') toggleReminder(id);
  else if (action === 'test') sendTestReminder(id);
  else if (action === 'edit') openReminderDialog(id);
  else if (action === 'delete') promptDeleteReminder(id);
}
