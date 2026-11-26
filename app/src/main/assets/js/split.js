let splitSelectedFriends = new Set();
let splitIncludeMe = true;
let pendingDeleteSplitId = null;

function splitCurrency() {
  return state.settings.currency || 'Rs.';
}

function selectedSplitFriends() {
  return (state.friends || []).filter(friend => splitSelectedFriends.has(friend.id));
}

function equalSplitShares(totalCents, friends, includeMe = true) {
  const participants = friends.length + (includeMe ? 1 : 0);
  const base = Math.floor(totalCents / participants);
  if (base <= 0) return null;
  return friends.map((friend, index) => ({
    friendId: friend.id,
    name: friend.name,
    cents: index === friends.length - 1 ? totalCents - base * (participants - 1) : base
  }));
}

function fillSplitEvenly() {
  const amountInput = document.getElementById('splitAmountInput');
  const totalCents = Math.round((Number(amountInput && amountInput.value) || 0) * 100);
  const friends = selectedSplitFriends();
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    nativeToast('Enter a bill amount greater than zero');
    return;
  }
  if (!friends.length) {
    nativeToast('Select at least one friend');
    return;
  }
  const shares = equalSplitShares(totalCents, friends, splitIncludeMe);
  if (!shares) {
    nativeToast('Amount is too small to split');
    return;
  }
  nativeVibrate(15);
  shares.forEach(share => {
    const input = document.getElementById('splitAmount_' + share.friendId);
    if (input) input.value = (share.cents / 100).toFixed(2);
  });
  renderSplitPreview();
}

function splitShares() {
  const amountInput = document.getElementById('splitAmountInput');
  const total = Math.round((Number(amountInput && amountInput.value) || 0) * 100) / 100;
  const friends = selectedSplitFriends();
  const result = {
    total,
    totalCents: Math.round(total * 100),
    myCents: 0,
    shares: [],
    friends,
    includeMe: splitIncludeMe,
    error: ''
  };

  if (!Number.isFinite(total) || result.totalCents <= 0) {
    result.error = 'Enter a bill amount greater than zero';
    return result;
  }
  if (!friends.length) {
    result.error = 'Select at least one friend';
    return result;
  }

  let assigned = 0;
  const shares = [];
  for (const friend of friends) {
    const input = document.getElementById('splitAmount_' + friend.id);
    const raw = Number(input && input.value);
    const cents = Math.round((Number.isFinite(raw) ? raw : 0) * 100);
    if (cents < 0) {
      result.error = 'Amounts cannot be negative';
      return result;
    }
    if (cents <= 0) {
      result.error = 'Enter an amount for every selected friend';
      return result;
    }
    assigned += cents;
    shares.push({ friendId: friend.id, name: friend.name, cents });
  }
  if (assigned > result.totalCents) {
    result.error = 'Friends\' amounts exceed the bill';
    return result;
  }
  if (!splitIncludeMe && assigned < result.totalCents) {
    result.error = 'Friends\' amounts must add up to the bill';
    return result;
  }
  result.shares = shares;
  result.myCents = splitIncludeMe ? result.totalCents - assigned : 0;
  return result;
}

function renderSplitPreview() {
  const preview = document.getElementById('splitPreview');
  if (!preview) return;
  const result = splitShares();
  if (!result.friends.length || result.totalCents <= 0) {
    preview.innerHTML = `<div class="split-preview-empty">${escapeHtml(result.error || 'Enter a bill')}</div>`;
    return;
  }
  preview.innerHTML = `
    ${splitIncludeMe ? `<div class="split-preview-row you"><span>You · your share</span><strong>${formatCurrency(result.myCents / 100)}</strong></div>` : ''}
    ${result.shares.map(share => `
      <div class="split-preview-row"><span>${escapeHtml(share.name)} · to receive</span><strong>${formatCurrency(share.cents / 100)}</strong></div>
    `).join('')}
    <div class="split-preview-total"><span>Bill total</span><strong>${formatCurrency(result.total)}</strong></div>
    ${result.error ? `<div class="split-preview-error">${escapeHtml(result.error)}</div>` : ''}
  `;
}

