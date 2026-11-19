'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function bankApp() {
  const app = createApp();
  app.state.bankAccounts = [
    { id: 'nabil', name: 'Nabil Bank', isBank: true },
    { id: 'nic', name: 'NIC Asia', isBank: true }
  ];
  app.state.transactions = [
    { id: 'cash', type: 'income', account: 'Cash', amount: 1000 },
    { id: 'salary', type: 'income', account: 'Nabil Bank', amount: 1000 },
    { id: 'expense', type: 'expense', account: 'nabil', amount: 100 },
    { id: 'deposit', type: 'transfer', account: 'Cash', toAccount: 'nabil', amount: 200 },
    { id: 'internal', type: 'transfer', account: 'nabil', toAccount: 'nic', amount: 300 },
    { id: 'income', type: 'income', account: 'nic', amount: 500 },
    { id: 'fee', type: 'expense', account: 'nic', amount: 50 },
    { id: 'general', type: 'income', account: 'Bank', amount: 75 },
    { id: 'withdrawal', type: 'transfer', account: 'nabil', toAccount: 'Cash', amount: 25 }
  ].map(t => ({ date: '2026-01-15', ...t }));
  app.start();
  return app;
}

function card(app, container, id) {
  return app.element(container).querySelectorAll('.wallet-card').find(el => el.dataset.wallet === id);
}

function activate(app, element) {
  const handler = app.evaluate(`(function(event) { ${element.getAttribute('onclick')} })`);
  handler.call(element, { stopPropagation() {} });
}

test('main wallets show one combined Bank Account, not individual banks or bank management', () => {
  const app = bankApp();
  const cards = app.element('walletsContainer').querySelectorAll('.wallet-card');
  assert.deepEqual(cards.map(el => el.dataset.wallet), ['Cash', 'eSewa', 'Khalti', 'Bank', 'ConnectIPS', 'Savings']);
  assert.equal(card(app, 'walletsContainer', 'Bank').querySelector('.wallet-balance').textContent, 'Rs. 1,600');
  assert.match(card(app, 'walletsContainer', 'Bank').textContent, /8 transactions/);
  assert.doesNotMatch(app.element('walletsOverview').textContent, /Nabil Bank|NIC Asia|Add Bank/);
  assert.equal(app.element('addBankBtn').parentElement.parentElement.id, 'bankAccountsPanel');
  activate(app, card(app, 'walletsContainer', 'Bank'));
  assert.equal(app.element('bankAccountsPanel').style.display, 'block');
  assert.equal(app.element('walletsOverview').style.display, 'none');
  assert.equal(app.element('bankTotalBalance').textContent, 'Rs. 1,600');
  assert.equal(card(app, 'bankAccountsContainer', 'nabil').querySelector('.wallet-balance').textContent, 'Rs. 775');
  assert.equal(card(app, 'bankAccountsContainer', 'nic').querySelector('.wallet-balance').textContent, 'Rs. 750');
  assert.equal(card(app, 'bankAccountsContainer', 'Bank').querySelector('.wallet-balance').textContent, 'Rs. 75');
});

test('bank timelines include legacy account names as well as current IDs', () => {
  const app = bankApp();
  app.call('filterByWallet', 'nabil');
  let rows = app.element('txListContainer').querySelectorAll('.tx-row');
  assert.equal(rows.length, 5);
  assert.ok(rows.some(row => row.getAttribute('onclick').includes("'salary'")));
  app.call('filterByWallet', 'Bank');
  rows = app.element('txListContainer').querySelectorAll('.tx-row');
  assert.equal(rows.length, 8);
});

test('internal bank transfers net to zero, count once and support negative balances', () => {
  const app = bankApp();
  const before = app.call('getWalletSummary');
  app.state.transactions.push({ type: 'transfer', account: 'nic', toAccount: 'nabil', amount: 1000 });
  const after = app.call('getWalletSummary');
  assert.equal(after.bankBalance, before.bankBalance);
  assert.equal(after.bankTransactionCount, before.bankTransactionCount + 1);
  assert.equal(after.balances.nic, -250);
  assert.equal(after.balances.nabil, 1775);
});

