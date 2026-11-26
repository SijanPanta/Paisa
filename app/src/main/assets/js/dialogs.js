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
let tempReminderRepeat = 'none';

const REMINDER_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function populateReminderWeekdays() {
  const input = document.getElementById('reminderWeekdayInput');
  if (!input) return;
  input.innerHTML = '';
  REMINDER_WEEKDAYS.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = name;
    input.appendChild(option);
  });
}

function populateReminderBsSelects() {
  const yearInput = document.getElementById('reminderBsYearInput');
  const monthInput = document.getElementById('reminderBsMonthInput');
  if (!yearInput || !monthInput) return;
  yearInput.innerHTML = '';
  for (let year = BS_YEAR_ZERO; year <= BS_YEAR_ZERO + BS_ENCODED_MONTH_LENGTHS.length - 1; year++) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = `${year} BS`;
    yearInput.appendChild(option);
  }
  monthInput.innerHTML = '';
  BS_MONTH_NAMES_EN.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = name;
    monthInput.appendChild(option);
  });
}

function populateReminderBsDays(year, month, selectedDay) {
  const dayInput = document.getElementById('reminderBsDayInput');
  if (!dayInput) return null;
  let max;
  try {
    max = bsDaysInMonth(year, month);
  } catch (error) {
    max = 29;
  }
  dayInput.innerHTML = '';
  for (let day = 1; day <= max; day++) {
    const option = document.createElement('option');
    option.value = String(day);
    option.textContent = String(day);
    dayInput.appendChild(option);
  }
  const day = Math.min(Math.max(Number(selectedDay) || 1, 1), max);
  dayInput.value = String(day);
  return day;
}

function syncReminderBsDateInputs() {
  const year = Number(document.getElementById('reminderBsYearInput').value);
  const month = Number(document.getElementById('reminderBsMonthInput').value);
  const requestedDay = Number(document.getElementById('reminderBsDayInput').value);
  const day = populateReminderBsDays(year, month, requestedDay);
  if (!day) return null;
  const gregorian = bsToGregorian(year, month, day);
  document.getElementById('reminderDateInput').value = gregorian;
  const weekdayValue = Number(document.getElementById('reminderWeekdayInput').value);
  const prefix = tempReminderRepeat === 'daily'
    ? 'Every day · '
    : tempReminderRepeat === 'weekly' && Number.isInteger(weekdayValue)
      ? `Every ${REMINDER_WEEKDAYS[weekdayValue]} · `
      : '';
  document.getElementById('reminderDateHint').textContent = prefix + bsDateLabel(year, month, day, false);
  return [year, month, day];
}

function setReminderBsDate(parts) {
  populateReminderBsSelects();
  let [year, month, day] = parts;
  if (!isValidBsDate(year, month, day)) {
    const today = gregorianToBs(localDateString());
    [year, month, day] = [today.year, today.month, today.day];
  }
  document.getElementById('reminderBsYearInput').value = String(year);
  document.getElementById('reminderBsMonthInput').value = String(month);
  populateReminderBsDays(year, month, day);
  syncReminderBsDateInputs();
}