function renderSplitManualRows() {
  const rows = document.getElementById('splitManualRows');
  if (!rows) return;
  rows.innerHTML = selectedSplitFriends().map(friend => `
    <div class="split-friend-row">
      <span class="split-friend-name">${escapeHtml(friend.name)}</span>
      <span class="split-amount-field">
        <span>${escapeHtml(splitCurrency())}</span>
        <input type="number" id="splitAmount_${escapeHtml(friend.id)}" class="form-input" placeholder="0" inputmode="decimal" oninput="renderSplitPreview()" />
      </span>
    </div>
  `).join('');
}

function renderSplitAccountSelect(selected) {
  const select = document.getElementById('splitAccountSelect');
  const wallets = getAllWallets();
  const current = resolveWalletId(selected || select.value || 'Cash');
  if (current && !wallets.some(wallet => wallet.id === current)) {
    wallets.push({ id: current, name: current, icon: 'account_balance', isBank: true });
  }
  select.innerHTML = wallets.map(wallet =>
    `<option value="${escapeHtml(wallet.id)}">${escapeHtml(wallet.name)}</option>`).join('');
  select.value = current;
  if (!select.value && wallets.length) select.value = wallets[0].id;
  updateAccountPickerLabels();
}

function toggleSplitFriend(friendId) {
  if (!findFriend(friendId)) return;
  nativeVibrate(15);
  if (splitSelectedFriends.has(friendId)) splitSelectedFriends.delete(friendId);
  else splitSelectedFriends.add(friendId);
  renderFriendChips(splitSelectedFriends);
  renderSplitManualRows();
  renderSplitPreview();
}

function toggleSplitMe() {
  nativeVibrate(15);
  splitIncludeMe = !splitIncludeMe;
  renderFriendChips(splitSelectedFriends);
  renderSplitPreview();
}

function openSplitFromAction() {
  nativeVibrate(15);
  const modal = document.getElementById('txModal');
  const host = document.getElementById('txSplitHost');
  document.getElementById('txFormFields').style.display = 'none';
  host.style.display = 'block';
  host.appendChild(document.getElementById('splitForm'));
  state.selectedType = 'split';
  updateModalTypeUI();
  document.getElementById('sheetTitle').textContent = 'Split a Bill';
  modal.classList.add('show');
  initializeSplitFields();
  setTimeout(() => document.getElementById('splitAmountInput').focus(), 80);
}

function restoreTxFormHome() {
  const form = document.getElementById('splitForm');
  const home = document.getElementById('splitFormHome');
  if (form && home && form.parentElement !== home) home.appendChild(form);
  const host = document.getElementById('txSplitHost');
  if (host) host.style.display = 'none';
  const fields = document.getElementById('txFormFields');
  if (fields) fields.style.display = 'block';
}

function restoreSplitFormHome() {
  const form = document.getElementById('splitForm');
  const home = document.getElementById('splitFormHome');
  if (form && home && form.parentElement !== home) home.appendChild(form);
}

function initializeSplitFields() {
  splitIncludeMe = true;
  splitSelectedFriends = new Set((state.friends || []).map(friend => friend.id));
  document.getElementById('splitAmountInput').value = '';
  document.getElementById('splitNoteInput').value = '';
  document.getElementById('splitDateInput').value = localDateString();
  document.getElementById('splitCurrencySymbol').textContent = splitCurrency();
  renderSplitAccountSelect('Cash');
  renderFriendChips(splitSelectedFriends);
  renderSplitManualRows();
  renderSplitPreview();
}

function openSplitModal() {
  nativeVibrate(25);
  restoreTxFormHome();
  restoreSplitFormHome();
  initializeSplitFields();
  document.getElementById('splitModal').classList.add('show');
  setTimeout(() => document.getElementById('splitAmountInput').focus(), 80);
}

