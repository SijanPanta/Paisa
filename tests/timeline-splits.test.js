'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function activateInline(app, element) {
  const handler = app.evaluate(`(function(event) { ${element.getAttribute('onclick')} })`);
  handler.call(element, { target: element });
}

function splitApp() {
  const app = createApp();
  app.start();
  ['Ram', 'Sita', 'Anil', 'Hari'].forEach(name => {
    app.element('addFriendBtn').click();
    app.element('friendNameInput').value = name;
    app.element('saveFriendBtn').click();
  });
  return app;
}

function createSplit(app, note, amount) {
  app.call('openSplitFromAction');
  activateInline(app, app.element('splitFriendChips').querySelector('.split-me-chip'));
  app.element('splitAmountInput').value = String(amount);
  app.element('splitNoteInput').value = note;
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();
}

test('saved splits appear in the main timeline and can be filtered', () => {
  const app = splitApp();

  app.call('openSplitFromAction');
  app.element('splitAmountInput').value = '80';
  app.element('splitNoteInput').value = 'Dinner';
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();

  assert.equal(app.state.splits.length, 1);
  const list = app.element('txListContainer');
  assert.equal(list.querySelectorAll('.tx-row').length, 1);
  assert.equal(list.querySelectorAll('.timeline-split-card').length, 1);
  assert.match(list.textContent, /Split bill · Dinner/);
  assert.match(list.textContent, /4 friends/);
  assert.match(list.textContent, /your share/);

  const splitChip = app.document.querySelector('#typeFilterRow .pill-chip[data-filter="split"]');
  assert.ok(splitChip);
  splitChip.click();
  assert.equal(app.state.activeFilter, 'split');
  assert.equal(app.element('txListContainer').querySelectorAll('.timeline-split-card').length, 1);
  assert.equal(app.element('txListContainer').querySelectorAll('.timeline-loan-card').length, 0);

  app.document.querySelector('#typeFilterRow .pill-chip[data-filter="all"]').click();
  assert.equal(app.element('txListContainer').querySelectorAll('.timeline-split-card').length, 1);
});

test('deleting a split from the timeline removes its loans and approval transactions, with undo', () => {
  const app = splitApp();

  app.call('openSplitFromAction');
  app.element('splitAmountInput').value = '80';
  app.element('splitNoteInput').value = 'Dinner';
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();

  const loan = app.state.loans[0];
  app.call('approveLoan', loan.id);
  app.element('confirmApproveLoanBtn').click();

  assert.equal(app.state.loans.length, 4);
  assert.equal(app.state.transactions.length, 2);
  let list = app.element('txListContainer');
  assert.equal(list.querySelectorAll('.timeline-split-card').length, 1);
  assert.equal(list.querySelectorAll('.timeline-loan-card').length, 1);

  activateInline(app, list.querySelector('.timeline-delete-btn'));
  assert.equal(app.element('deleteSplitDialog').classList.contains('show'), true);
  assert.match(app.element('deleteSplitDesc').textContent, /4 linked loans/);

  app.element('confirmDeleteSplitBtn').click();
  assert.equal(app.state.splits.length, 0);
  assert.equal(app.state.loans.length, 0);
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.element('txListContainer').querySelectorAll('.tx-row').length, 0);

  app.call('requestGlobalUndo');
  app.call('confirmUndo');
  assert.equal(app.state.splits.length, 1);
  assert.equal(app.state.loans.length, 4);
  assert.equal(app.state.transactions.length, 2);
  assert.equal(app.element('txListContainer').querySelectorAll('.timeline-split-card').length, 1);
  assert.equal(app.element('txListContainer').querySelectorAll('.timeline-loan-card').length, 1);
});