test('bank creation/deletion refreshes the nested list and deletes its money and history', () => {
  const app = bankApp();
  app.call('openBankAccounts');
  app.element('addBankBtn').click();
  assert.equal(app.element('addBankDialog').classList.contains('show'), true);
  app.element('bankNameInput').value = "O'Bank & Co";
  app.element('saveBankBtn').click();
  assert.equal(app.element('bankAccountsPanel').classList.contains('open'), true);
  const added = card(app, 'bankAccountsContainer', "O'Bank & Co");
  assert.ok(added);
  activate(app, added);
  assert.equal(app.element('txAccountSelect').value, "O'Bank & Co");
  app.call('closeModal');
  app.call('promptDeleteBank', 'nic');
  app.element('confirmDeleteBankBtn').click();
  assert.equal(app.state.bankAccounts.some(b => b.id === 'nic'), false);
  assert.equal(app.state.transactions.some(tx => tx.account === 'nic' || tx.toAccount === 'nic'), false);
  assert.equal(app.state.transactions.length, 6);
  assert.equal(app.element('bankTotalBalance').textContent, 'Rs. 1,150');
  assert.equal(card(app, 'bankAccountsContainer', 'nic'), undefined);
});

test('empty Bank Account keeps the legacy general wallet and supports back navigation and bank timeline', () => {
  const app = createApp();
  app.start();
  app.call('openBankAccounts');
  assert.equal(app.element('bankTotalBalance').textContent, 'Rs. 0');
  assert.equal(app.element('bankAccountsEmpty').style.display, 'block');
  assert.ok(card(app, 'bankAccountsContainer', 'Bank'));
  app.element('addBankBtn').click();
  assert.equal(app.call('handleAndroidBack'), true);
  assert.equal(app.element('bankAccountsPanel').classList.contains('open'), true);
  assert.equal(app.call('handleAndroidBack'), true);
  assert.equal(app.element('walletsOverview').style.display, 'block');
  app.call('openBankAccounts');
  app.element('bankTimelineBtn').click();
  assert.equal(app.state.activeFilter, 'bank');
  assert.equal(app.element('viewHome').classList.contains('active'), true);
  assert.equal(app.element('bankAccountsPanel').classList.contains('open'), false);
});

test('themed wallet picker selects source/destination accounts and keeps existing transfer validation', () => {
  const app = bankApp();
  app.call('openAddModal', 'transfer');
  app.element('txAccountPickerBtn').click();
  assert.equal(app.element('accountPickerTitle').textContent, 'From Account');
  assert.equal(app.element('accountPickerDialog').classList.contains('show'), true);
  let option = app.element('accountPickerOptions').querySelectorAll('.account-option').find(el => el.dataset.wallet === 'nabil');
  activate(app, option);
  assert.equal(app.element('txAccountSelect').value, 'nabil');
  assert.match(app.element('txAccountPickerBtn').textContent, /Nabil Bank/);
  assert.equal(app.element('accountPickerDialog').classList.contains('show'), false);
  app.element('txToAccountPickerBtn').click();
  assert.equal(app.element('accountPickerTitle').textContent, 'To Account');
  app.call('selectWalletAccount', 'nabil');
  app.element('txAmountInput').value = '100';
  const count = app.state.transactions.length;
  app.call('saveTransaction');
  assert.equal(app.state.transactions.length, count);
  assert.match(app.calls.alerts.at(-1), /must be different/);
  app.element('txToAccountPickerBtn').click();
  app.call('selectWalletAccount', 'nic');
  app.call('saveTransaction');
  assert.equal(app.state.transactions[0].account, 'nabil');
  assert.equal(app.state.transactions[0].toAccount, 'nic');
});

