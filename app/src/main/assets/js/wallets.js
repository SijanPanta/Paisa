function resolveWalletId(account) {
  const name = (account || '').toLowerCase();
  const wallet = getAllWallets().find(w => w.id.toLowerCase() === name || w.name.toLowerCase() === name);
  return wallet ? wallet.id : account;
}

function isBankWallet(account) {
  if (!account) return false;
  const id = resolveWalletId(account);
  // Custom wallets are banks. Keep removed banks' transaction history in this group too.
  return id === 'Bank' || !DEFAULT_WALLETS.some(w => w.id === id);
}

function getWalletSummary() {
  const balances = Object.create(null);
  const counts = Object.create(null);
  const aliases = new Map();
  getAllWallets().forEach(w => {
    balances[w.id] = 0;
    counts[w.id] = 0;
    aliases.set(w.id.toLowerCase(), w.id);
    aliases.set(w.name.toLowerCase(), w.id);
  });
  const defaults = new Set(DEFAULT_WALLETS.map(w => w.id));
  const resolve = account => aliases.get((account || '').toLowerCase()) || account;
  const isBank = account => {
    const id = resolve(account);
    return !!id && (id === 'Bank' || !defaults.has(id));
  };
  let bankTransactionCount = 0;
  const add = (account, amount) => {
    if (!account) return;
    const id = resolve(account);
    balances[id] = (balances[id] || 0) + amount;
    counts[id] = (counts[id] || 0) + 1;
  };
  state.transactions.forEach(t => {
    const amount = Number(t.amount) || 0;
    if (t.type === 'income') add(t.account, amount);
    else if (t.type === 'expense') add(t.account, -amount);
    else if (t.type === 'transfer') {
      add(t.account, -amount);
      add(t.toAccount, amount);
    } else return;
    if (isBank(t.account) || (t.type === 'transfer' && isBank(t.toAccount))) {
      bankTransactionCount++;
    }
  });
  const bankBalance = Object.entries(balances).reduce((total, [id, balance]) =>
    total + (isBank(id) ? balance : 0), 0);
  return { balances, counts, bankBalance, bankTransactionCount };
}

function walletCard(wallet, balance, count, group = false) {
  const action = group ? 'openBankAccounts()' : wallet.isArchived
    ? 'filterByWallet(this.dataset.wallet)' : 'openAddModalForWallet(this.dataset.wallet)';
  const hint = group ? 'View banks' : wallet.isArchived ? 'View history' : '+ New Tx';
  const badge = wallet.isArchived ? 'History' : wallet.isBank ? 'Bank' : '';
  return `
    <div class="wallet-card" data-wallet="${escapeHtml(wallet.id)}" onclick="${action}" role="button" tabindex="0" onkeydown="activateWalletCard(event)">
      <div class="wallet-left">
        <div class="wallet-icon">${mi(wallet.icon)}</div>
        <div class="wallet-info">
          <div class="wallet-title">
            <span>${escapeHtml(wallet.name)}</span>
            ${badge ? `<span class="bank-badge">${badge}</span>` : ''}
          </div>
          <div class="wallet-count">${count} ${count === 1 ? 'transaction' : 'transactions'} · <span class="wallet-tap-hint">${hint}</span></div>
        </div>
      </div>
      <div class="wallet-right">
        <div class="wallet-balance">${formatCurrency(balance)}</div>
        <div class="wallet-actions">
          <button type="button" class="wallet-btn-icon" data-wallet="${escapeHtml(wallet.id)}" title="View Timeline" aria-label="View timeline" onclick="event.stopPropagation(); filterByWallet(this.dataset.wallet)">${mi('receipt_long')}</button>
          ${wallet.isBank || wallet.isArchived ? `<button type="button" class="wallet-btn-icon delete" data-wallet="${escapeHtml(wallet.id)}" title="Delete Bank" aria-label="Delete bank and transactions" onclick="event.stopPropagation(); promptDeleteBank(this.dataset.wallet)">${mi('delete')}</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

function activateWalletCard(event) {
  if (event.target !== event.currentTarget) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.currentTarget.click();
  }
}

function renderWallets() {
  const summary = getWalletSummary();
  document.getElementById('walletsContainer').innerHTML = DEFAULT_WALLETS.map(wallet => {
    const group = wallet.id === 'Bank';
    return walletCard(wallet, group ? summary.bankBalance : summary.balances[wallet.id],
      group ? summary.bankTransactionCount : summary.counts[wallet.id], group);
  }).join('');
  renderBankAccounts(summary);
}

function renderBankAccounts(summary = getWalletSummary()) {
  const banks = getAllWallets().filter(w => w.isBank);
  const knownIds = new Set(getAllWallets().map(w => w.id));
  const historicalBanks = Object.keys(summary.balances)
    .filter(id => !knownIds.has(id) && isBankWallet(id))
    .map(id => ({ id, name: id, icon: 'account_balance', isArchived: true }));
  const general = { id: 'Bank', name: 'General bank balance', icon: 'account_balance' };
  const entries = [...banks];
  if (summary.counts.Bank || banks.length === 0) entries.push(general);
  entries.push(...historicalBanks);

  document.getElementById('bankTotalBalance').textContent = formatCurrency(summary.bankBalance);
  document.getElementById('bankAccountsCount').textContent = `${banks.length} ${banks.length === 1 ? 'bank' : 'banks'} · ${summary.bankTransactionCount} ${summary.bankTransactionCount === 1 ? 'transaction' : 'transactions'}`;
  document.getElementById('bankAccountsContainer').innerHTML = entries.map(wallet =>
    walletCard(wallet, summary.balances[wallet.id] || 0, summary.counts[wallet.id] || 0)).join('');
  document.getElementById('bankAccountsEmpty').style.display = banks.length === 0 ? 'block' : 'none';
}

function openBankAccounts() {
  switchTab('viewWallets');
  renderBankAccounts();
  document.getElementById('walletsOverview').style.display = 'none';
  const panel = document.getElementById('bankAccountsPanel');
  panel.style.display = 'block';
  panel.classList.add('open');
  document.getElementById('pageTitle').textContent = 'Bank Account';
}

function closeBankAccounts(vibrate = true) {
  if (vibrate) nativeVibrate(15);
  document.getElementById('bankAccountsPanel').classList.remove('open');
  document.getElementById('bankAccountsPanel').style.display = 'none';
  document.getElementById('walletsOverview').style.display = 'block';
  document.getElementById('pageTitle').textContent = 'Wallets';
}
