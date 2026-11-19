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
  const { direction = 'pay', amount = 500, person = 'Ram', account = 'Cash',
    date = '2026-01-15', note = 'Dinner' } = options;
  app.call('openLoanModal', direction);
  app.element('loanAmountInput').value = String(amount);
  app.element('loanPersonInput').value = person;
  app.element('loanNoteInput').value = note;
  app.element('loanDateInput').value = date;
  app.call('renderLoanAccountSelect', account);
  app.call('saveLoan');
  return app.state.loans[0];
}

function approve(app, loanId) {
  app.call('approveLoan', loanId);
  app.element('confirmApproveLoanBtn').click();
}

test('main timeline redirects to loans, whose page buttons open the matching form', () => {
  const app = loanApp();
  assert.equal(app.document.getElementById('loanToPayBtn'), null);
  assert.equal(app.document.getElementById('loanToReceiveBtn'), null);

  app.element('openLoansBtn').click();
  assert.equal(app.element('viewLoans').classList.contains('active'), true);

  app.element('loanPageToPayBtn').click();
  assert.equal(app.element('loanModal').classList.contains('show'), true);
  assert.equal(app.element('loanSheetTitle').textContent, 'New Friend Loan');
  assert.match(app.element('loanDirectionHint').textContent, /deduct/);
  assert.equal(app.element('saveLoanBtn').textContent, 'Save To Pay');

  app.element('loanPageToReceiveBtn').click();
  assert.match(app.element('loanDirectionHint').textContent, /add/);
  assert.equal(app.element('saveLoanBtn').textContent, 'Save To Receive');

  app.call('saveLoan');
  assert.equal(app.state.loans.length, 0);
  assert.match(app.calls.alerts.at(-1), /valid amount/);

  addLoan(app, { direction: 'receive' });
  assert.equal(app.state.loans[0].direction, 'receive');
  assert.equal(app.state.loans[0].status, 'pending');
  assert.equal(app.state.loans[0].txId, null);
  assert.equal(app.element('loanModal').classList.contains('show'), false);
});

test('pending loans stay off Net Balance and have their own balance sheet', () => {
  const app = loanApp();
  addLoan(app, { direction: 'pay', amount: 500, person: 'Ram' });
  addLoan(app, { direction: 'receive', amount: 800, person: 'Sita' });

  assert.equal(app.element('netBalanceVal').textContent, '0');
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.element('loanPayTotal').textContent, 'Rs. 500');
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 800');
  assert.equal(app.element('loanNetVal').textContent, 'Rs. 300');
  assert.equal(app.element('loanApprovedImpact').textContent, 'Rs. 0 in Net Balance');
  assert.match(app.element('loanSummaryHint').textContent, /Rs\. 300 from 2 pending loans/);
  assert.equal(app.element('loanPendingList').querySelectorAll('.loan-card').length, 2);
  assert.equal(app.element('loanApprovedList').querySelectorAll('.loan-card').length, 0);
  assert.equal(app.element('loanNavBadge').textContent, '2');
  assert.match(app.element('loanHeroHint').textContent, /2 pending loans/);

  const rows = app.element('loanPendingList').querySelectorAll('.loan-card');
  assert.match(rows[0].textContent, /Sita/);
  assert.match(rows[1].textContent, /Ram/);
});

test('approval records an expense or income, updates Net Balance and moves the loan to approved', () => {
  const app = loanApp();
  const pay = addLoan(app, { amount: 500, person: 'Ram' });
  const receive = addLoan(app, { direction: 'receive', amount: 800, person: 'Sita' });

  app.call('approveLoan', pay.id);
  assert.equal(app.element('approveLoanDialog').classList.contains('show'), true);
  assert.match(app.element('approveLoanDesc').textContent, /deducted from your Net Balance/);
  app.element('cancelApproveLoanBtn').click();
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.element('approveLoanDialog').classList.contains('show'), false);

  approve(app, pay.id);
  assert.equal(app.state.transactions.length, 1);
  const expense = app.state.transactions[0];
  assert.equal(expense.type, 'expense');
  assert.equal(expense.amount, 500);
  assert.equal(expense.loanId, pay.id);
  assert.equal(expense.categoryName, 'Loan Repayment');
  assert.match(expense.note, /Ram/);
  assert.equal(app.element('netBalanceVal').textContent, '-500');
  assert.equal(app.call('getWalletSummary').balances.Cash, -500);
  assert.equal(app.element('loanPendingList').querySelectorAll('.loan-card').length, 1);
  assert.equal(app.element('loanApprovedList').querySelectorAll('.loan-card').length, 1);
  assert.equal(app.element('loanApprovedImpact').textContent, 'Rs. -500 in Net Balance');

  approve(app, receive.id);
  assert.equal(app.state.transactions[0].type, 'income');
  assert.equal(app.state.transactions[0].categoryName, 'Loan Received');
  assert.equal(app.element('netBalanceVal').textContent, '300');
  assert.equal(app.call('getWalletSummary').balances.Cash, 300);
  assert.equal(app.element('loanPendingCount').textContent, '0 pending');
  assert.equal(app.element('loanApprovedCount').textContent, '2 approved');
  assert.equal(app.element('loanNavBadge').style.display, 'none');
  assert.match(app.element('loanSummaryHint').textContent, /All loans are approved/);

  app.call('approveLoan', pay.id);
  assert.match(app.calls.alerts.at(-1), /already approved/);
});

