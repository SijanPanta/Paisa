function renderCategories() {
  const grid = document.getElementById('catGrid');
  const list = state.selectedType === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;

  let html = '';
  list.forEach(c => {
    const active = (state.selectedCat === c.id) ? 'active' : '';
    html += `
      <div class="cat-btn ${active}" onclick="selectCategory('${c.id}')">
        <div class="cat-btn-icon">${mi(c.icon)}</div>
        <div class="cat-btn-label">${c.name}</div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

function selectCategory(id) {
  nativeVibrate(20);
  state.selectedCat = id;
  renderCategories();
}

// ── MODAL HANDLING ─────────────────────────────────────────────
function renderAccountSelects(selectedAccount, selectedToAccount) {
  const fromSelect = document.getElementById('txAccountSelect');
  const toSelect = document.getElementById('txToAccountSelect');
  const wallets = getAllWallets();

  const currentFrom = resolveWalletId(selectedAccount || fromSelect.value || 'Cash');
  let currentTo = resolveWalletId(selectedToAccount || toSelect.value);
  if (!currentTo || currentTo === currentFrom) {
    const alt = wallets.find(w => w.id !== currentFrom);
    currentTo = alt ? alt.id : 'eSewa';
  }

  [currentFrom, currentTo].forEach(id => {
    if (id && !wallets.some(w => w.id === id)) {
      wallets.push({ id, name: id, icon: 'account_balance', isBank: true });
    }
  });

  let optionsHtml = '';
  wallets.forEach(w => {
    optionsHtml += `<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`;
  });

  fromSelect.innerHTML = optionsHtml;
  toSelect.innerHTML = optionsHtml;

  fromSelect.value = currentFrom;
  if (!fromSelect.value && wallets.length > 0) fromSelect.value = wallets[0].id;

  toSelect.value = currentTo;
  if (!toSelect.value && wallets.length > 1) toSelect.value = wallets[1].id;
  updateAccountPickerLabels();
}

function openAddModalForWallet(walletId) {
  nativeVibrate(25);
  openAddModal('expense', walletId);
}

function openAddModal(type = 'expense', initialAccount = null) {
  nativeVibrate(25);
  restoreTxFormHome();
  state.editingTxId = null;
  state.selectedType = type;
  state.selectedCat = type === 'income' ? DEFAULT_INCOME_CATEGORIES[0].id : DEFAULT_EXPENSE_CATEGORIES[0].id;

  document.getElementById('sheetTitle').textContent = 'New Transaction';
  document.getElementById('txAmountInput').value = '';
  document.getElementById('txNoteInput').value = '';
  document.getElementById('txDateInput').value = localDateString();

  const defaultTo = (initialAccount === 'eSewa') ? 'Khalti' : 'eSewa';
  renderAccountSelects(initialAccount || 'Cash', defaultTo);

  document.getElementById('deleteTxBtn').style.display = 'none';

  updateModalTypeUI();
  document.getElementById('txModal').classList.add('show');
  setTimeout(() => document.getElementById('txAmountInput').focus(), 80);
}

function openEditModal(txId) {
  nativeVibrate(25);
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  restoreTxFormHome();
  state.editingTxId = txId;
  state.selectedType = tx.type;
  state.selectedCat = tx.categoryId || (tx.type === 'income' ? 'salary' : 'food');

  document.getElementById('sheetTitle').textContent = 'Edit Transaction';
  document.getElementById('txAmountInput').value = tx.amount;
  document.getElementById('txNoteInput').value = tx.note || '';
  document.getElementById('txDateInput').value = tx.date;

  renderAccountSelects(tx.account || 'Cash', tx.toAccount || 'eSewa');

  document.getElementById('deleteTxBtn').style.display = 'block';

  updateModalTypeUI();
  document.getElementById('txModal').classList.add('show');
}

function closeModal() {
  restoreTxFormHome();
  document.getElementById('txModal').classList.remove('show');
}

function viewTransaction(txId) {
  nativeVibrate(15);
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;
  state.viewingTxId = txId;

  const isExp = tx.type === 'expense';
  const isInc = tx.type === 'income';
  const sign = isExp ? '-' : isInc ? '+' : mi('swap_horiz');
  const amtClass = isExp ? 'expense' : isInc ? 'income' : 'transfer';
  const typeLabel = isExp ? 'Expense' : isInc ? 'Income' : 'Transfer';
  const typeIcon = isExp ? 'payments' : isInc ? 'paid' : 'swap_horiz';
  const walletLabel = w => `${mi(w.icon)} ${escapeHtml(w.name)}`;

  let accountVal;
  const allWallets = getAllWallets();
  if (tx.type === 'transfer') {
    const fromW = allWallets.find(x => x.id === tx.account || x.name === tx.account);
    const toW = allWallets.find(x => x.id === tx.toAccount || x.name === tx.toAccount);
    accountVal = `${fromW ? walletLabel(fromW) : escapeHtml(tx.account)} ${mi('arrow_forward')} ${toW ? walletLabel(toW) : escapeHtml(tx.toAccount)}`;
  } else {
    const w = allWallets.find(x => x.id === tx.account || x.name === tx.account);
    accountVal = w ? walletLabel(w) : `${mi('payments')} ${escapeHtml(tx.account || 'Cash')}`;
  }

  document.getElementById('txDetailBody').innerHTML = `
    <div class="detail-amount ${amtClass}">${sign} ${formatCurrency(tx.amount)}</div>
    <div class="detail-rows">
      <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${mi(typeIcon)} ${typeLabel}</span></div>
      <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${tx.type === 'transfer' ? `${mi('swap_horiz')} Transfer` : `${mi(categoryIconFor(tx))} ${escapeHtml(tx.categoryName || '—')}`}</span></div>
      <div class="detail-row"><span class="detail-label">${tx.type === 'transfer' ? `From ${mi('arrow_forward')} To` : 'Account'}</span><span class="detail-value">${accountVal}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${formatDateHeader(tx.date)}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${escapeHtml(tx.time || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Note</span><span class="detail-value">${escapeHtml(tx.note || '—')}</span></div>
    </div>
  `;

  document.getElementById('txDetailModal').classList.add('show');
}

function closeDetailModal() {
  document.getElementById('txDetailModal').classList.remove('show');
}

function updateModalTypeUI() {
  const type = state.selectedType;
  document.querySelectorAll('.type-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.type === type);
  });

  const catGroup = document.getElementById('catGroup');
  const toGroup = document.getElementById('toAccountGroup');
  const accLabel = document.getElementById('accountLabel');

  if (type === 'transfer') {
    catGroup.style.display = 'none';
    toGroup.style.display = 'block';
    accLabel.textContent = 'From Account';
  } else {
    catGroup.style.display = 'block';
    toGroup.style.display = 'none';
    accLabel.textContent = 'Account / Wallet';
    renderCategories();
  }
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('txAmountInput').value);
  if (isNaN(amount) || amount <= 0) {
    nativeToast('Please enter a valid amount');
    return;
  }

  const note = document.getElementById('txNoteInput').value.trim();
  const date = document.getElementById('txDateInput').value || localDateString();
  const account = document.getElementById('txAccountSelect').value;
  const type = state.selectedType;

  let category = null;
  let toAccount = null;

  if (type === 'transfer') {
    toAccount = document.getElementById('txToAccountSelect').value;
    if (toAccount === account) {
      nativeToast('From and To accounts must be different');
      return;
    }
  } else {
    const catList = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    category = catList.find(c => c.id === state.selectedCat) || catList[0];
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  recordUndo(state.editingTxId ? 'Edit transaction' : 'Add transaction');

  if (state.editingTxId) {
    // Update existing
    const idx = state.transactions.findIndex(t => t.id === state.editingTxId);
    if (idx !== -1) {
      state.transactions[idx] = {
        ...state.transactions[idx],
        type,
        amount,
        note,
        date,
        account,
        toAccount,
        categoryId: category ? category.id : null,
        categoryName: category ? category.name : (type === 'transfer' ? 'Transfer' : ''),
        categoryIcon: category ? category.icon : 'swap_horiz'
      };
    }
    nativeToast('Updated transaction');
  } else {
    // Create new
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type,
      amount,
      note,
      date,
      time: timeStr,
      account,
      toAccount,
      categoryId: category ? category.id : null,
      categoryName: category ? category.name : (type === 'transfer' ? 'Transfer' : ''),
      categoryIcon: category ? category.icon : 'swap_horiz'
    };
    state.transactions.unshift(newTx);
    nativeToast('Added ' + formatCurrency(amount));
  }

  nativeVibrate(35);
  saveState();
  closeModal();
  render();
}

function deleteTransaction() {
  if (!state.editingTxId) return;
  openDeleteTxDialog();
}

function executeDeleteTransaction() {
  if (!state.editingTxId) return;
  const deletedId = state.editingTxId;
  recordUndo('Delete transaction');
  unlinkDeletedLoanTransactions([deletedId]);
  state.transactions = state.transactions.filter(t => t.id !== deletedId);
  saveState();
  closeDeleteTxDialog();
  closeModal();
  nativeToast('Transaction deleted');
  render();
}
