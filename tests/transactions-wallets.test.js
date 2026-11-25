'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function fill(app, values = {}) {
  for (const [id, value] of Object.entries({ txAmountInput: '125.50', txNoteInput: '  lunch  ', txDateInput: '2026-01-15', ...values })) {
    app.element(id).value = value;
  }
}

for (const type of ['expense', 'income', 'transfer']) {
  test(`${type}: add, view, edit and confirmed delete persist the same transaction identity`, () => {
    const app = createApp();
    app.call('openAddModal', type, 'Cash');
    fill(app);
    assert.equal(app.element('txModal').classList.contains('show'), true);
    assert.equal(app.element('toAccountGroup').style.display, type === 'transfer' ? 'block' : 'none');
    app.call('saveTransaction');
    const tx = app.state.transactions[0];
    const id = tx.id;
    const time = tx.time;
    assert.equal(tx.type, type);
    assert.equal(tx.amount, 125.5);
    assert.equal(tx.note, 'lunch');
    assert.equal(tx.account, 'Cash');
    assert.equal(tx.toAccount, type === 'transfer' ? 'eSewa' : null);
    assert.equal(tx.categoryId, type === 'income' ? 'salary' : type === 'expense' ? 'food' : null);
    assert.equal(app.element('txModal').classList.contains('show'), false);
    assert.equal(JSON.parse(app.storage.get('paisa_state')).transactions[0].id, id);

    app.call('viewTransaction', id);
    assert.equal(app.state.viewingTxId, id);
    assert.equal(app.element('txDetailModal').classList.contains('show'), true);
    assert.match(app.element('txDetailBody').textContent, /125.5/);
    assert.match(app.element('txDetailBody').textContent, new RegExp(type[0].toUpperCase() + type.slice(1)));
    app.call('closeDetailModal');
    app.call('openEditModal', id);
    assert.equal(app.state.editingTxId, id);
    assert.equal(app.element('txAmountInput').value, '125.5');
    assert.equal(app.element('deleteTxBtn').style.display, 'block');
    fill(app, { txAmountInput: '200', txNoteInput: '<script>note</script>' });
    app.call('saveTransaction');
    assert.equal(app.state.transactions.length, 1);
    assert.equal(app.state.transactions[0].id, id);
    assert.equal(app.state.transactions[0].time, time);
    assert.equal(app.state.transactions[0].amount, 200);
    app.call('viewTransaction', id);
    assert.match(app.element('txDetailBody').innerHTML, /&lt;script&gt;note&lt;\/script&gt;/);
    app.call('deleteTransaction');
    assert.equal(app.state.transactions.length, 1, 'delete requires confirmation');
    assert.equal(app.element('deleteTxDialog').classList.contains('show'), true);
    app.call('executeDeleteTransaction');
    assert.equal(app.state.transactions.length, 0);
    assert.equal(JSON.parse(app.storage.get('paisa_state')).transactions.length, 0);
    assert.equal(app.element('deleteTxDialog').classList.contains('show'), false);
  });
}

test('amount and same-wallet transfer validation do not mutate or persist state', () => {
  const app = createApp();
  app.call('openAddModal');
  for (const amount of ['', 'not a number', '0', '-1']) {
    fill(app, { txAmountInput: amount });
    app.call('saveTransaction');
    assert.equal(app.state.transactions.length, 0);
    assert.equal(app.storage.has('paisa_state'), false);
    assert.equal(app.calls.alerts.at(-1), 'Please enter a valid amount');
    assert.equal(app.element('txModal').classList.contains('show'), true);
  }
  app.call('openAddModal', 'transfer');
  fill(app);
  app.element('txToAccountSelect').value = 'Cash';
  app.call('saveTransaction');
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.calls.alerts.at(-1), 'From and To accounts must be different');
});

test('editing between expense, transfer and income clears stale category/destination data', () => {
  const app = createApp();
  app.call('openAddModal');
  fill(app);
  app.call('saveTransaction');
  const id = app.state.transactions[0].id;
  app.call('openEditModal', id);
  app.state.selectedType = 'transfer';
  app.call('saveTransaction');
  assert.equal(app.state.transactions[0].categoryId, null);
  assert.equal(app.state.transactions[0].categoryName, 'Transfer');
  assert.equal(app.state.transactions[0].toAccount, 'eSewa');
  app.call('openEditModal', id);
  app.state.selectedType = 'income';
  app.state.selectedCat = 'missing-category';
  app.call('saveTransaction');
  assert.equal(app.state.transactions[0].categoryId, 'salary');
  assert.equal(app.state.transactions[0].toAccount, null);
});

test('missing transaction IDs and delete without selection are harmless', () => {
  const app = createApp();
  for (const method of ['openEditModal', 'viewTransaction', 'deleteTransaction', 'executeDeleteTransaction']) {
    assert.doesNotThrow(() => app.call(method, 'missing'));
  }
  assert.equal(app.storage.size, 0);
  assert.equal(app.element('txModal').classList.contains('show'), false);
});