test('deleting an approved loan reverses its transaction, including from the timeline', () => {
  const app = loanApp();
  const loan = addLoan(app, { amount: 500 });
  approve(app, loan.id);
  assert.equal(app.state.transactions.length, 1);

  app.call('viewTransaction', app.state.transactions[0].id);
  app.element('deleteTxFromDetailBtn').click();
  app.element('confirmDeleteTxBtn').click();
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.call('isLoanApproved', loan), false);
  assert.equal(loan.status, 'pending');
  assert.equal(app.element('netBalanceVal').textContent, '0');
  assert.equal(app.element('loanPendingList').querySelectorAll('.loan-card').length, 1);
});

test('loan deletion confirmation removes linked transactions and supports cancellation', () => {
  const app = loanApp();
  const loan = addLoan(app, { amount: 500 });
  approve(app, loan.id);

  app.call('promptDeleteLoan', loan.id);
  assert.match(app.element('deleteLoanDesc').textContent, /reversing the effect on Net Balance/);
  app.element('cancelDeleteLoanBtn').click();
  assert.equal(app.state.loans.length, 1);
  assert.equal(app.state.transactions.length, 1);

  app.call('promptDeleteLoan', loan.id);
  app.element('confirmDeleteLoanBtn').click();
  assert.equal(app.state.loans.length, 0);
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.element('netBalanceVal').textContent, '0');
  assert.equal(app.element('deleteLoanDialog').classList.contains('show'), false);

  const pending = addLoan(app, { amount: 250, person: 'Hari' });
  app.call('promptDeleteLoan', pending.id);
  assert.doesNotMatch(app.element('deleteLoanDesc').textContent, /linked transaction/);
  app.element('confirmDeleteLoanBtn').click();
  assert.equal(app.state.loans.length, 0);
});

test('editing a loan updates its fields and keeps an approved loan in sync with its transaction', () => {
  const app = loanApp();
  const loan = addLoan(app, { amount: 500 });
  app.call('editLoan', loan.id);
  assert.equal(app.element('loanSheetTitle').textContent, 'Edit Loan');
  app.element('loanAmountInput').value = '600';
  app.element('loanPersonInput').value = 'Bishnu';
  app.call('saveLoan');
  assert.equal(loan.amount, 600);
  assert.equal(loan.person, 'Bishnu');
  assert.equal(app.state.transactions.length, 0);

  approve(app, loan.id);
  app.call('editLoan', loan.id);
  app.element('loanAmountInput').value = '900';
  app.element('loanPersonInput').value = 'Bishnu';
  app.call('setLoanDirection', 'receive');
  app.call('saveLoan');
  assert.equal(app.state.transactions.length, 1);
  assert.equal(app.state.transactions[0].type, 'income');
  assert.equal(app.state.transactions[0].amount, 900);
  assert.equal(app.element('netBalanceVal').textContent, '900');
  assert.equal(app.element('loanApprovedImpact').textContent, 'Rs. 900 in Net Balance');
});

test('loans survive reload and backup restore, and are cleared with all data', () => {
  const app = loanApp();
  const loan = addLoan(app, { direction: 'receive', amount: 800, person: 'Sita' });
  approve(app, loan.id);

  const reloaded = createApp({ storage: Object.fromEntries(app.storage) });
  reloaded.start();
  assert.equal(reloaded.state.loans.length, 1);
  assert.equal(reloaded.call('isLoanApproved', reloaded.state.loans[0]), true);
  assert.equal(reloaded.element('netBalanceVal').textContent, '800');

  const backup = JSON.stringify({
    transactions: reloaded.state.transactions,
    bankAccounts: [],
    loans: [{ id: 'restored', direction: 'pay', amount: 100, person: 'Bishnu', status: 'pending', date: '2026-01-15' }],
    settings: reloaded.state.settings
  });
  reloaded.restore(backup);
  assert.equal(reloaded.state.loans.length, 1);
  assert.equal(reloaded.state.loans[0].person, 'Bishnu');
  assert.equal(reloaded.element('netBalanceVal').textContent, '800');

  reloaded.element('resetDataBtn').click();
  reloaded.element('confirmResetBtn').click();
  assert.equal(reloaded.state.loans.length, 0);
  assert.equal(reloaded.state.transactions.length, 0);
});

test('loans tab navigation, FAB and hardware back work with the loan editor', () => {
  const app = loanApp();
  app.element('openLoansBtn').click();
  assert.equal(app.element('viewLoans').classList.contains('active'), true);
  assert.equal(app.element('pageTitle').textContent, 'Loans');

  app.element('fabAddBtn').click();
  assert.equal(app.element('loanModal').classList.contains('show'), true);
  assert.equal(app.call('handleAndroidBack'), true);
  assert.equal(app.element('loanModal').classList.contains('show'), false);

  app.element('loanPageToReceiveBtn').click();
  assert.equal(app.element('saveLoanBtn').textContent, 'Save To Receive');
  app.element('loanAccountPickerBtn').click();
  assert.equal(app.element('accountPickerTitle').textContent, 'Loan Account / Wallet');
  app.call('selectWalletAccount', 'eSewa');
  assert.equal(app.element('loanAccountSelect').value, 'eSewa');
  app.element('loanAmountInput').value = '120';
  app.element('loanPersonInput').value = 'Ram';
  app.call('saveLoan');
  assert.equal(app.state.loans[0].direction, 'receive');
  assert.equal(app.state.loans[0].account, 'eSewa');
  assert.equal(app.call('getWalletSummary').balances.eSewa, 0);

  app.call('approveLoan', app.state.loans[0].id);
  assert.equal(app.call('handleAndroidBack'), true);
  assert.equal(app.element('approveLoanDialog').classList.contains('show'), false);
  assert.equal(app.element('netBalanceVal').textContent, '0');
});