function syncReminderWeekdayDate() {
  const input = document.getElementById('reminderWeekdayInput');
  if (!input) return null;
  const weekday = Number(input.value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  const gregorian = localDateString(date);
  const converted = gregorianToBs(gregorian);
  document.getElementById('reminderBsYearInput').value = String(converted.year);
  document.getElementById('reminderBsMonthInput').value = String(converted.month);
  populateReminderBsDays(converted.year, converted.month, converted.day);
  syncReminderBsDateInputs();
  return gregorian;
}

function updateReminderScheduleFields(repeat = tempReminderRepeat) {
  const dateGroup = document.getElementById('reminderDateGroup');
  const weekdayGroup = document.getElementById('reminderWeekdayGroup');
  const timeGroup = document.getElementById('reminderTimeGroup');
  const scheduleRow = document.getElementById('reminderScheduleRow');
  const dateRow = document.getElementById('reminderBsDateRow');
  const yearInput = document.getElementById('reminderBsYearInput');
  const monthInput = document.getElementById('reminderBsMonthInput');
  if (!dateGroup || !weekdayGroup || !timeGroup || !scheduleRow) return;
  const showDate = repeat === 'monthly' || repeat === 'none';
  const showWeekday = repeat === 'weekly';
  const dayOnly = repeat === 'monthly';
  dateGroup.style.display = showDate ? '' : 'none';
  weekdayGroup.style.display = showWeekday ? '' : 'none';
  timeGroup.style.display = '';
  if (dateRow) dateRow.classList.toggle('day-only', dayOnly);
  if (yearInput) yearInput.style.display = dayOnly ? 'none' : '';
  if (monthInput) monthInput.style.display = dayOnly ? 'none' : '';
  if (showWeekday) syncReminderWeekdayDate();
  else syncReminderBsDateInputs();
}

function openReminderDialog(id = null) {
  nativeVibrate(20);
  pendingReminderId = id || null;
  const reminder = id ? (state.reminders || []).find(r => r.id === id) : null;
  document.getElementById('reminderDialogTitle').textContent = reminder ? 'Edit Reminder' : 'Add Reminder';
  document.getElementById('reminderTitleInput').value = reminder ? reminder.title || '' : '';
  document.getElementById('reminderAmountInput').value = reminder && reminder.amount ? reminder.amount : '';
  document.getElementById('reminderNoteInput').value = reminder ? reminder.note || '' : '';
  let bsParts = null;
  try {
    if (reminder && reminder.calendar === 'bs' && reminder.bsDate) {
      bsParts = String(reminder.bsDate).split('-').map(Number);
    } else {
      const converted = gregorianToBs(reminder && reminder.date ? reminder.date : localDateString());
      bsParts = [converted.year, converted.month, converted.day];
    }
  } catch (error) {
    bsParts = null;
  }
  if (!bsParts || bsParts.length !== 3 || !isValidBsDate(bsParts[0], bsParts[1], bsParts[2])) {
    const today = gregorianToBs(localDateString());
    bsParts = [today.year, today.month, today.day];
  }
  setReminderBsDate(bsParts);
  populateReminderWeekdays();
  const weekdaySource = reminder && reminder.date ? reminder.date : localDateString();
  const weekdayParts = weekdaySource.split('-').map(Number);
  const weekday = weekdayParts.length === 3 && weekdayParts.every(Number.isInteger)
    ? new Date(weekdayParts[0], weekdayParts[1] - 1, weekdayParts[2]).getDay()
    : new Date().getDay();
  document.getElementById('reminderWeekdayInput').value = String(weekday);
  document.getElementById('reminderTimeInput').value = reminder ? reminder.time || '09:00' : '09:00';
  tempReminderRepeat = reminder ? reminder.repeat || 'none' : 'monthly';
  document.querySelectorAll('#reminderRepeatPresets .preset-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.repeat === tempReminderRepeat);
  });
  updateReminderScheduleFields(tempReminderRepeat);
  document.getElementById('reminderEnabledInput').checked = reminder ? reminder.enabled !== false : true;
  document.getElementById('reminderEnabledRow').style.display = reminder ? 'block' : 'none';
  document.getElementById('deleteReminderBtn').style.display = reminder ? '' : 'none';
  document.getElementById('reminderActions').classList.toggle('single-action', !reminder);
  document.getElementById('reminderDialog').classList.add('show');
  setTimeout(() => document.getElementById('reminderTitleInput').focus(), 80);
}

function closeReminderDialog() {
  pendingReminderId = null;
  document.getElementById('reminderDialog').classList.remove('show');
}

function saveReminder() {
  const title = (document.getElementById('reminderTitleInput').value || '').trim();
  const time = document.getElementById('reminderTimeInput').value || '';
  const note = (document.getElementById('reminderNoteInput').value || '').trim();
  const rawAmount = (document.getElementById('reminderAmountInput').value || '').trim();
  if (!title) {
    nativeToast('Please enter a reminder title');
    return;
  }
  let date = '';
  let bsDate = '';
  try {
    if (tempReminderRepeat === 'weekly') syncReminderWeekdayDate();
    const parts = syncReminderBsDateInputs();
    if (!parts || !isValidBsDate(parts[0], parts[1], parts[2])) throw new Error('Invalid BS date');
    date = bsToGregorian(parts[0], parts[1], parts[2]);
    bsDate = `${parts[0]}-${bsPad(parts[1])}-${bsPad(parts[2])}`;
  } catch (error) {
    date = '';
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
    title, amount, note, date, time, calendar: 'bs', bsDate,
    repeat: tempReminderRepeat,
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
  nativeVibrate(15);
  reminder.enabled = reminder.enabled === false;
  saveState();
  nativeSyncReminders();
  renderSettings();
  nativeToast(reminder.enabled ? 'Reminder enabled' : 'Reminder disabled');
}

function handleReminderAction(event) {
  const button = event.target;
  const id = button.dataset.reminderId;
  const action = button.dataset.action;
  if (!id || !action) return;
  if (action === 'toggle') toggleReminder(id);
  else if (action === 'edit') openReminderDialog(id);
  else if (action === 'delete') promptDeleteReminder(id);
}
