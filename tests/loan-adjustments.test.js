'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function loanApp() {
  const app = createApp();
  app.start();
  return app;
}

function addLoan(app, options = {}) {
  const { direction = 'pay', amount = 500, person = 'Ram', date = '2026-01-15', note = '' } = options;
  app.call('openLoanModal', direction);
  app.element('loanAmountInput').value = String(amount);
  app.element('loanPersonInput').value = person;
  app.element('loanNoteInput').value = note;
  app.element('loanDateInput').value = date;
  app.call('saveLoan');
  return app.state.loans[0];
}

function activate(app, element) {
  const handler = app.evaluate(`(function(event) { ${element.getAttribute('onclick')} })`);
  handler.call(element, { target: { tagName: element.tagName } });
}

const bodyText = app => app.element('loanDetailBody').textContent;

test('clicking a loan opens its timeline and a repayment reduces the outstanding balance only', () => {
  const app = loanApp();
  const loan = addLoan(app, { direction: 'receive', amount: 500, person: 'Sita' });
  app.call('approveLoan', loan.id);
  app.element('confirmApproveLoanBtn').click();
  assert.equal(app.element('netBalanceVal').textContent, '500');

  const card = app.element('loanApprovedList').querySelector('.loan-card');
  activate(app, card);
  assert.equal(app.element('loanDetailModal').classList.contains('show'), true);
  assert.match(bodyText(app), /Loan timeline/);
  assert.match(bodyText(app), /To Receive recorded/);
  assert.match(bodyText(app), /Approved into Net Balance/);

  app.element('loanDetailReduceBtn').click();
  assert.equal(app.element('loanAdjustDialog').classList.contains('show'), true);
  app.element('loanAdjustAmountInput').value = '200';
  app.element('loanAdjustNoteInput').value = 'Partial repayment';
  app.element('loanAdjustConfirmBtn').click();

  assert.equal(app.state.loans[0].amount, 300);
  assert.equal(app.state.loans[0].originalAmount, 500);
  assert.equal(app.state.loans[0].adjustments.length, 1);
  assert.equal(app.state.loans[0].adjustments[0].delta, -200);
  assert.equal(app.state.transactions.length, 1);
  assert.equal(app.element('netBalanceVal').textContent, '500');
  assert.equal(app.element('loanAdjustDialog').classList.contains('show'), false);
  assert.match(bodyText(app), /Money reduced/);
  assert.match(bodyText(app), /Partial repayment/);
  assert.match(bodyText(app), /Rs\. 200/);
  assert.match(app.element('loanPayTotal').textContent, /Rs\. 0/);
  assert.match(app.element('loanReceiveTotal').textContent, /Rs\. 300/);
});

test('add money from the edit sheet validates input, refuses negative balances and supports undo', () => {
  const app = loanApp();
  const loan = addLoan(app, { amount: 500 });
  app.call('editLoan', loan.id);
  assert.equal(app.element('loanAddMoneyBtn').style.display, 'flex');
  assert.equal(app.element('loanAdjustHint').style.display, 'none');

  app.element('loanAddMoneyBtn').click();
  app.element('loanAdjustAmountInput').value = '0';
  app.element('loanAdjustConfirmBtn').click();
  assert.match(app.calls.alerts.at(-1), /greater than zero/);
  assert.equal(app.state.loans[0].adjustments.length, 0);

  app.element('loanReduceMoneyBtn').click();
  app.element('loanAdjustAmountInput').value = '1500';
  app.element('loanAdjustConfirmBtn').click();
  assert.match(app.calls.alerts.at(-1), /below zero/);
  assert.equal(app.state.loans[0].amount, 500);

  app.element('loanAddMoneyBtn').click();
  app.element('loanAdjustAmountInput').value = '100';
  app.element('loanAdjustNoteInput').value = 'Extra borrowed';
  app.element('loanAdjustConfirmBtn').click();
  assert.equal(app.state.loans[0].amount, 600);
  assert.equal(app.state.loans[0].adjustments[0].delta, 100);
  assert.equal(app.element('undoBtn').title, 'Undo: Add loan money');

  app.element('undoBtn').click();
  app.element('confirmUndoBtn').click();
  assert.equal(app.state.loans[0].amount, 500);
  assert.equal(app.state.loans[0].adjustments.length, 0);
});