test('custom banks validate names, appear in wallets/selects/filters and delete with their history', () => {
  const app = createApp();
  assert.deepEqual(Array.from(app.call('getAllWallets'), wallet => wallet.id), ['Cash', 'eSewa', 'Khalti', 'Bank', 'Savings']);
  app.call('openAddBankDialog');
  for (const name of ['  ', 'cash', ' BANK ACCOUNT ']) {
    app.element('bankNameInput').value = name;
    app.call('saveNewBank');
    assert.equal(app.state.bankAccounts.length, 0);
  }
  app.element('bankNameInput').value = '  Nabil & Co  ';
  app.call('saveNewBank');
  assert.equal(app.state.bankAccounts[0].id, 'Nabil & Co');
  assert.equal(app.state.bankAccounts[0].isBank, true);
  assert.equal(app.call('getAllWallets').length, 6);
  assert.doesNotMatch(app.element('walletsContainer').innerHTML, /Nabil &amp; Co/);
  assert.match(app.element('bankAccountsContainer').innerHTML, /Nabil &amp; Co/);
  assert.ok(app.document.querySelector('#typeFilterRow .pill-chip[data-filter="nabil & co"]'));
  app.call('openAddModalForWallet', 'Nabil & Co');
  assert.equal(app.element('txAccountSelect').value, 'Nabil & Co');
  assert.notEqual(app.element('txToAccountSelect').value, 'Nabil & Co');
  fill(app);
  app.call('saveTransaction');
  app.element('bankNameInput').value = 'nAbIl & cO';
  app.call('saveNewBank');
  assert.equal(app.state.bankAccounts.length, 1);
  app.call('promptDeleteBank', 'Nabil & Co');
  app.call('closeDeleteBankDialog');
  app.call('confirmDeleteBank');
  assert.equal(app.state.bankAccounts.length, 1, 'cancel clears pending delete');
  app.call('promptDeleteBank', 'Nabil & Co');
  assert.match(app.element('deleteBankDesc').textContent, /all its transactions permanently/);
  app.call('confirmDeleteBank');
  assert.equal(app.state.bankAccounts.length, 0);
  assert.equal(app.state.transactions.length, 0);
  assert.equal(JSON.parse(app.storage.get('paisa_state')).transactions.length, 0);
});

test('transfers affect both wallet balances/counts, but not total income or expense', () => {
  const app = createApp();
  app.state.transactions = [
    { id: 'i', type: 'income', amount: 1000, account: 'Cash', date: '2026-01-15', categoryName: 'Salary' },
    { id: 'e', type: 'expense', amount: 100, account: 'Cash', date: '2026-01-15', categoryName: 'Food' },
    { id: 't', type: 'transfer', amount: 250, account: 'Cash', toAccount: 'eSewa', date: '2026-01-15' }
  ];
  app.call('render');
  assert.equal(app.element('netBalanceVal').textContent, '900');
  assert.equal(app.element('totalIncomeVal').textContent, 'Rs. 1,000');
  assert.equal(app.element('totalExpenseVal').textContent, 'Rs. 100');
  const cards = app.element('walletsContainer').querySelectorAll('.wallet-card');
  assert.equal(cards[0].querySelector('.wallet-balance').textContent, 'Rs. 650');
  assert.match(cards[0].querySelector('.wallet-count').textContent, /3 transactions/);
  assert.equal(cards[1].querySelector('.wallet-balance').textContent, 'Rs. 250');
  assert.equal(app.element('savingsRateVal').textContent, '90%');
});

test('transfers into Savings act as expense and reduce Net balance', () => {
  const app = createApp();
  app.state.transactions = [
    { id: 'i', type: 'income', amount: 1000, account: 'eSewa', date: '2026-01-15', categoryName: 'Salary' },
    { id: 't', type: 'transfer', amount: 300, account: 'eSewa', toAccount: 'Savings', date: '2026-01-15' }
  ];
  app.call('render');

  assert.equal(app.element('netBalanceVal').textContent, '700');
  assert.equal(app.element('totalIncomeVal').textContent, 'Rs. 1,000');
  assert.equal(app.element('totalExpenseVal').textContent, 'Rs. 300');
  assert.equal(app.element('savingsRateVal').textContent, '70%');
  assert.match(app.element('analyticsCatBreakdown').textContent, /Savings Transfer/);

  const summary = app.call('getWalletSummary');
  assert.equal(summary.balances.eSewa, 700);
  assert.equal(summary.balances.Savings, 300);
});

test('expense and income recorded in Savings do not change Net balance', () => {
  const app = createApp();
  app.state.transactions = [
    { id: 'i', type: 'income', amount: 1000, account: 'Cash', date: '2026-01-15', categoryName: 'Salary' },
    { id: 'e', type: 'expense', amount: 200, account: 'Savings', date: '2026-01-15', categoryName: 'Food' },
    { id: 's', type: 'income', amount: 100, account: 'Savings', date: '2026-01-15', categoryName: 'Interest' }
  ];
  app.call('render');

  assert.equal(app.element('netBalanceVal').textContent, '1,000');
  assert.equal(app.element('totalIncomeVal').textContent, 'Rs. 1,000');
  assert.equal(app.element('totalExpenseVal').textContent, 'Rs. 0');

  const summary = app.call('getWalletSummary');
  assert.equal(summary.balances.Cash, 1000);
  assert.equal(summary.balances.Savings, -100);
});
