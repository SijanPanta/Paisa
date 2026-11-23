// ── FRIEND LOANS & SEPARATE BALANCE SHEET ───────────────────────
const LOAN_DIRECTIONS = {
  pay: { label: 'To Pay', icon: 'payments', categoryId: 'loan_pay', categoryName: 'Loan Repayment' },
  receive: { label: 'To Receive', icon: 'paid', categoryId: 'loan_receive', categoryName: 'Loan Received' }
};

let loanDirection = 'pay';
let editingLoanId = null;
let viewingLoanId = null;
let pendingApproveLoanId = null;
let pendingDeleteLoanId = null;
let pendingAdjustKind = null;
let pendingAdjustLoanId = null;

function loanDirectionOf(loan) {
  return loan && loan.direction === 'receive' ? 'receive' : 'pay';
}

function loanOriginalAmount(loan) {
  if (!loan) return 0;
  return Number(loan.originalAmount != null ? loan.originalAmount : loan.amount) || 0;
}

function loanAdjustments(loan) {
  return loan && Array.isArray(loan.adjustments) ? loan.adjustments : [];
}

function loanTimeline(loan) {
  const splitShares = Array.isArray(loan.splitShares) ? loan.splitShares : [];
  const entries = [{
    id: 'origin_' + loan.id,
    label: splitShares.length ? 'Split bill recorded' : LOAN_DIRECTIONS[loanDirectionOf(loan)].label + ' recorded',
    note: loan.note || '',
    date: loan.date,
    time: loan.time || '',
    amount: splitShares.length ? 0 : loanOriginalAmount(loan),
    kind: 'origin'
  }];
  if (isLoanApproved(loan)) {
    entries.push({
      id: 'approved_' + loan.id,
      label: 'Approved into Net Balance',
      note: '',
      date: loan.date,
      time: loan.time || '',
      amount: 0,
      kind: 'approved'
    });
  }
  splitShares.forEach((share, index) => entries.push({
    id: 'split_share_' + loan.id + '_' + index,
    label: `${share.name} owes`,
    note: share.note || loan.note || '',
    date: loan.date,
    time: loan.time || '',
    amount: Number(share.amount) || 0,
    kind: 'add'
  }));
  loanAdjustments(loan).forEach(adjustment => entries.push({
    id: adjustment.id,
    label: adjustment.label || (Number(adjustment.delta) >= 0 ? 'Money added' : 'Money reduced'),
    note: adjustment.note || '',
    date: adjustment.date,
    time: adjustment.time || '',
    amount: Number(adjustment.delta) || 0,
    kind: Number(adjustment.delta) >= 0 ? 'add' : 'reduce'
  }));
  entries.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')));
  return entries;
}

function isLoanApproved(loan) {
  if (!loan || loan.status !== 'approved') return false;
  if (!loan.txId) return true;
  return (state.transactions || []).some(tx => tx.id === loan.txId || tx.loanId === loan.id);
}

function getLoanSummary() {
  const bucket = () => ({
    total: 0, pending: 0, approved: 0,
    count: 0, pendingCount: 0, approvedCount: 0
  });
  const summary = { pay: bucket(), receive: bucket(), pendingCount: 0, approvedCount: 0, pendingNet: 0, approvedNet: 0, net: 0 };

  (state.loans || []).forEach(loan => {
    const group = summary[loanDirectionOf(loan)];
    const amount = Number(loan.amount) || 0;
    group.total += amount;
    group.count++;
    if (isLoanApproved(loan)) {
      group.approved += amount;
      group.approvedCount++;
    } else {
      group.pending += amount;
      group.pendingCount++;
    }
  });

  summary.pendingCount = summary.pay.pendingCount + summary.receive.pendingCount;
  summary.approvedCount = summary.pay.approvedCount + summary.receive.approvedCount;
  summary.pendingNet = summary.receive.pending - summary.pay.pending;
  summary.approvedNet = summary.receive.approved - summary.pay.approved;
  summary.net = summary.receive.total - summary.pay.total;
  return summary;
}