test('saving after an edit-sheet adjustment does not reverse it or change the approved transaction', () => {
  const app = loanApp();
  const loan = addLoan(app, { direction: 'receive', amount: 500, person: 'Sita' });
  app.call('approveLoan', loan.id);
  app.element('confirmApproveLoanBtn').click();
  assert.equal(app.state.transactions[0].amount, 500);

  app.call('editLoan', loan.id);
  app.element('loanAddMoneyBtn').click();
  app.element('loanAdjustAmountInput').value = '200';
  app.element('loanAdjustNoteInput').value = 'Part payment';
  app.element('loanAdjustConfirmBtn').click();
  assert.equal(app.element('loanAmountInput').value, '700');
  assert.equal(app.state.loans[0].amount, 700);

  app.element('saveLoanBtn').click();
  assert.equal(app.state.loans[0].amount, 700);
  assert.equal(app.state.loans[0].adjustments.length, 1);
  assert.equal(app.state.loans[0].adjustments[0].delta, 200);
  assert.equal(app.state.transactions[0].amount, 500);
  assert.equal(app.element('netBalanceVal').textContent, '500');
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 700');
});

test('loan adjustments survive reload and backup restore and clear with all data', () => {
  const app = loanApp();
  const loan = addLoan(app, { amount: 500 });
  app.call('viewLoan', loan.id);
  app.element('loanDetailReduceBtn').click();
  app.element('loanAdjustAmountInput').value = '200';
  app.element('loanAdjustConfirmBtn').click();
  assert.equal(app.state.loans[0].amount, 300);

  const reloaded = createApp({ storage: Object.fromEntries(app.storage) });
  reloaded.start();
  assert.equal(reloaded.state.loans[0].amount, 300);
  assert.equal(reloaded.state.loans[0].adjustments[0].delta, -200);

  const restored = loanApp();
  restored.restore(JSON.stringify(app.state));
  assert.equal(restored.state.loans[0].amount, 300);
  assert.equal(restored.state.loans[0].adjustments.length, 1);

  restored.call('openResetDialog');
  restored.element('confirmResetBtn').click();
  assert.equal(restored.state.loans.length, 0);
});

test('legacy loans gain an original amount and manual edits are recorded in the timeline', () => {
  const app = loanApp();
  app.state.loans.push({
    id: 'legacy', direction: 'pay', amount: 400, person: 'Old Friend',
    date: '2026-01-01', status: 'pending', txId: null
  });
  app.call('render');
  assert.equal(app.call('loanOriginalAmount', app.state.loans[0]), 400);

  app.call('editLoan', 'legacy');
  app.element('loanAmountInput').value = '350';
  app.call('saveLoan');
  const loan = app.state.loans[0];
  assert.equal(loan.originalAmount, 400);
  assert.equal(loan.amount, 350);
  assert.equal(loan.adjustments.length, 1);
  assert.equal(loan.adjustments[0].delta, -50);
  assert.equal(loan.adjustments[0].note, 'Amount edited');

  app.call('viewLoan', loan.id);
  assert.match(bodyText(app), /Money reduced/);
  assert.match(bodyText(app), /Amount edited/);
});

test('loan detail edit, approval and delete actions work and hardware back closes the sheet', () => {
  const app = loanApp();
  const loan = addLoan(app, { amount: 500 });
  app.call('viewLoan', loan.id);

  app.element('editLoanFromDetailBtn').click();
  assert.equal(app.element('loanModal').classList.contains('show'), true);
  assert.equal(app.element('loanDetailModal').classList.contains('show'), false);

  app.call('viewLoan', loan.id);
  app.element('toggleLoanApprovalBtn').click();
  app.element('confirmApproveLoanBtn').click();
  assert.equal(app.state.loans[0].status, 'approved');
  assert.match(app.element('toggleLoanApprovalBtn').textContent, /Undo approve/);

  app.element('toggleLoanApprovalBtn').click();
  app.element('confirmUndoBtn').click();
  assert.equal(app.state.loans[0].status, 'pending');

  app.element('deleteLoanFromDetailBtn').click();
  app.element('confirmDeleteLoanBtn').click();
  assert.equal(app.state.loans.length, 0);
  assert.equal(app.element('loanDetailModal').classList.contains('show'), false);

  app.call('viewLoan', 'missing');
  assert.equal(app.element('loanDetailModal').classList.contains('show'), false);
});