test('picker cancellation, back and invalid selections leave the editor and selected account intact', () => {
  const app = bankApp();
  app.call('openAddModal');
  app.element('txAccountPickerBtn').click();
  assert.equal(app.call('handleAndroidBack'), true);
  assert.equal(app.element('accountPickerDialog').classList.contains('show'), false);
  assert.equal(app.element('txModal').classList.contains('show'), true);
  assert.equal(app.element('txAccountSelect').value, 'Cash');
  app.element('txAccountPickerBtn').click();
  app.call('selectWalletAccount', 'missing');
  assert.equal(app.element('txAccountSelect').value, 'Cash');
  app.element('cancelAccountPickerBtn').click();
  assert.equal(app.element('accountPickerDialog').classList.contains('show'), false);
  app.element('txAccountPickerBtn').click();
  app.element('accountPickerDialog').click();
  app.call('selectWalletAccount', 'nic');
  assert.equal(app.element('accountPickerDialog').classList.contains('show'), false);
  assert.equal(app.element('txAccountSelect').value, 'Cash');
});

test('bank deletion matches legacy names and IDs, clears stale selections, and persists the cascade', () => {
  const app = bankApp();
  app.state.transactions.push({ id: 'mixed-case', type: 'expense', account: 'NABIL', amount: 25 });
  app.state.activeFilter = 'nabil';
  app.call('openEditModal', 'salary');
  app.call('viewTransaction', 'salary');
  app.call('promptDeleteBank', 'nabil');
  assert.match(app.element('deleteBankDesc').textContent, /Other wallet balances may change/);
  app.call('confirmDeleteBank');
  assert.deepEqual(Array.from(app.state.transactions, tx => tx.id), ['cash', 'income', 'fee', 'general']);
  assert.equal(app.state.activeFilter, 'all');
  assert.equal(app.state.editingTxId, null);
  assert.equal(app.state.viewingTxId, null);
  assert.equal(app.element('txModal').classList.contains('show'), false);
  assert.equal(app.element('txDetailModal').classList.contains('show'), false);
  const summary = app.call('getWalletSummary');
  assert.equal(summary.bankBalance, 525);
  assert.equal(summary.balances.Cash, 1000, 'both sides of removed transfers are recalculated');
  assert.equal(summary.balances.nic, 450);
  const reloaded = createApp({ storage: Object.fromEntries(app.storage) });
  reloaded.start();
  assert.equal(reloaded.state.transactions.length, 4);
  assert.equal(reloaded.state.bankAccounts.some(bank => bank.id === 'nabil'), false);
  assert.equal(card(reloaded, 'bankAccountsContainer', 'nabil'), undefined);
});

test('cancelling bank deletion by button, backdrop or hardware back never removes anything', () => {
  const app = bankApp();
  const before = JSON.stringify(app.state);
  for (const dismiss of [
    () => app.element('cancelDeleteBankBtn').click(),
    () => app.element('deleteBankDialog').click(),
    () => app.call('handleAndroidBack')
  ]) {
    app.call('promptDeleteBank', 'nic');
    dismiss();
    app.call('confirmDeleteBank');
    assert.equal(JSON.stringify(app.state), before);
  }
});

test('historical banks from earlier deletions can also have their remaining history deleted', () => {
  const app = createApp();
  app.state.transactions = [
    { id: 'old', type: 'income', account: 'Closed Bank', amount: 300, date: '2026-01-15' },
    { id: 'keep', type: 'income', account: 'Cash', amount: 20, date: '2026-01-15' }
  ];
  app.start();
  assert.ok(card(app, 'bankAccountsContainer', 'Closed Bank').querySelector('.delete'));
  app.call('promptDeleteBank', 'Closed Bank');
  app.call('confirmDeleteBank');
  assert.deepEqual(Array.from(app.state.transactions, tx => tx.id), ['keep']);
  assert.equal(app.call('getWalletSummary').bankBalance, 0);
  assert.equal(card(app, 'bankAccountsContainer', 'Closed Bank'), undefined);
});

test('editing transactions from removed banks retains their source and themed picker label', () => {
  const app = bankApp();
  app.state.bankAccounts = [];
  app.call('openEditModal', 'fee');
  assert.equal(app.element('txAccountSelect').value, 'nic');
  assert.match(app.element('txAccountPickerBtn').textContent, /nic/);
  app.element('txAccountPickerBtn').click();
  const selected = app.element('accountPickerOptions').querySelector('.account-option.selected');
  assert.equal(selected.dataset.wallet, 'nic');
  app.call('closeAccountPicker');
  app.call('saveTransaction');
  assert.equal(app.state.transactions.find(t => t.id === 'fee').account, 'nic');
});
