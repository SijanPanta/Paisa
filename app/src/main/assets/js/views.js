// ── UI RENDERING ───────────────────────────────────────────────
const TX_PAGE_SIZE = 20;
let txVisibleCount = TX_PAGE_SIZE;
let lastTxKey = null;

function render() {
  renderHeaderAndHero();
  renderFilterChips();
  renderTransactions();
  renderAnalytics();
  renderWallets();
  renderLoans();
  renderFriends();
  renderLoanDetail();
  renderSettings();
  updateUndoButton();
  updateTheme();
}

function renderHeaderAndHero() {
  document.getElementById('currencyPrefix').textContent = state.settings.currency;
  const loanCurrency = document.getElementById('loanCurrencySymbol');
  if (loanCurrency) loanCurrency.textContent = state.settings.currency;

  let totalInc = 0;
  let totalExp = 0;
  let totalSpent = 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  state.transactions.forEach(t => {
    const val = Number(t.amount) || 0;
    if (t.type === 'income') totalInc += val;
    else if (t.type === 'expense') {
      totalExp += val;
      if (!isNonSpendExpense(t)) totalSpent += val;
    }
  });

  const net = totalInc - totalExp;
  document.getElementById('netBalanceVal').textContent = Number(net).toLocaleString('en-IN');
  document.getElementById('totalIncomeVal').textContent = formatCurrency(totalInc);
  document.getElementById('totalExpenseVal').textContent = formatCurrency(totalSpent);

  // Monthly Budget Calculation
  let monthExpenses = 0;
  state.transactions.forEach(t => {
    if (t.type === 'expense' && !isNonSpendExpense(t)) {
      const d = new Date(t.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        monthExpenses += Number(t.amount) || 0;
      }
    }
  });

  const budget = Number(state.settings.budget) || 0;
  const budgetWrap = document.getElementById('budgetWrap');
  if (budget > 0) {
    budgetWrap.style.display = 'block';
    const percent = Math.min(100, Math.round((monthExpenses / budget) * 100));
    const remaining = budget - monthExpenses;
    document.getElementById('budgetPercentVal').textContent = `${percent}%`;
    document.getElementById('budgetRemainingVal').textContent = remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`;

    const bar = document.getElementById('budgetProgressBar');
    bar.style.width = `${percent}%`;
    bar.className = 'progress-bar-fill' + (percent >= 100 ? ' danger' : percent >= 80 ? ' warning' : '');
  } else {
    budgetWrap.style.display = 'none';
  }
}

function isLoanLinkedTransaction(tx) {
  return !!(tx && (tx.loanId || tx.categoryId === 'loan_pay' || tx.categoryId === 'loan_receive'));
}

function showMoreTransactions() {
  txVisibleCount += TX_PAGE_SIZE;
  renderTransactions();
}

function transactionTimelineHtml(t) {
  const isExp = t.type === 'expense';
  const isInc = t.type === 'income';
  const isTransfer = t.type === 'transfer';
  const sign = isExp ? '-' : isInc ? '+' : mi('swap_horiz');
  const amtClass = isExp ? 'expense' : isInc ? 'income' : 'transfer';
  const desc = t.note || t.categoryName || (isTransfer ? 'Transfer' : 'Transaction');
  let subMeta = '';
  if (isTransfer) {
    subMeta = `<span class="tx-kind">Transfer</span><span class="wallet-tag">${escapeHtml(t.account)} ${mi('arrow_forward')} ${escapeHtml(t.toAccount)}</span>`;
  } else {
    const account = `<span class="wallet-tag">${escapeHtml(t.account || 'Cash')}</span>`;
    const category = t.categoryName ? `<span class="tx-meta-cat">• ${escapeHtml(t.categoryName)}</span>` : '';
    subMeta = account + category;
  }

  return `
    <div class="tx-card">
      <div class="tx-row" onclick="viewTransaction('${t.id}')">
        <div class="tx-cat-icon ${amtClass}">${mi(categoryIconFor(t))}</div>
        <div class="tx-details">
          <div class="tx-title">${escapeHtml(desc)}</div>
          <div class="tx-subtext">${subMeta}</div>
        </div>
        <div class="tx-amount ${amtClass}">
          <span class="tx-sign">${sign}</span> ${formatCurrency(t.amount)}
        </div>
      </div>
    </div>
  `;
}

function splitTimelineHtml(split) {
  const desc = split.note ? `Split bill · ${split.note}` : 'Split bill';
  const friendsText = `${split.shareCount || (split.friendNames || []).length || 0} friends`;
  return `
    <div class="tx-card timeline-split-card">
      <div class="tx-row" onclick="viewSplit('${split.id}')">
        <div class="tx-cat-icon expense">${mi('receipt_long')}</div>
        <div class="tx-details">
          <div class="tx-title">${escapeHtml(desc)}</div>
          <div class="tx-subtext"><span class="tx-kind">Split</span><span class="wallet-tag">${escapeHtml(split.account || 'Cash')}</span><span class="tx-meta-cat">• ${friendsText}</span></div>
        </div>
        <div class="tx-amount expense"><span class="tx-sign">-</span> ${formatCurrency(split.amount)}${Number(split.myAmount) > 0 ? `<span class="split-share-note">(${formatCurrency(split.myAmount)} your share)</span>` : ''}</div>
      </div>
      <button type="button" class="timeline-delete-btn" onclick="promptDeleteSplit('${split.id}')" aria-label="Delete split">✕</button>
    </div>
  `;
}

function approvedLoanTimelineHtml(loan) {
  const isPay = loan.direction === 'pay';
  const amtClass = isPay ? 'expense' : 'income';
  const sign = isPay ? '-' : '+';
  const kind = isPay ? 'Paid friend' : 'Friend paid';
  const approvalTx = (state.transactions || []).find(tx => tx.id === loan.txId);
  const desc = (approvalTx && approvalTx.note) || `${kind} · ${loan.person}`;
  return `
    <div class="tx-card timeline-loan-card">
      <div class="tx-row" onclick="viewLoan('${loan.id}')">
        <div class="tx-cat-icon ${amtClass}">${mi('payments')}</div>
        <div class="tx-details">
          <div class="tx-title">${escapeHtml(desc)}</div>
          <div class="tx-subtext"><span class="tx-kind">${kind}</span><span class="wallet-tag">${escapeHtml(loan.account || 'Cash')}</span></div>
        </div>
        <div class="tx-amount ${amtClass}"><span class="tx-sign">${sign}</span> ${formatCurrency(loan.amount)}</div>
      </div>
    </div>
  `;
}

function buildTimelineItems() {
  const items = [];

  (state.transactions || []).forEach(tx => {
    if (isLoanLinkedTransaction(tx) || (typeof isSplitShareTransaction === 'function' && isSplitShareTransaction(tx))) return;
    items.push({
      kind: 'tx',
      id: tx.id,
      tx,
      date: tx.date,
      time: tx.time,
      account: tx.account,
      toAccount: tx.toAccount,
      searchText: [tx.note, tx.categoryName, tx.account, tx.toAccount, tx.type].filter(Boolean).join(' ').toLowerCase(),
      html: transactionTimelineHtml(tx)
    });
  });

  (state.splits || []).forEach(split => {
    items.push({
      kind: 'split',
      id: split.id,
      date: split.date,
      time: split.time,
      account: split.account,
      searchText: ['split', split.note, split.account].concat(split.friendNames || []).filter(Boolean).join(' ').toLowerCase(),
      html: splitTimelineHtml(split)
    });
  });

  (state.loans || []).forEach(loan => {
    if (!isLoanApproved(loan)) return;
    const approvalTx = (state.transactions || []).find(tx => tx.id === loan.txId);
    items.push({
      kind: 'loan',
      id: loan.id,
      loan,
      date: approvalTx ? approvalTx.date : loan.date,
      time: approvalTx ? approvalTx.time : loan.time,
      account: loan.account,
      searchText: [loan.person, loan.note, loan.account, approvalTx && approvalTx.note].filter(Boolean).join(' ').toLowerCase(),
      html: approvedLoanTimelineHtml(loan)
    });
  });

  items.sort((a, b) => timelineItemSortValue(b) - timelineItemSortValue(a));
  return items;
}

function timelineItemSortValue(item) {
  const parsed = new Date(`${item.date || ''} ${item.time || '00:00'}`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function timelineItemMatchesWallet(item, filter) {
  if (filter === 'bank') {
    return !!(item.account && isBankWallet(item.account)) || !!(item.toAccount && isBankWallet(item.toAccount));
  }
  const walletId = resolveWalletId(filter).toLowerCase();
  return (!!item.account && resolveWalletId(item.account).toLowerCase() === walletId) ||
    (!!item.toAccount && resolveWalletId(item.toAccount).toLowerCase() === walletId);
}

function timelineItemMatchesFilter(item, filter) {
  if (filter === 'all') return true;
  const lower = filter.toLowerCase();
  if (lower === 'split') return item.kind === 'split';
  if (lower === 'expense' || lower === 'income') return item.kind === 'tx' && item.tx.type === lower;
  return timelineItemMatchesWallet(item, filter);
}

function renderTransactions() {
  const listEl = document.getElementById('txListContainer');
  const txKey = `${state.activeFilter}|${state.searchQuery}`;
  if (txKey !== lastTxKey) {
    txVisibleCount = TX_PAGE_SIZE;
    lastTxKey = txKey;
  }

  const q = state.searchQuery.trim().toLowerCase();
  const items = buildTimelineItems().filter(item =>
    timelineItemMatchesFilter(item, state.activeFilter) && (!q || item.searchText.includes(q))
  );

  if (items.length === 0) {
    const emptyTitle = state.activeFilter.toLowerCase() === 'split' ? 'No split bills found' : 'No transactions found';
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${mi('receipt_long')}</div>
        <h3>${emptyTitle}</h3>
      </div>
    `;
    return;
  }

  const visibleItems = items.slice(0, txVisibleCount);
  const groups = {};
  visibleItems.forEach(item => {
    const dateKey = item.date || 'Unknown Date';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
  });

  let html = '';
  for (const [dateStr, groupItems] of Object.entries(groups)) {
    html += `<div class="tx-group-header"><span>${formatDateHeader(dateStr)}</span></div>`;
    html += '<div class="tx-group-items">';
    groupItems.forEach(item => { html += item.html; });
    html += '</div>';
  }

  if (items.length > visibleItems.length) {
    html += `<button type="button" class="show-more-btn" onclick="showMoreTransactions()">Show more (${items.length - visibleItems.length} left)</button>`;
  }

  listEl.innerHTML = html;
}

