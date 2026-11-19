'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function activate(app, element) {
  const handler = app.evaluate(`(function(event) { ${element.getAttribute('onclick')} })`);
  handler.call(element, {});
}

test('loan transactions are hidden from the main timeline behind a redirect', () => {
  const app = createApp();
  app.state.loans.push({
    id: 'loan1', direction: 'receive', amount: 500, person: 'Sita',
    date: '2026-01-15', status: 'approved', txId: 'txloan'
  });
  app.state.transactions.push({
    id: 'txloan', type: 'income', amount: 500, loanId: 'loan1',
    categoryId: 'loan_receive', categoryName: 'Loan Received',
    account: 'Cash', date: '2026-01-15'
  });
  app.state.transactions.push({
    id: 'tx1', type: 'expense', amount: 100, note: 'Lunch',
    account: 'Cash', date: '2026-01-14', categoryId: 'food', categoryName: 'Food & Dining'
  });
  app.start();

  const list = app.element('txListContainer');
  assert.equal(list.querySelectorAll('.tx-row').length, 1);
  assert.match(list.textContent, /Lunch/);
  assert.doesNotMatch(list.textContent, /Loan Received/);
  assert.match(list.textContent, /Friend loans are tracked separately/);
  assert.equal(app.element('netBalanceVal').textContent, '400');
  assert.equal(list.querySelectorAll('.tx-amount.expense').length, 1);

  activate(app, list.querySelector('.tx-loan-redirect'));
  assert.equal(app.element('viewLoans').classList.contains('active'), true);
});

test('timeline history shows 20 transactions at a time and resets on filter changes', () => {
  const app = createApp();
  app.state.transactions = Array.from({ length: 25 }, (_, index) => ({
    id: `tx${index}`, type: 'expense', amount: index + 1,
    note: `Item ${index}`, account: 'Cash', date: '2026-01-15',
    categoryId: 'food', categoryName: 'Food & Dining'
  }));
  app.start();

  let list = app.element('txListContainer');
  assert.equal(list.querySelectorAll('.tx-row').length, 20);
  assert.match(list.textContent, /5 left/);

  activate(app, list.querySelector('.show-more-btn'));
  list = app.element('txListContainer');
  assert.equal(list.querySelectorAll('.tx-row').length, 25);
  assert.equal(list.querySelector('.show-more-btn'), null);

  app.state.activeFilter = 'income';
  app.call('render');
  assert.equal(app.element('txListContainer').querySelectorAll('.tx-row').length, 0);
  app.state.activeFilter = 'all';
  app.call('render');
  assert.equal(app.element('txListContainer').querySelectorAll('.tx-row').length, 20);
});

test('free-transfer expenses reduce wallets but are excluded from spending and budget', () => {
  const app = createApp();
  const today = new Date().toISOString().split('T')[0];
  app.state.settings.budget = 1500;
  app.state.transactions.push(
    { id: 'inc', type: 'income', amount: 2000, note: 'Salary', account: 'Cash', date: today, categoryId: 'salary', categoryName: 'Salary' },
    { id: 'rent', type: 'expense', amount: 1000, note: 'Rent', account: 'Cash', date: today, categoryId: 'rent', categoryName: 'Rent & Housing' },
    { id: 'fix', type: 'expense', amount: 250, note: 'Error correction', account: 'Cash', date: today, categoryId: 'free_transfer', categoryName: 'Free Transfer' }
  );
  app.start();

  assert.equal(app.element('netBalanceVal').textContent, '750');
  assert.equal(app.element('totalExpenseVal').textContent, 'Rs. 1,000');
  assert.equal(app.element('budgetRemainingVal').textContent, 'Rs. 500 left');
  assert.doesNotMatch(app.element('analyticsCatBreakdown').textContent, /Free Transfer/);
  assert.equal(app.call('getWalletSummary').balances.Cash, 750);

  app.call('openAddModal', 'expense');
  assert.match(app.element('catGrid').innerHTML, /selectCategory\('free_transfer'\)/);
});
