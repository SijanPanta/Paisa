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