function renderAnalytics() {
  const catBreakdownEl = document.getElementById('analyticsCatBreakdown');
  const accountBreakdownEl = document.getElementById('analyticsAccountBreakdown');

  // Expense category breakdown
  const catTotals = {};
  let totalSpent = 0;
  let totalInc = 0;

  state.transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'expense') {
      if (isNonSpendExpense(t)) return;
      totalSpent += amt;
      const key = t.categoryName || 'Other';
      catTotals[key] = (catTotals[key] || 0) + amt;
    } else if (t.type === 'income') {
      totalInc += amt;
    }
  });

  // Render Categories
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length === 0) {
    catBreakdownEl.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No expense data yet this month.</p>';
  } else {
    let catHtml = '';
    sortedCats.forEach(([name, amt]) => {
      const pct = Math.round((amt / (totalSpent || 1)) * 100);
      catHtml += `
        <div class="cat-breakdown-row">
          <div class="cat-breakdown-header">
            <span>${name}</span>
            <span>${formatCurrency(amt)} (${pct}%)</span>
          </div>
          <div class="cat-breakdown-bar">
            <div class="cat-breakdown-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });
    catBreakdownEl.innerHTML = catHtml;
  }

  // Render Account distribution
  const accTotals = {};
  const allWallets = getAllWallets();
  allWallets.forEach(w => accTotals[w.id] = 0);
  state.transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      accTotals[t.account] = (accTotals[t.account] || 0) + amt;
    } else if (t.type === 'expense') {
      accTotals[t.account] = (accTotals[t.account] || 0) - amt;
    } else if (t.type === 'transfer') {
      accTotals[t.account] = (accTotals[t.account] || 0) - amt;
      accTotals[t.toAccount] = (accTotals[t.toAccount] || 0) + amt;
    }
  });

  let accHtml = '';
  Object.entries(accTotals).forEach(([acc, bal]) => {
    const wallet = allWallets.find(w => w.id === acc || w.name === acc);
    const label = wallet ? `${mi(wallet.icon)} ${escapeHtml(wallet.name)}` : escapeHtml(acc);
    accHtml += `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--surface-variant-subtle); font-size:13.5px;">
        <span>${label}</span>
        <strong style="color:${bal >= 0 ? 'var(--text-main)' : 'var(--expense)'}">${formatCurrency(bal)}</strong>
      </div>
    `;
  });
  accountBreakdownEl.innerHTML = accHtml;

  // Summary indicators
  const savingsRate = totalInc > 0 ? Math.max(0, Math.round(((totalInc - totalSpent) / totalInc) * 100)) : 0;
  document.getElementById('savingsRateVal').textContent = `${savingsRate}%`;

  const daysInMonth = new Date().getDate();
  const avgDaily = Math.round(totalSpent / daysInMonth);
  document.getElementById('avgDailySpendVal').textContent = formatCurrency(avgDaily);
}

function renderFilterChips() {
  const row = document.getElementById('typeFilterRow');
  if (!row) return;

  const baseFilters = [
    { id: 'all', label: 'All' },
    { id: 'expense', label: 'Expenses' },
    { id: 'income', label: 'Income' },
    { id: 'split', label: 'Split' },
    { id: 'cash', label: 'Cash' },
    { id: 'esewa', label: 'eSewa' },
    { id: 'khalti', label: 'Khalti' },
    { id: 'bank', label: 'Bank' }
  ];

  const bankFilters = (state.bankAccounts || []).map(b => ({
    id: b.id.toLowerCase(),
    label: b.name
  }));

  const allFilters = [...baseFilters, ...bankFilters];
  let html = '';
  allFilters.forEach(f => {
    const isActive = (state.activeFilter.toLowerCase() === f.id.toLowerCase()) ? 'active' : '';
    html += `<div class="pill-chip ${isActive}" data-filter="${escapeHtml(f.id)}" role="button" tabindex="0">${escapeHtml(f.label)}</div>`;
  });
  row.innerHTML = html;

  row.querySelectorAll('.pill-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      nativeVibrate(15);
      row.querySelectorAll('.pill-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFilter = chip.dataset.filter;
      renderTransactions();
    });
    chip.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.preventDefault) event.preventDefault();
        chip.click();
      }
    });
  });
}

function renderSettings() {
  document.getElementById('settingCurrencyVal').textContent = state.settings.currency;
  document.getElementById('settingBudgetVal').textContent = formatCurrency(state.settings.budget);
  document.getElementById('settingHapticVal').textContent = state.settings.haptics ? 'Enabled' : 'Disabled';

  const bioItem = document.getElementById('setBiometricItem');
  const bioVal = document.getElementById('settingBiometricVal');
  if (bioItem && bioVal) {
    if (!isBiometricSupported()) {
      bioVal.textContent = 'Not Supported';
      bioItem.style.opacity = '0.55';
    } else {
      bioVal.textContent = (state.settings.biometricLock !== false) ? 'Enabled' : 'Disabled';
      bioItem.style.opacity = '1';
    }
  }
}