function openLoanSplitTab() {
  nativeVibrate(15);
  restoreTxFormHome();
  document.getElementById('loanModal').classList.add('show');
  document.getElementById('loanSheetTitle').textContent = 'Split a Bill';
  document.getElementById('loanFormFields').style.display = 'none';
  const host = document.getElementById('loanSplitHost');
  host.style.display = 'block';
  host.appendChild(document.getElementById('splitForm'));
  setLoanTab('split');
  initializeSplitFields();
  setTimeout(() => document.getElementById('splitAmountInput').focus(), 80);
}

function closeSplitModal() {
  restoreSplitFormHome();
  document.getElementById('splitModal').classList.remove('show');
}

function closeActiveSplit() {
  const form = document.getElementById('splitForm');
  const parentId = form && form.parentElement ? form.parentElement.id : '';
  if (parentId === 'loanSplitHost') closeLoanModal();
  else if (parentId === 'txSplitHost') closeModal();
  else closeSplitModal();
}

function saveSplit() {
  const result = splitShares();
  if (result.error) {
    nativeToast(result.error);
    return;
  }

  const now = new Date();
  const stamp = now.getTime();
  const date = document.getElementById('splitDateInput').value || localDateString();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const account = document.getElementById('splitAccountSelect').value || 'Cash';
  const note = document.getElementById('splitNoteInput').value.trim();
  const label = note ? `Split bill · ${note}` : 'Split bill';
  const splitId = 'split_' + stamp + '_' + Math.random().toString(36).substr(2, 5);
  const friendsTotal = result.shares.reduce((sum, share) => sum + share.cents, 0) / 100;

  recordUndo('Split bill');

  const expenseTxId = 'tx_' + stamp + '_' + Math.random().toString(36).substr(2, 5);
  state.transactions.unshift({
    id: expenseTxId,
    type: 'expense',
    amount: result.total,
    note: label,
    date,
    time,
    account,
    toAccount: null,
    categoryId: 'split_bill',
    categoryName: 'Split Bill',
    categoryIcon: 'receipt_long',
    splitId
  });

  if (!state.splits) state.splits = [];
  const split = {
    id: splitId,
    amount: result.total,
    friendsAmount: friendsTotal,
    myAmount: result.myCents / 100,
    includeMe: result.includeMe,
    shareCount: result.shares.length,
    friendIds: result.shares.map(share => share.friendId),
    friendNames: result.shares.map(share => share.name),
    shares: result.shares.map(share => ({
      friendId: share.friendId,
      name: share.name,
      amount: share.cents / 100
    })),
    loanIds: [],
    expenseTxId,
    account,
    note,
    date,
    time,
    createdAt: stamp
  };
  state.splits.unshift(split);

  if (!state.loans) state.loans = [];
  result.shares.forEach(share => {
    const amount = share.cents / 100;
    const key = (share.name || '').trim().toLowerCase();
    const existing = state.loans.find(loan =>
      loan.direction === 'receive' &&
      loan.status !== 'approved' &&
      (!!loan.splitId || (Array.isArray(loan.splitIds) && loan.splitIds.length > 0)) &&
      (loan.friendId === share.friendId || (loan.friendId == null && (loan.person || '').trim().toLowerCase() === key))
    );

    if (existing) {
      existing.amount = (Number(existing.amount) || 0) + amount;
      if (!Array.isArray(existing.adjustments)) existing.adjustments = [];
      existing.adjustments.push({
        id: 'adjust_' + stamp + '_' + share.friendId + '_' + Math.random().toString(36).substr(2, 5),
        delta: amount,
        label: 'Split bill added',
        note: label,
        splitId,
        date,
        time
      });
      existing.splitIds = (Array.isArray(existing.splitIds) ? existing.splitIds : [existing.splitId].filter(Boolean)).concat(splitId);
      split.loanIds.push(existing.id);
      return;
    }

    const loan = {
      id: 'loan_' + stamp + '_' + share.friendId + '_' + Math.random().toString(36).substr(2, 5),
      direction: 'receive',
      amount,
      originalAmount: amount,
      adjustments: [],
      person: share.name,
      friendId: share.friendId,
      account,
      note: label,
      date,
      time,
      status: 'pending',
      txId: null,
      splitId,
      splitIds: [splitId],
      createdAt: stamp
    };
    state.loans.unshift(loan);
    split.loanIds.push(loan.id);
  });

  saveState();
  closeActiveSplit();
  render();
  nativeVibrate(35);
  const spentText = splitIncludeMe ? ` · ${formatCurrency(result.myCents / 100)} spent` : '';
  nativeToast(`Split ${formatCurrency(result.total)}${spentText} · ${formatCurrency(friendsTotal)} to receive`);
}