function renderLoanHeroHint() {
  const el = document.getElementById('loanHeroHint');
  if (!el) return;
  const notice = document.getElementById('loanNotice');
  const summary = getLoanSummary();
  if (!summary.pendingCount) {
    el.textContent = '';
    if (notice) notice.style.display = 'none';
    return;
  }
  el.textContent = String(summary.pendingCount);
  if (notice) notice.style.display = 'flex';
}

function loanRow(loan, approved) {
  const direction = loanDirectionOf(loan);
  const meta = [formatDateHeader(loan.date), loan.account || 'Cash', approved ? 'Approved' : 'Pending', loan.note]
    .filter(Boolean).join(' · ');
  return `
    <div class="loan-card loan-clickable" data-loan="${escapeHtml(loan.id)}" onclick="handleLoanCardClick(event, this.dataset.loan)">
      <div class="loan-icon ${direction}">${mi(LOAN_DIRECTIONS[direction].icon)}</div>
      <div class="loan-info">
        <div class="loan-title">${escapeHtml(loan.person || 'Friend')}</div>
        <div class="loan-meta">${escapeHtml(meta)}</div>
      </div>
      <div class="loan-right">
        <div class="loan-amount ${direction}">${direction === 'receive' ? '+' : '-'} ${formatCurrency(loan.amount)}</div>
        <div class="loan-actions">
          <button type="button" class="loan-action edit" data-loan="${escapeHtml(loan.id)}" onclick="editLoan(this.dataset.loan)">Edit</button>
          ${approved ? `<button type="button" class="loan-action undo" data-loan="${escapeHtml(loan.id)}" onclick="requestLoanApprovalUndo(this.dataset.loan)">Undo approve</button>` : `<button type="button" class="loan-action approve" data-loan="${escapeHtml(loan.id)}" onclick="approveLoan(this.dataset.loan)">Approve</button>`}
          <button type="button" class="loan-action delete" data-loan="${escapeHtml(loan.id)}" onclick="promptDeleteLoan(this.dataset.loan)">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function handleLoanCardClick(event, loanId) {
  if (event && event.target && event.target.tagName === 'BUTTON') return;
  viewLoan(loanId);
}

function findLoan(loanId) {
  return (state.loans || []).find(loan => loan.id === loanId);
}

function viewLoan(loanId) {
  const loan = findLoan(loanId);
  if (!loan) return;
  viewingLoanId = loanId;
  renderLoanDetail();
  document.getElementById('loanDetailModal').classList.add('show');
}

function closeLoanDetail() {
  viewingLoanId = null;
  const modal = document.getElementById('loanDetailModal');
  if (modal) modal.classList.remove('show');
}

function renderLoanDetail() {
  if (!viewingLoanId) return;
  const loan = findLoan(viewingLoanId);
  const body = document.getElementById('loanDetailBody');
  if (!body) return;
  if (!loan) {
    closeLoanDetail();
    return;
  }
  const direction = loanDirectionOf(loan);
  const approved = isLoanApproved(loan);
  const entries = loanTimeline(loan);

  body.innerHTML = `
    <div class="loan-detail-hero ${direction}">
      <div class="loan-detail-icon">${mi(LOAN_DIRECTIONS[direction].icon)}</div>
      <div>
        <div class="loan-detail-person">${escapeHtml(loan.person || 'Friend')}</div>
        <div class="loan-detail-sub">${LOAN_DIRECTIONS[direction].label} · ${escapeHtml(formatDateHeader(loan.date))} · ${escapeHtml(loan.account || 'Cash')}</div>
      </div>
      <div class="loan-detail-amount">${direction === 'receive' ? '+' : '-'} ${formatCurrency(loan.amount)}</div>
    </div>
    ${loan.note ? `<div class="loan-detail-note">${escapeHtml(loan.note)}</div>` : ''}
    <div class="loan-detail-status ${approved ? 'approved' : 'pending'}">${approved ? 'Approved' : 'Pending'}</div>
    <div class="loan-timeline-heading">Loan timeline <span>${entries.length}</span></div>
    <div class="loan-timeline">
      ${entries.map(entry => `
        <div class="timeline-item ${entry.kind}">
          <div class="timeline-dot">${entry.kind === 'add' ? '+' : entry.kind === 'reduce' ? '-' : entry.kind === 'approved' ? '✓' : '•'}</div>
          <div class="timeline-content">
            <div class="timeline-row">
              <span class="timeline-label">${escapeHtml(entry.label)}</span>
              <span class="timeline-value ${entry.amount > 0 ? 'positive' : entry.amount < 0 ? 'negative' : ''}">${entry.amount ? (entry.amount > 0 ? '+' : '-') + ' ' + formatCurrency(Math.abs(entry.amount)) : '—'}</span>
            </div>
            ${entry.note ? `<div class="timeline-note">${escapeHtml(entry.note)}</div>` : ''}
            <div class="timeline-date">${escapeHtml(formatDateHeader(entry.date))}${entry.time ? ' · ' + escapeHtml(entry.time) : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const approveBtn = document.getElementById('toggleLoanApprovalBtn');
  if (approveBtn) approveBtn.textContent = approved ? 'Undo approve' : 'Approve';
}

function openLoanAdjustDialog(kind, loanId) {
  const loan = findLoan(loanId);
  if (!loan) return;
  pendingAdjustKind = kind === 'reduce' ? 'reduce' : 'add';
  pendingAdjustLoanId = loanId;
  const isAdd = pendingAdjustKind === 'add';
  document.getElementById('loanAdjustTitle').textContent = isAdd ? 'Add money' : 'Reduce money';
  document.getElementById('loanAdjustDesc').textContent = isAdd
    ? `Increase the balance of ${loan.person || 'this loan'} and record it in the timeline.`
    : `Record a repayment or reduction for ${loan.person || 'this loan'}.`;
  document.getElementById('loanAdjustIcon').textContent = isAdd ? '+' : '-';
  document.getElementById('loanAdjustConfirmBtn').textContent = isAdd ? 'Add money' : 'Reduce money';
  document.getElementById('loanAdjustAmountInput').value = '';
  document.getElementById('loanAdjustNoteInput').value = '';
  document.getElementById('loanAdjustDateInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('loanAdjustDialog').classList.add('show');
}

function closeLoanAdjustDialog() {
  pendingAdjustKind = null;
  pendingAdjustLoanId = null;
  const dialog = document.getElementById('loanAdjustDialog');
  if (dialog) dialog.classList.remove('show');
}

function confirmLoanAdjust() {
  const loan = findLoan(pendingAdjustLoanId);
  const kind = pendingAdjustKind;
  if (!loan || !kind) return;
  const amount = Number(document.getElementById('loanAdjustAmountInput').value);
  if (!Number.isFinite(amount) || amount <= 0) {
    nativeToast('Enter an amount greater than zero');
    return;
  }
  const delta = kind === 'add' ? amount : -amount;
  const outstanding = Number(loan.amount) || 0;
  if (outstanding + delta < 0) {
    nativeToast('Cannot reduce below zero');
    return;
  }
  const now = new Date();
  recordUndo(kind === 'add' ? 'Add loan money' : 'Reduce loan money');
  loan.adjustments = loanAdjustments(loan).concat([{
    id: 'adjust_' + now.getTime() + '_' + Math.random().toString(36).substr(2, 5),
    delta,
    note: document.getElementById('loanAdjustNoteInput').value.trim(),
    date: document.getElementById('loanAdjustDateInput').value || new Date().toISOString().split('T')[0],
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }]);
  loan.amount = outstanding + delta;
  document.getElementById('loanAmountInput').value = String(loan.amount);
  closeLoanAdjustDialog();
  saveState();
  render();
  nativeToast(kind === 'add' ? 'Money added to loan' : 'Money reduced from loan');
}

function renderLoans() {
  const summary = getLoanSummary();
  const pending = (state.loans || []).filter(loan => !isLoanApproved(loan));
  const approved = (state.loans || []).filter(isLoanApproved);
  const sortNewest = (a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00'));
  pending.sort(sortNewest);
  approved.sort(sortNewest);

  document.getElementById('loanNetVal').textContent = formatCurrency(summary.pendingNet);
  document.getElementById('loanPayTotal').textContent = formatCurrency(summary.pay.pending);
  document.getElementById('loanReceiveTotal').textContent = formatCurrency(summary.receive.pending);
  document.getElementById('loanApprovedImpact').textContent = `${formatCurrency(summary.pendingNet)} awaiting approval`;
  document.getElementById('loanSummaryHint').textContent = summary.pendingCount
    ? `${formatCurrency(summary.pendingNet)} from ${summary.pendingCount} pending ${summary.pendingCount === 1 ? 'loan' : 'loans'} is waiting for approval.`
    : 'No loans are waiting for approval.';
  document.getElementById('loanPendingCount').textContent = `${summary.pendingCount} pending`;
  document.getElementById('loanApprovedCount').textContent = `${summary.approvedCount} approved`;

  const pendingList = document.getElementById('loanPendingList');
  pendingList.innerHTML = pending.length
    ? pending.map(loan => loanRow(loan, false)).join('')
    : '<div class="loan-empty">No loans waiting for approval.</div>';

  const approvedList = document.getElementById('loanApprovedList');
  approvedList.innerHTML = approved.length
    ? approved.map(loan => loanRow(loan, true)).join('')
    : '<div class="loan-empty">No approved loans yet.</div>';

  const badge = document.getElementById('loanNavBadge');
  if (badge) {
    badge.textContent = summary.pendingCount;
    badge.style.display = summary.pendingCount ? 'inline-flex' : 'none';
  }
  renderLoanHeroHint();
}

function renderLoanAccountSelect(selected) {
  const select = document.getElementById('loanAccountSelect');
  const wallets = getAllWallets();
  const current = resolveWalletId(selected || select.value || 'Cash');
  if (current && !wallets.some(w => w.id === current)) {
    wallets.push({ id: current, name: current, icon: 'account_balance', isBank: true });
  }
  select.innerHTML = wallets.map(w =>
    `<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`).join('');
  select.value = current;
  if (!select.value && wallets.length) select.value = wallets[0].id;
  updateAccountPickerLabels();
}

function setLoanTab(name) {
  document.querySelectorAll('#loanDirectionSwitcher .loan-direction-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.direction === name);
  });
}

function restoreLoanForm() {
  const form = document.getElementById('splitForm');
  const home = document.getElementById('splitFormHome');
  if (form && home && form.parentElement !== home) home.appendChild(form);
  const host = document.getElementById('loanSplitHost');
  if (host) host.style.display = 'none';
  const fields = document.getElementById('loanFormFields');
  if (fields) fields.style.display = 'block';
  document.getElementById('loanSheetTitle').textContent = 'New Friend Loan';
}

function setLoanDirection(direction) {
  restoreLoanForm();
  loanDirection = direction === 'receive' ? 'receive' : 'pay';
  setLoanTab(loanDirection);
  document.getElementById('saveLoanBtn').textContent = `Save To ${loanDirection === 'pay' ? 'Pay' : 'Receive'}`;
}

function openLoanModal(direction = 'pay', loanId = null) {
  nativeVibrate(25);
  const loan = loanId ? (state.loans || []).find(item => item.id === loanId) : null;
  editingLoanId = loan ? loan.id : null;
  setLoanDirection(loan ? loan.direction : direction);

  document.getElementById('loanSheetTitle').textContent = loan ? 'Edit Loan' : 'New Friend Loan';
  document.getElementById('loanAmountInput').value = loan ? loan.amount : '';
  document.getElementById('loanPersonInput').value = loan ? (loan.person || '') : '';
  const matchedFriend = loan ? findFriendByName(loan.person) : null;
  renderLoanFriendChips(loan ? loan.friendId || (matchedFriend && matchedFriend.id) : null);
  document.getElementById('loanNoteInput').value = loan ? (loan.note || '') : '';
  document.getElementById('loanDateInput').value = loan ? loan.date : new Date().toISOString().split('T')[0];
  renderLoanAccountSelect(loan ? loan.account : 'Cash');
  document.getElementById('deleteLoanBtn').style.display = loan ? 'block' : 'none';
  document.getElementById('loanAddMoneyBtn').style.display = loan ? 'flex' : 'none';
  document.getElementById('loanReduceMoneyBtn').style.display = loan ? 'flex' : 'none';
  document.getElementById('loanAdjustHint').style.display = loan ? 'none' : 'block';

  document.getElementById('loanModal').classList.add('show');
  setTimeout(() => document.getElementById('loanAmountInput').focus(), 80);
}

function closeLoanModal() {
  restoreLoanForm();
  document.getElementById('loanModal').classList.remove('show');
  editingLoanId = null;
}

function editLoan(loanId) {
  const loan = findLoan(loanId);
  if (!loan) return;
  closeLoanDetail();
  openLoanModal(loanDirectionOf(loan), loan.id);
}

function saveLoan() {
  const amount = parseFloat(document.getElementById('loanAmountInput').value);
  const person = document.getElementById('loanPersonInput').value.trim();
  if (isNaN(amount) || amount <= 0) {
    nativeToast('Please enter a valid amount');
    return;
  }
  if (!person) {
    nativeToast('Please enter a friend\'s name');
    return;
  }

  const date = document.getElementById('loanDateInput').value || new Date().toISOString().split('T')[0];
  const account = document.getElementById('loanAccountSelect').value;
  const note = document.getElementById('loanNoteInput').value.trim();
  const matchedFriend = findFriendByName(person);
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!state.loans) state.loans = [];
  recordUndo(editingLoanId ? 'Edit loan' : 'Add loan');
  const loan = editingLoanId ? state.loans.find(item => item.id === editingLoanId) : null;
  if (loan) {
    const wasApproved = isLoanApproved(loan);
    const previousAmount = Number(loan.amount) || 0;
    const amountChanged = amount !== previousAmount;
    loan.originalAmount = loanOriginalAmount(loan);
    Object.assign(loan, {
      direction: loanDirection, amount, person, account, note, date,
      friendId: matchedFriend ? matchedFriend.id : null
    });
    if (amountChanged) {
      loan.adjustments = loanAdjustments(loan).concat([{
        id: 'adjust_' + now.getTime() + '_' + Math.random().toString(36).substr(2, 5),
        delta: amount - previousAmount,
        note: 'Amount edited',
        date,
        time
      }]);
    }
    if (wasApproved) {
      const config = LOAN_DIRECTIONS[loanDirection];
      const linked = (state.transactions || []).find(tx => tx.id === loan.txId || tx.loanId === loan.id);
      if (linked) {
        const linkedUpdate = {
          type: loanDirection === 'pay' ? 'expense' : 'income',
          account,
          note: `${config.label} · ${person}`,
          categoryId: config.categoryId,
          categoryName: config.categoryName,
          categoryIcon: config.icon
        };
        if (amountChanged) linkedUpdate.amount = amount;
        Object.assign(linked, linkedUpdate);
      }
    }
    nativeToast('Updated loan');
  } else {
    state.loans.unshift({
      id: 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      direction: loanDirection,
      amount,
      originalAmount: amount,
      adjustments: [],
      person,
      friendId: matchedFriend ? matchedFriend.id : null,
      account,
      note,
      date,
      time,
      status: 'pending',
      txId: null,
      createdAt: now.getTime()
    });
    nativeToast(`Added ${LOAN_DIRECTIONS[loanDirection].label} ${formatCurrency(amount)}`);
  }

  nativeVibrate(35);
  saveState();
  closeLoanModal();
  render();
}

function approveLoan(loanId) {
  const loan = (state.loans || []).find(item => item.id === loanId);
  if (!loan) return;
  nativeVibrate(25);
  if (isLoanApproved(loan)) {
    nativeToast('This loan is already approved');
    return;
  }
  pendingApproveLoanId = loan.id;
  const effect = loanDirectionOf(loan) === 'pay' ? 'deducted from' : 'added to';
  document.getElementById('approveLoanDesc').textContent =
    `Approve ${formatCurrency(loan.amount)} ${loanDirectionOf(loan) === 'pay' ? 'owed to' : 'owed by'} ${loan.person || 'your friend'}? This will be recorded as a transaction and ${effect} your Net Balance.`;
  document.getElementById('approveLoanDialog').classList.add('show');
}

function closeApproveLoanDialog() {
  pendingApproveLoanId = null;
  document.getElementById('approveLoanDialog').classList.remove('show');
}

function confirmApproveLoan() {
  const loan = (state.loans || []).find(item => item.id === pendingApproveLoanId);
  if (!loan || isLoanApproved(loan)) {
    closeApproveLoanDialog();
    return;
  }

  const direction = loanDirectionOf(loan);
  const config = LOAN_DIRECTIONS[direction];
  recordUndo('Approve loan');
  const now = new Date();
  const tx = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type: direction === 'pay' ? 'expense' : 'income',
    amount: Number(loan.amount) || 0,
    note: `${config.label} · ${loan.person || 'Friend'}`,
    date: loan.date || new Date().toISOString().split('T')[0],
    time: loan.time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    account: loan.account || 'Cash',
    toAccount: null,
    categoryId: config.categoryId,
    categoryName: config.categoryName,
    categoryIcon: config.icon,
    loanId: loan.id
  };

  state.transactions.unshift(tx);
  loan.status = 'approved';
  loan.txId = tx.id;
  loan.approvedAt = now.getTime();
  saveState();
  closeApproveLoanDialog();
  render();
  nativeVibrate(35);
  nativeToast(`Loan approved · ${formatCurrency(tx.amount)} ${direction === 'pay' ? 'deducted' : 'added'}`);
}

function requestLoanApprovalUndo(loanId) {
  const loan = findLoan(loanId);
  if (!loan || !isLoanApproved(loan)) return;
  requestUndo('Undo loan approval', () => undoLoanApproval(loanId));
}

function undoLoanApproval(loanId) {
  const loan = (state.loans || []).find(item => item.id === loanId);
  if (!loan || !isLoanApproved(loan)) return;
  nativeVibrate(25);
  recordUndo('Undo loan approval');
  state.transactions = state.transactions.filter(tx =>
    tx.loanId !== loan.id && tx.id !== loan.txId);
  loan.status = 'pending';
  loan.txId = null;
  loan.approvedAt = null;
  saveState();
  render();
  nativeToast('Loan approval undone');
}

function promptDeleteLoan(loanId) {
  const loan = (state.loans || []).find(item => item.id === loanId);
  if (!loan) return;
  nativeVibrate(20);
  pendingDeleteLoanId = loan.id;
  document.getElementById('deleteLoanDesc').textContent = isLoanApproved(loan)
    ? `Delete the ${formatCurrency(loan.amount)} loan with ${loan.person || 'your friend'}? Its linked transaction will also be removed, reversing the effect on Net Balance.`
    : `Remove the ${formatCurrency(loan.amount)} loan with ${loan.person || 'your friend'} from your balance sheet?`;
  document.getElementById('deleteLoanDialog').classList.add('show');
}

function closeDeleteLoanDialog() {
  pendingDeleteLoanId = null;
  document.getElementById('deleteLoanDialog').classList.remove('show');
}

function confirmDeleteLoan() {
  const loan = (state.loans || []).find(item => item.id === pendingDeleteLoanId);
  if (!loan) {
    closeDeleteLoanDialog();
    return;
  }
  recordUndo('Delete loan');
  state.transactions = state.transactions.filter(tx =>
    tx.loanId !== loan.id && tx.id !== loan.txId);
  state.loans = state.loans.filter(item => item.id !== loan.id);
  if (editingLoanId === loan.id) closeLoanModal();
  if (viewingLoanId === loan.id) closeLoanDetail();
  saveState();
  closeDeleteLoanDialog();
  render();
  nativeVibrate(30);
  nativeToast('Loan deleted');
}

function unlinkDeletedLoanTransactions(ids) {
  const removed = ids instanceof Set ? ids : new Set(ids);
  (state.loans || []).forEach(loan => {
    if (loan.txId && (removed.has(loan.txId) || removed.has(loan.id))) {
      loan.status = 'pending';
      loan.txId = null;
      loan.approvedAt = null;
    }
  });
}
