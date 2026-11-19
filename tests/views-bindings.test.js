'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function seededApp() {
  const app = createApp();
  app.state.bankAccounts.push({ id: 'bank-one', name: 'Nabil' });
  app.state.transactions = [
    { id: 'cash-income', type: 'income', amount: 1000, account: 'Cash', date: '2026-01-15', note: 'Payday', categoryName: 'Salary' },
    { id: 'bank-expense', type: 'expense', amount: 100, account: 'bank-one', date: '2026-01-14', note: 'Lunch', categoryName: 'Food' },
    { id: 'bank-transfer', type: 'transfer', amount: 250, account: 'Cash', toAccount: 'bank-one', date: '2026-01-13', note: 'Deposit' },
    { id: 'generic-bank', type: 'expense', amount: 50, account: 'Bank', date: '2026-01-12', note: 'Fees', categoryName: 'Other' }
  ];
  return app;
}

function visibleIds(app) {
  return app.element('txListContainer').querySelectorAll('.tx-row').map(row =>
    row.getAttribute('onclick').match(/viewTransaction\('([^']+)'\)/)[1]);
}

test('timeline filters match types, both transfer accounts, and generic/custom banks; search composes', () => {
  const app = seededApp();
  for (const [filter, expected] of [
    ['all', ['cash-income', 'bank-expense', 'bank-transfer', 'generic-bank']],
    ['expense', ['bank-expense', 'generic-bank']],
    ['income', ['cash-income']],
    ['cash', ['cash-income', 'bank-transfer']],
    ['bank', ['bank-expense', 'bank-transfer', 'generic-bank']],
    ['bank-one', ['bank-expense', 'bank-transfer']]
  ]) {
    app.state.activeFilter = filter;
    app.call('renderTransactions');
    assert.deepEqual(visibleIds(app), expected, filter);
  }
  app.state.searchQuery = 'dEpOsIt';
  app.call('renderTransactions');
  assert.deepEqual(visibleIds(app), ['bank-transfer']);
  app.state.activeFilter = 'all';
  app.state.searchQuery = 'sALary';
  app.call('renderTransactions');
  assert.deepEqual(visibleIds(app), ['cash-income']);
  app.state.searchQuery = 'no results';
  app.call('renderTransactions');
  assert.match(app.element('txListContainer').textContent, /No transactions found/);
});

test('search ignores surrounding whitespace and preserves spaces between words', () => {
  const app = seededApp();
  app.state.transactions[0].note = 'Monthly salary';
  for (const query of ['  Monthly salary', 'Monthly salary  ', '\t Monthly salary \n']) {
    app.state.searchQuery = query;
    app.call('renderTransactions');
    assert.deepEqual(visibleIds(app), ['cash-income']);
  }
  app.state.searchQuery = 'Month lysalary';
  app.call('renderTransactions');
  assert.deepEqual(visibleIds(app), []);
  app.state.searchQuery = '  \t\n';
  app.call('renderTransactions');
  assert.equal(visibleIds(app).length, 4);
});

test('monthly budget excludes prior months and transfers and retains warning/over-budget states', () => {
  const app = createApp();
  const today = new Date();
  // Local noon avoids crossing a month boundary when the app parses the date.
  const date = new Date(today.getFullYear(), today.getMonth(), 15, 12).toISOString();
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 15, 12).toISOString();
  app.state.settings.budget = 100;
  app.state.transactions = [
    { type: 'expense', amount: 80, date, account: 'Cash' },
    { type: 'expense', amount: 500, date: previous, account: 'Cash' },
    { type: 'transfer', amount: 1000, date, account: 'Cash', toAccount: 'eSewa' }
  ];
  app.call('renderHeaderAndHero');
  assert.equal(app.element('budgetPercentVal').textContent, '80%');
  assert.equal(app.element('budgetRemainingVal').textContent, 'Rs. 20 left');
  assert.equal(app.element('budgetProgressBar').classList.contains('warning'), true);
  app.state.transactions[0].amount = 120;
  app.call('renderHeaderAndHero');
  assert.equal(app.element('budgetPercentVal').textContent, '100%');
  assert.equal(app.element('budgetRemainingVal').textContent, 'Rs. 20 over');
  assert.equal(app.element('budgetProgressBar').style.width, '100%');
  assert.equal(app.element('budgetProgressBar').classList.contains('danger'), true);
});

test('bank/budget/currency presets, Enter and backdrop dismissal are bound on startup', () => {
  const app = createApp();
  app.start();
  app.element('addBankBtn').click();
  const bankPreset = app.document.querySelector('#bankPresets .preset-chip');
  bankPreset.click();
  assert.equal(app.element('bankNameInput').value, bankPreset.dataset.bank);
  const enter = { type: 'keydown', key: 'Enter' };
  app.element('bankNameInput').dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, true);
  assert.equal(app.state.bankAccounts[0].name, bankPreset.dataset.bank);
  app.element('setCurrencyItem').click();
  const currency = app.document.querySelector('#currencyPresets .preset-chip');
  currency.click();
  app.element('saveCurrencyBtn').click();
  assert.equal(app.state.settings.currency, currency.dataset.curr);
  app.element('setBudgetItem').click();
  const budget = app.document.querySelector('#budgetPresets .preset-chip');
  budget.click();
  app.element('saveBudgetBtn').click();
  assert.equal(app.state.settings.budget, Number(budget.dataset.budget));
  app.element('setCurrencyItem').click();
  const dialog = app.element('currencyDialog');
  dialog.dispatchEvent({ type: 'click', target: app.element('customCurrencyInput') });
  assert.equal(dialog.classList.contains('show'), true, 'clicks inside dialog do not dismiss it');
  dialog.click();
  assert.equal(dialog.classList.contains('show'), false);
  app.element('quickTransferBtn').click();
  assert.equal(app.state.selectedType, 'transfer');
  app.element('txModal').click();
  assert.equal(app.element('txModal').classList.contains('show'), false);
});
