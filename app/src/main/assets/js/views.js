// ── UI RENDERING ───────────────────────────────────────────────
function render() {
  renderHeaderAndHero();
  renderFilterChips();
  renderTransactions();
  renderAnalytics();
  renderWallets();
  renderSettings();
  updateTheme();
}

function renderHeaderAndHero() {
  document.getElementById('currencyPrefix').textContent = state.settings.currency;

  let totalInc = 0;
  let totalExp = 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  state.transactions.forEach(t => {
    const val = Number(t.amount) || 0;
    if (t.type === 'income') totalInc += val;
    else if (t.type === 'expense') totalExp += val;
  });

  const net = totalInc - totalExp;
  document.getElementById('netBalanceVal').textContent = Number(net).toLocaleString('en-IN');
  document.getElementById('totalIncomeVal').textContent = formatCurrency(totalInc);
  document.getElementById('totalExpenseVal').textContent = formatCurrency(totalExp);

  // Monthly Budget Calculation
  let monthExpenses = 0;
  state.transactions.forEach(t => {
    if (t.type === 'expense') {
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

function renderTransactions() {
  const listEl = document.getElementById('txListContainer');
  let txs = [...state.transactions];

  // Filter by type or wallet
  if (state.activeFilter !== 'all') {
    const filterLower = state.activeFilter.toLowerCase();
    if (filterLower === 'expense' || filterLower === 'income') {
      txs = txs.filter(t => t.type === filterLower);
    } else if (filterLower === 'bank') {
      // 'bank' matches generic Bank or any custom bank account
      txs = txs.filter(t => {
        const acc = (t.account || '').toLowerCase();
        const toAcc = (t.toAccount || '').toLowerCase();
        const isBankMatch = (name) => {
          if (!name) return false;
          if (name === 'bank' || name === 'bank account') return true;
          return (state.bankAccounts || []).some(b => (b.name || '').toLowerCase() === name || (b.id || '').toLowerCase() === name);
        };
        return isBankMatch(acc) || isBankMatch(toAcc);
      });
    } else {
      // Wallet filter (cash, esewa, khalti, or specific bank)
      txs = txs.filter(t => (t.account && t.account.toLowerCase() === filterLower) || (t.toAccount && t.toAccount.toLowerCase() === filterLower));
    }
  }

  // Filter by search query
  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    txs = txs.filter(t => 
      (t.note && t.note.toLowerCase().includes(q)) ||
      (t.categoryName && t.categoryName.toLowerCase().includes(q)) ||
      (t.account && t.account.toLowerCase().includes(q))
    );
  }

  // Sort newest first
  txs.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')));

  if (txs.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${mi('receipt_long')}</div>
        <h3>No transactions found</h3>
        <p>Tap the <strong>+</strong> button below to record your first transaction.</p>
      </div>
    `;
    return;
  }

  // Group by date
  const groups = {};
  txs.forEach(t => {
    const dateKey = t.date || 'Unknown Date';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(t);
  });

  let html = '';
  for (const [dateStr, items] of Object.entries(groups)) {
    html += `<div class="tx-group-header"><span>${formatDateHeader(dateStr)}</span></div>`;
    html += '<div class="tx-card">';
    items.forEach(t => {
      const isExp = t.type === 'expense';
      const isInc = t.type === 'income';
      const sign = isExp ? '-' : isInc ? '+' : mi('swap_horiz');
      const amtClass = isExp ? 'expense' : isInc ? 'income' : 'transfer';

      let desc = t.note || t.categoryName || 'Transaction';
      let subMeta = '';
      if (t.type === 'transfer') {
        subMeta = `<span class="wallet-tag">${escapeHtml(t.account)} ${mi('arrow_forward')} ${escapeHtml(t.toAccount)}</span>`;
      } else {
        subMeta = `<span class="wallet-tag">${escapeHtml(t.account || 'Cash')}</span> ${t.categoryName ? '• ' + escapeHtml(t.categoryName) : ''}`;
      }

      html += `
        <div class="tx-row" onclick="viewTransaction('${t.id}')">
          <div class="tx-cat-icon">${mi(categoryIconFor(t))}</div>
          <div class="tx-details">
            <div class="tx-title">${escapeHtml(desc)}</div>
            <div class="tx-subtext">${subMeta}</div>
          </div>
          <div class="tx-amount ${amtClass}">
            ${sign} ${formatCurrency(t.amount)}
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  listEl.innerHTML = html;
}

function renderAnalytics() {
  const catBreakdownEl = document.getElementById('analyticsCatBreakdown');
  const accountBreakdownEl = document.getElementById('analyticsAccountBreakdown');

  // Expense category breakdown
  const catTotals = {};
  let totalExp = 0;
  let totalInc = 0;

  state.transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'expense') {
      totalExp += amt;
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
      const pct = Math.round((amt / (totalExp || 1)) * 100);
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
  const savingsRate = totalInc > 0 ? Math.max(0, Math.round(((totalInc - totalExp) / totalInc) * 100)) : 0;
  document.getElementById('savingsRateVal').textContent = `${savingsRate}%`;

  const daysInMonth = new Date().getDate();
  const avgDaily = Math.round(totalExp / daysInMonth);
  document.getElementById('avgDailySpendVal').textContent = formatCurrency(avgDaily);
}

function renderWallets() {
  const container = document.getElementById('walletsContainer');
  const balances = {};
  const counts = {};
  const allWallets = getAllWallets();

  allWallets.forEach(w => {
    balances[w.id] = 0;
    counts[w.id] = 0;
  });

  state.transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      balances[t.account] = (balances[t.account] || 0) + amt;
      counts[t.account] = (counts[t.account] || 0) + 1;
    } else if (t.type === 'expense') {
      balances[t.account] = (balances[t.account] || 0) - amt;
      counts[t.account] = (counts[t.account] || 0) + 1;
    } else if (t.type === 'transfer') {
      balances[t.account] = (balances[t.account] || 0) - amt;
      balances[t.toAccount] = (balances[t.toAccount] || 0) + amt;
      counts[t.account] = (counts[t.account] || 0) + 1;
      counts[t.toAccount] = (counts[t.toAccount] || 0) + 1;
    }
  });

  let html = '';
  allWallets.forEach(w => {
    const bal = balances[w.id] || 0;
    const count = counts[w.id] || 0;
    const isCustomBank = !!w.isBank;
    html += `
      <div class="wallet-card" onclick="openAddModalForWallet('${escapeHtml(w.id)}')">
        <div class="wallet-left">
          <div class="wallet-icon">${mi(w.icon)}</div>
          <div class="wallet-info">
            <div class="wallet-title">
              <span>${escapeHtml(w.name)}</span>
              ${isCustomBank ? '<span class="bank-badge">Bank</span>' : ''}
            </div>
            <div class="wallet-count">${count} ${count === 1 ? 'transaction' : 'transactions'} • <span class="wallet-tap-hint">+ New Tx</span></div>
          </div>
        </div>
        <div class="wallet-right">
          <div class="wallet-balance">${formatCurrency(bal)}</div>
          <div class="wallet-actions">
            <button type="button" class="wallet-btn-icon" title="View Timeline" onclick="event.stopPropagation(); filterByWallet('${escapeHtml(w.id)}')">${mi('receipt_long')}</button>
            ${isCustomBank ? `<button type="button" class="wallet-btn-icon delete" title="Remove Bank" onclick="event.stopPropagation(); promptDeleteBank('${escapeHtml(w.id)}')">${mi('delete')}</button>` : ''}
          </div>
        </div>
      </div>
    `;
  });

  html += `
    <div class="add-wallet-card" onclick="openAddBankDialog()">
      <div class="add-wallet-icon">${mi('add')}</div>
      <div>
        <div class="add-wallet-title">Add Bank Account</div>
        <div class="add-wallet-desc">Track a bank as a separate wallet</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderFilterChips() {
  const row = document.getElementById('typeFilterRow');
  if (!row) return;

  const baseFilters = [
    { id: 'all', label: 'All' },
    { id: 'expense', label: 'Expenses' },
    { id: 'income', label: 'Income' },
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
    html += `<div class="pill-chip ${isActive}" data-filter="${escapeHtml(f.id)}">${escapeHtml(f.label)}</div>`;
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