test('deleting a later split keeps the earlier split and reduces shared friend loans', () => {
  const app = splitApp();
  createSplit(app, 'First', 80);
  createSplit(app, 'Second', 40);

  const firstId = app.state.splits[1].id;
  const secondId = app.state.splits[0].id;
  assert.equal(app.state.splits.length, 2);
  assert.equal(app.state.loans.length, 4);
  assert.ok(app.state.loans.every(loan => loan.amount === 30));

  app.call('promptDeleteSplit', secondId);
  app.element('confirmDeleteSplitBtn').click();

  assert.equal(app.state.splits.length, 1);
  assert.equal(app.state.splits[0].id, firstId);
  assert.equal(app.state.loans.length, 4);
  assert.ok(app.state.loans.every(loan => loan.amount === 20));
  assert.ok(app.state.loans.every(loan => loan.splitId === firstId));
  assert.ok(app.state.loans.every(loan => loan.splitIds.length === 1));
  assert.ok(app.state.loans.every(loan => loan.adjustments.length === 0));
});

test('deleting an earlier split keeps later friend loans instead of deleting them', () => {
  const app = splitApp();
  createSplit(app, 'First', 80);
  createSplit(app, 'Second', 40);

  const firstId = app.state.splits[1].id;
  const secondId = app.state.splits[0].id;

  app.call('promptDeleteSplit', firstId);
  app.element('confirmDeleteSplitBtn').click();

  assert.equal(app.state.splits.length, 1);
  assert.equal(app.state.splits[0].id, secondId);
  assert.equal(app.state.loans.length, 4);
  assert.ok(app.state.loans.every(loan => loan.amount === 10));
  assert.ok(app.state.loans.every(loan => loan.originalAmount === 10));
  assert.ok(app.state.loans.every(loan => loan.splitId === secondId));
  assert.ok(app.state.loans.every(loan => loan.adjustments.length === 0));
});

test('deleting a split keeps loans referenced by other split records even when loan links are stale', () => {
  const app = splitApp();
  createSplit(app, 'First', 80);
  createSplit(app, 'Second', 40);

  const firstId = app.state.splits[1].id;
  const loan = app.state.loans[0];
  loan.splitIds = [];
  loan.splitId = firstId;

  app.call('promptDeleteSplit', firstId);
  app.element('confirmDeleteSplitBtn').click();

  assert.equal(app.state.splits.length, 1);
  assert.ok(app.state.loans.some(item => item.id === loan.id));
  assert.equal(app.state.loans.find(item => item.id === loan.id).splitIds[0], app.state.splits[0].id);
});

test('deleting a split never removes a manually added friend loan', () => {
  const app = splitApp();

  app.call('openLoanModal', 'receive');
  app.element('loanAmountInput').value = '100';
  app.element('loanPersonInput').value = 'Ram';
  app.call('saveLoan');
  const manualLoan = app.state.loans[0];

  createSplit(app, 'Dinner', 80);
  assert.equal(manualLoan.amount, 100);
  assert.equal(app.state.loans.length, 5);

  app.call('promptDeleteSplit', app.state.splits[0].id);
  app.element('confirmDeleteSplitBtn').click();

  assert.equal(app.state.loans.length, 1);
  assert.equal(app.state.loans[0].id, manualLoan.id);
  assert.equal(app.state.loans[0].amount, 100);
});

test('split detail opens from the timeline and exposes the delete action', () => {
  const app = splitApp();

  app.call('openSplitFromAction');
  app.element('splitAmountInput').value = '60';
  app.element('splitNoteInput').value = 'Bus';
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();

  const row = app.element('txListContainer').querySelector('.timeline-split-card .tx-row');
  activateInline(app, row);
  assert.equal(app.element('splitDetailModal').classList.contains('show'), true);
  assert.match(app.element('splitDetailBody').textContent, /Bus/);
  assert.match(app.element('splitDetailBody').textContent, /Ram/);

  app.element('deleteSplitFromDetailBtn').click();
  assert.equal(app.element('deleteSplitDialog').classList.contains('show'), true);
  app.element('cancelDeleteSplitBtn').click();
  assert.equal(app.element('deleteSplitDialog').classList.contains('show'), false);
});
