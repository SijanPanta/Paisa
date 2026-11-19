'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function fresh() {
  const app = createApp();
  app.start();
  return app;
}

function addExpense(app, amount = 100, note = 'Lunch') {
  app.call('openAddModal', 'expense');
  app.element('txAmountInput').value = String(amount);
  app.element('txNoteInput').value = note;
  app.call('saveTransaction');
  return app.state.transactions[0];
}

function addLoan(app, direction = 'pay', amount = 500) {
  app.call('openLoanModal', direction);
  app.element('loanAmountInput').value = String(amount);
  app.element('loanPersonInput').value = 'Ram';
  app.call('saveLoan');
  return app.state.loans[0];
}

function activate(app, element) {
  const handler = app.evaluate(`(function(event) { ${element.getAttribute('onclick')} })`);
  handler.call(element, {});
}

function confirmUndo(app) {
  assert.equal(app.element('undoConfirmDialog').classList.contains('show'), true);
  app.element('confirmUndoBtn').click();
  assert.equal(app.element('undoConfirmDialog').classList.contains('show'), false);
}

test('undo button appears after changes and restores the last added transaction', () => {
  const app = fresh();
  assert.equal(app.element('undoBtn').style.display, 'none');
  app.call('undoLastAction');
  assert.match(app.calls.alerts.at(-1), /Nothing to undo/);

  const tx = addExpense(app);
  assert.equal(app.element('undoBtn').style.display, 'flex');
  assert.equal(app.element('undoBtn').title, 'Undo: Add transaction');
  assert.equal(app.element('netBalanceVal').textContent, '-100');

  app.element('undoBtn').click();
  confirmUndo(app);
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.element('netBalanceVal').textContent, '0');
  assert.equal(app.element('undoBtn').style.display, 'none');
  assert.match(app.calls.alerts.at(-1), /Undone: Add transaction/);
  assert.equal(app.call('undoLastAction'), false);
  assert.equal(app.state.transactions.some(item => item.id === tx.id), false);
});

test('undo confirmation can be cancelled without changing data', () => {
  const app = fresh();
  addExpense(app);
  app.element('undoBtn').click();
  assert.equal(app.element('undoConfirmDialog').classList.contains('show'), true);
  assert.match(app.element('undoConfirmDesc').textContent, /Add transaction/);
  app.element('cancelUndoConfirmBtn').click();
  assert.equal(app.element('undoConfirmDialog').classList.contains('show'), false);
  assert.equal(app.state.transactions.length, 1);
  assert.equal(app.element('undoBtn').style.display, 'flex');
});

test('undo reverses edits, deletes and the two-sided effect of a transfer', () => {
  const app = createApp();
  app.state.transactions = [{
    id: 't1', type: 'expense', amount: 100, note: 'Old',
    date: '2026-01-15', account: 'Cash'
  }];
  app.start();

  app.call('openEditModal', 't1');
  app.element('txAmountInput').value = '250';
  app.call('saveTransaction');
  assert.equal(app.state.transactions[0].amount, 250);
  app.element('undoTxModalBtn').click();
  confirmUndo(app);
  assert.equal(app.state.transactions[0].amount, 100);
  assert.equal(app.element('txModal').classList.contains('show'), false);

  app.call('openEditModal', 't1');
  app.call('deleteTransaction');
  app.element('confirmDeleteTxBtn').click();
  assert.equal(app.state.transactions.length, 0);
  app.element('undoTxBtn').click();
  confirmUndo(app);
  assert.equal(app.state.transactions.length, 1);

  app.call('openAddModal', 'transfer');
  app.element('txAmountInput').value = '200';
  app.call('saveTransaction');
  assert.equal(app.call('getWalletSummary').balances.Cash, -300);
  assert.equal(app.call('getWalletSummary').balances.eSewa, 200);
  app.call('undoLastAction');
  assert.equal(app.call('getWalletSummary').balances.Cash, -100);
  assert.equal(app.call('getWalletSummary').balances.eSewa, 0);
});

test('approved loans can be undone from the balance sheet and the undo restores them', () => {
  const app = fresh();
  const loan = addLoan(app);
  app.call('approveLoan', loan.id);
  app.element('confirmApproveLoanBtn').click();
  assert.equal(app.element('netBalanceVal').textContent, '-500');
  assert.equal(app.call('isLoanApproved', loan), true);

  const row = app.element('loanApprovedList').querySelectorAll('.loan-card')[0];
  const undo = row.querySelectorAll('.loan-action.undo')[0];
  assert.ok(undo);
  assert.match(row.textContent, /Approved/);
  activate(app, undo);
  confirmUndo(app);

  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.call('isLoanApproved', loan), false);
  assert.equal(app.element('netBalanceVal').textContent, '0');
  assert.equal(app.element('loanPendingList').querySelectorAll('.loan-card').length, 1);
  assert.equal(app.element('undoBtn').title, 'Undo: Undo loan approval');

  app.element('undoBtn').click();
  confirmUndo(app);
  const restored = app.state.loans.find(item => item.id === loan.id);
  assert.equal(app.call('isLoanApproved', restored), true);
  assert.equal(app.state.transactions.length, 1);
  assert.equal(app.element('netBalanceVal').textContent, '-500');
});

test('undo restores deleted loans, cleared data and bank cascades', () => {
  const app = fresh();
  const loan = addLoan(app);
  app.call('promptDeleteLoan', loan.id);
  app.element('confirmDeleteLoanBtn').click();
  assert.equal(app.state.loans.length, 0);
  app.call('undoLastAction');
  assert.equal(app.state.loans[0].id, loan.id);

  addExpense(app);
  app.element('resetDataBtn').click();
  app.element('confirmResetBtn').click();
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.state.loans.length, 0);
  app.call('undoLastAction');
  assert.equal(app.state.transactions.length, 1);
  assert.equal(app.state.loans.length, 1);

  app.element('addBankBtn').click();
  app.element('bankNameInput').value = 'Nabil Bank';
  app.element('saveBankBtn').click();
  const bank = app.state.bankAccounts[0];
  app.call('promptDeleteBank', bank.id);
  app.element('confirmDeleteBankBtn').click();
  assert.equal(app.state.bankAccounts.length, 0);
  app.call('undoLastAction');
  assert.equal(app.state.bankAccounts.length, 1);
  assert.equal(app.state.bankAccounts[0].id, bank.id);
});

test('restoring backup clears undo history and undo is session-only', () => {
  const app = fresh();
  addLoan(app);
  assert.equal(app.evaluate('undoStack.length'), 1);

  const reloaded = createApp({ storage: Object.fromEntries(app.storage) });
  reloaded.start();
  assert.equal(reloaded.evaluate('undoStack.length'), 0);
  assert.equal(reloaded.element('undoBtn').style.display, 'none');

  addExpense(reloaded);
  assert.equal(reloaded.evaluate('undoStack.length'), 1);
  reloaded.restore(JSON.stringify({
    transactions: [],
    bankAccounts: [],
    loans: [],
    settings: reloaded.state.settings
  }));
  assert.equal(reloaded.evaluate('undoStack.length'), 0);
  assert.equal(reloaded.element('undoBtn').style.display, 'none');
});