function isSplitShareTransaction(tx) {
  return !!(tx && tx.splitId && tx.categoryId === 'split_bill');
}

function splitLinkedLoans(splitId) {
  const split = (state.splits || []).find(item => item.id === splitId);
  return (state.loans || []).filter(loan =>
    loan.splitId === splitId ||
    (Array.isArray(loan.splitIds) && loan.splitIds.includes(splitId)) ||
    !!(split && Array.isArray(split.loanIds) && split.loanIds.includes(loan.id))
  );
}

function viewSplit(splitId) {
  const split = (state.splits || []).find(item => item.id === splitId);
  if (!split) return;
  state.viewingSplitId = splitId;
  const loans = splitLinkedLoans(splitId);
  const title = split.note ? `Split bill · ${escapeHtml(split.note)}` : 'Split bill';
  const friends = (split.friendNames || []).map(name => escapeHtml(name)).join(', ') || '—';
  const loanRows = loans.map(loan => {
    const status = isLoanApproved(loan) ? 'Approved' : 'Pending';
    return `<div class="detail-row"><span class="detail-label">${escapeHtml(loan.person)}</span><span class="detail-value">${formatCurrency(loan.amount)} · ${status}</span></div>`;
  }).join('');

  document.getElementById('splitDetailBody').innerHTML = `
    <div class="detail-group">
      <div class="detail-row"><span class="detail-label">Split</span><span class="detail-value">${title}</span></div>
      <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${formatCurrency(split.amount)}</span></div>
      <div class="detail-row"><span class="detail-label">Friends</span><span class="detail-value">${friends}</span></div>
      <div class="detail-row"><span class="detail-label">Your share</span><span class="detail-value">${formatCurrency(split.myAmount || 0)}</span></div>
      <div class="detail-row"><span class="detail-label">Account</span><span class="detail-value">${escapeHtml(split.account || 'Cash')}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${formatDateHeader(split.date)}${split.time ? ' · ' + escapeHtml(split.time) : ''}</span></div>
      ${loanRows}
    </div>
  `;
  document.getElementById('splitDetailModal').classList.add('show');
}

function closeSplitDetailModal() {
  state.viewingSplitId = null;
  document.getElementById('splitDetailModal').classList.remove('show');
}

function promptDeleteSplit(splitId) {
  if (!splitId || !(state.splits || []).some(item => item.id === splitId)) return;
  pendingDeleteSplitId = splitId;
  const loans = splitLinkedLoans(splitId);
  const shared = loans.filter(loan => {
    const ids = [
      ...((Array.isArray(loan.splitIds) ? loan.splitIds : [loan.splitId].filter(Boolean)).filter(Boolean)),
      ...(state.splits || []).filter(item => item.id !== splitId && Array.isArray(item.loanIds) && item.loanIds.includes(loan.id)).map(item => item.id)
    ];
    return new Set(ids).size > 1;
  }).length;
  const removed = loans.length - shared;
  let description = 'This will remove this split and its friend entries.';
  if (removed) description += ` ${removed} linked loan${removed === 1 ? '' : 's'} will be deleted.`;
  if (shared) description += ` ${shared} shared loan${shared === 1 ? '' : 's'} will be reduced, not deleted.`;
  document.getElementById('deleteSplitDesc').textContent = description;
  document.getElementById('deleteSplitDialog').classList.add('show');
}

function closeDeleteSplitDialog() {
  pendingDeleteSplitId = null;
  document.getElementById('deleteSplitDialog').classList.remove('show');
}

function deleteSplitFromDetail() {
  if (state.viewingSplitId) promptDeleteSplit(state.viewingSplitId);
}

function confirmDeleteSplit() {
  const splitId = pendingDeleteSplitId;
  if (!splitId || !(state.splits || []).some(item => item.id === splitId)) {
    closeDeleteSplitDialog();
    return;
  }

  recordUndo('Delete split');
  const split = (state.splits || []).find(item => item.id === splitId);
  const removedLoanIds = [];

  splitLinkedLoans(splitId).forEach(loan => {
    if (!loan.splitId && !(Array.isArray(loan.splitIds) && loan.splitIds.length)) return;
    const allSplitIds = [...new Set((Array.isArray(loan.splitIds) && loan.splitIds.length
      ? loan.splitIds
      : [loan.splitId].filter(Boolean)).filter(Boolean))];
    const referencedByOtherSplits = (state.splits || [])
      .filter(item => item.id !== splitId && Array.isArray(item.loanIds) && item.loanIds.includes(loan.id))
      .map(item => item.id);
    const remainingSplitIds = [...new Set([
      ...allSplitIds.filter(id => id !== splitId),
      ...referencedByOtherSplits
    ])];

    if (!remainingSplitIds.length) {
      removedLoanIds.push(loan.id);
      return;
    }

    const share = (split.shares || []).find(item =>
      (loan.friendId != null && item.friendId === loan.friendId) ||
      ((item.name || '').trim().toLowerCase() && (item.name || '').trim().toLowerCase() === (loan.person || '').trim().toLowerCase())
    );
    const amount = Number(share && share.amount) ||
      (Number(loan.amount) || 0) / Math.max(1, allSplitIds.length);
    const nextAmount = Math.max(0, (Number(loan.amount) || 0) - amount);

    loan.amount = nextAmount;
    loan.splitIds = remainingSplitIds;
    if (Array.isArray(loan.adjustments)) {
      loan.adjustments = loan.adjustments.filter(adjustment => adjustment.splitId !== splitId);
    }

    if (loan.splitId === splitId) {
      const nextSplitId = remainingSplitIds[0];
      const nextSplit = (state.splits || []).find(item => item.id === nextSplitId);
      const nextShare = nextSplit && (nextSplit.shares || []).find(item =>
        (loan.friendId != null && item.friendId === loan.friendId) ||
        ((item.name || '').trim().toLowerCase() && (item.name || '').trim().toLowerCase() === (loan.person || '').trim().toLowerCase())
      );
      loan.splitId = nextSplitId;
      loan.originalAmount = nextShare ? Number(nextShare.amount) || 0 : nextAmount;
      loan.note = nextSplit ? (nextSplit.note ? `Split bill · ${nextSplit.note}` : 'Split bill') : loan.note;
      if (Array.isArray(loan.adjustments)) {
        loan.adjustments = loan.adjustments.filter(adjustment => adjustment.splitId !== nextSplitId);
      }
    }

    const approvalTx = (state.transactions || []).find(tx =>
      (loan.txId && tx.id === loan.txId) || tx.loanId === loan.id
    );
    if (approvalTx) approvalTx.amount = Math.max(0, (Number(approvalTx.amount) || 0) - amount);
  });

  state.transactions = (state.transactions || []).filter(tx =>
    tx.splitId !== splitId && !removedLoanIds.includes(tx.loanId)
  );
  state.loans = (state.loans || []).filter(loan => !removedLoanIds.includes(loan.id));
  state.splits = (state.splits || []).filter(item => item.id !== splitId);
  closeDeleteSplitDialog();
  closeSplitDetailModal();
  saveState();
  render();
  nativeVibrate(30);
  nativeToast(removedLoanIds.length ? 'Split and its loans deleted' : 'Split deleted and shared loans updated');
}
