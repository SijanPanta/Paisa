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

test('background scrolling is locked while a sheet or dialog is open', () => {
  const app = createApp();
  app.start();
  assert.equal(app.document.body.classList.contains('overlay-open'), false);

  app.call('openFriendsSheet');
  app.call('syncScrollLock');
  assert.equal(app.element('friendsSheet').classList.contains('show'), true);
  assert.equal(app.document.body.classList.contains('overlay-open'), true);

  app.call('closeFriendsSheet');
  app.call('syncScrollLock');
  assert.equal(app.document.body.classList.contains('overlay-open'), false);

  app.call('openAddFriendDialog');
  app.call('syncScrollLock');
  assert.equal(app.document.body.classList.contains('overlay-open'), true);

  app.call('closeAddFriendDialog');
  app.call('syncScrollLock');
  assert.equal(app.document.body.classList.contains('overlay-open'), false);
});

test('named Split action and Add Friend sit on the Loans page', () => {
  const app = createApp();
  app.start();

  assert.equal(app.element('splitBillBtn').textContent.trim(), 'Split');
  assert.equal(app.element('friendsBtn').textContent.trim(), 'Friends');
  assert.ok(app.document.querySelector('.loan-summary-card #friendsBtn'));
  assert.ok(app.document.querySelector('#viewLoans .loan-action-row #splitBillBtn'));
  assert.equal(app.document.querySelector('#viewLoans #friendList'), null);
  assert.equal(app.document.getElementById('splitPanel'), null);

  app.element('splitBillBtn').click();
  assert.equal(app.element('splitModal').classList.contains('show'), true);
  app.call('closeSplitModal');

  app.element('friendsBtn').click();
  assert.equal(app.element('friendsSheet').classList.contains('show'), true);
  app.element('addFriendBtn').click();
  assert.equal(app.element('addFriendDialog').classList.contains('show'), true);
  app.element('cancelAddFriendBtn').click();
  app.element('closeFriendsBtn').click();
  assert.equal(app.element('friendsSheet').classList.contains('show'), false);
});

test('split tab in the transaction popup keeps the type tabs visible', () => {
  const app = createApp();
  app.start();

  app.call('openAddModal', 'expense');
  app.document.querySelector('#txTypeSwitcher .type-tab[data-type="split"]').click();
  assert.equal(app.element('txModal').classList.contains('show'), true);
  assert.equal(app.element('splitModal').classList.contains('show'), false);
  assert.equal(app.element('sheetTitle').textContent, 'Split a Bill');
  assert.equal(app.element('splitForm').parentElement.id, 'txSplitHost');
  assert.equal(app.element('txFormFields').style.display, 'none');
  assert.ok(app.document.querySelector('#txTypeSwitcher .type-tab[data-type="expense"]'));
  assert.equal(app.document.querySelector('#txTypeSwitcher .type-tab.active').dataset.type, 'split');

  app.document.querySelector('#txTypeSwitcher .type-tab[data-type="expense"]').click();
  assert.equal(app.element('splitForm').parentElement.id, 'splitFormHome');
  assert.equal(app.element('txFormFields').style.display, 'block');
  assert.equal(app.element('sheetTitle').textContent, 'New Transaction');
  assert.equal(app.document.querySelector('#txTypeSwitcher .type-tab.active').dataset.type, 'expense');
  app.call('closeModal');
});

test('split tab in the friend-loan popup keeps the To Pay / To Receive tabs visible', () => {
  const app = createApp();
  app.start();

  app.call('openLoanModal', 'receive');
  app.document.querySelector('#loanDirectionSwitcher .loan-direction-tab[data-direction="split"]').click();
  assert.equal(app.element('loanModal').classList.contains('show'), true);
  assert.equal(app.element('splitModal').classList.contains('show'), false);
  assert.equal(app.element('loanSheetTitle').textContent, 'Split a Bill');
  assert.equal(app.element('splitForm').parentElement.id, 'loanSplitHost');
  assert.equal(app.element('loanFormFields').style.display, 'none');
  assert.equal(app.document.querySelector('#loanDirectionSwitcher .loan-direction-tab.active').dataset.direction, 'split');

  app.document.querySelector('#loanDirectionSwitcher .loan-direction-tab[data-direction="pay"]').click();
  assert.equal(app.element('splitForm').parentElement.id, 'splitFormHome');
  assert.equal(app.element('loanFormFields').style.display, 'block');
  assert.equal(app.element('loanSheetTitle').textContent, 'New Friend Loan');
  assert.equal(app.document.querySelector('#loanDirectionSwitcher .loan-direction-tab.active').dataset.direction, 'pay');
});

test('tapping a friend opens a prefilled To Receive loan and links the saved friend', () => {
  const app = splitApp();
  const friend = app.state.friends[0];

  app.element('friendsBtn').click();
  activateInline(app, app.element('friendList').querySelector('.friend-card'));
  assert.equal(app.element('friendsSheet').classList.contains('show'), false);
  assert.equal(app.element('loanModal').classList.contains('show'), true);
  assert.equal(app.element('saveLoanBtn').textContent, 'Save To Receive');
  assert.equal(app.element('loanPersonInput').value, friend.name);

  app.element('loanAmountInput').value = '250';
  app.element('saveLoanBtn').click();
  assert.equal(app.state.loans.length, 1);
  assert.equal(app.state.loans[0].direction, 'receive');
  assert.equal(app.state.loans[0].person, friend.name);
  assert.equal(app.state.loans[0].friendId, friend.id);
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 250');

  app.call('closeLoanModal');
  app.call('handleFriendCardClick', { target: { tagName: 'BUTTON' } }, friend.id);
  assert.equal(app.element('loanModal').classList.contains('show'), false);
  activateInline(app, app.element('friendList').querySelector('.friend-remove'));
  assert.equal(app.element('deleteFriendDialog').classList.contains('show'), true);
  assert.equal(app.element('loanModal').classList.contains('show'), false);
});

test('friends are validated, listed, persisted, removable and undoable', () => {
  const app = createApp();
  app.start();

  app.element('addFriendBtn').click();
  app.element('friendNameInput').value = '   ';
  app.element('saveFriendBtn').click();
  assert.equal(app.state.friends.length, 0);
  assert.match(app.calls.alerts.at(-1), /enter a friend/i);

  app.element('friendNameInput').value = ' Ram ';
  app.element('saveFriendBtn').click();
  assert.equal(app.state.friends.length, 1);
  assert.equal(app.state.friends[0].name, 'Ram');
  assert.equal(app.element('friendCount').textContent, '1 saved');
  assert.equal(app.element('friendList').querySelectorAll('.friend-card').length, 1);
  assert.equal(app.element('addFriendDialog').classList.contains('show'), false);

  app.element('addFriendBtn').click();
  app.element('friendNameInput').value = 'ram';
  app.element('saveFriendBtn').click();
  assert.equal(app.state.friends.length, 1);
  assert.match(app.calls.alerts.at(-1), /already saved/i);
  app.element('cancelAddFriendBtn').click();
  assert.equal(app.element('addFriendDialog').classList.contains('show'), false);

  const reloaded = createApp({ storage: Object.fromEntries(app.storage) });
  reloaded.start();
  assert.equal(reloaded.state.friends.length, 1);

  reloaded.call('promptDeleteFriend', reloaded.state.friends[0].id);
  assert.match(reloaded.element('deleteFriendDesc').textContent, /Ram/);
  reloaded.element('confirmDeleteFriendBtn').click();
  assert.equal(reloaded.state.friends.length, 0);
  reloaded.call('undoLastAction');
  assert.equal(reloaded.state.friends.length, 1);

  reloaded.element('resetDataBtn').click();
  reloaded.element('confirmResetBtn').click();
  assert.equal(reloaded.state.friends.length, 0);
});

test('split evenly button fills all friend amounts and no mode tabs exist', () => {
  const app = splitApp();
  app.call('openSplitModal');
  assert.equal(app.document.getElementById('splitModeSwitcher'), null);
  assert.equal(app.document.querySelector('[data-mode="equal"]'), null);
  assert.notEqual(app.element('splitManualGroup').style.display, 'none');
  assert.equal(app.element('splitEqualBtn').textContent.trim(), 'Split evenly');

  app.element('splitAmountInput').value = '100';
  app.element('splitEqualBtn').click();
  const values = app.state.friends.map(friend => app.element('splitAmount_' + friend.id).value);
  assert.equal(values.join(','), '20.00,20.00,20.00,20.00');
  assert.match(app.element('splitPreview').textContent, /Rs\. 20/);
  assert.equal(app.call('splitShares').myCents, 2000);
});

test('equal split records the full bill as an expense and each friend as a pending To Receive loan', () => {
  const app = splitApp();
  app.element('splitBillBtn').click();
  assert.equal(app.element('splitModal').classList.contains('show'), true);
  assert.equal(app.element('splitFriendChips').querySelectorAll('.split-friend-chip.active').length, 4);
  assert.equal(app.element('splitFriendChips').querySelector('.split-me-chip').classList.contains('active'), true);
  assert.equal(app.element('splitAccountSelect').value, 'Cash');

  app.element('splitAmountInput').value = '100';
  app.element('splitNoteInput').value = 'Dinner';
  app.element('splitEqualBtn').click();
  app.call('renderSplitPreview');
  assert.match(app.element('splitPreview').textContent, /Rs\. 20/);
  app.element('saveSplitBtn').click();

  assert.equal(app.state.transactions.length, 1);
  const expense = app.state.transactions[0];
  assert.equal(expense.type, 'expense');
  assert.equal(expense.amount, 100);
  assert.equal(expense.categoryId, 'split_bill');
  assert.equal(expense.categoryName, 'Split Bill');
  assert.equal(expense.account, 'Cash');
  assert.match(expense.note, /Dinner/);

  assert.equal(app.state.loans.length, 4);
  app.state.loans.forEach(loan => {
    assert.equal(loan.direction, 'receive');
    assert.equal(loan.status, 'pending');
    assert.equal(loan.amount, 20);
    assert.equal(loan.txId, null);
    assert.equal(loan.person, app.state.friends.find(friend => friend.id === loan.friendId).name);
    assert.equal(loan.splitId, expense.splitId);
  });
  assert.equal(new Set(app.state.loans.map(loan => loan.friendId)).size, 4);

  app.call('viewLoan', app.state.loans[0].id);
  const detail = app.element('loanDetailBody').textContent;
  assert.match(detail, /To Receive recorded/);
  assert.match(detail, /Dinner/);
  app.call('closeLoanDetail');

  assert.equal(app.element('totalExpenseVal').textContent, 'Rs. 100');
  assert.equal(app.element('netBalanceVal').textContent, '-100');
  assert.equal(app.element('loanPayTotal').textContent, 'Rs. 0');
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 80');
  assert.equal(app.element('loanNetVal').textContent, 'Rs. 80');
  assert.equal(app.element('loanNavBadge').textContent, '4');
  assert.equal(app.element('loanHeroHint').textContent, '4');
  assert.equal(app.element('splitModal').classList.contains('show'), false);
});

test('equal split gives paisa remainder to the last friend and skips an empty share', () => {
  const app = splitApp();
  app.call('openSplitModal');
  app.element('splitAmountInput').value = '100.01';
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();

  assert.equal(app.state.transactions[0].amount, 100.01);
  assert.equal(app.state.loans.length, 4);
  const lastFriend = app.state.friends[app.state.friends.length - 1];
  const lastLoan = app.state.loans.find(loan => loan.friendId === lastFriend.id);
  assert.equal(lastLoan.amount, 20.01);
  assert.equal(app.state.loans.filter(loan => loan.amount === 20).length, 3);
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 80.01');
});

test('manual split uses entered shares, leaves the remainder as your expense and validates input', () => {
  const app = splitApp();
  app.call('openSplitModal');
  assert.equal(app.element('splitManualRows').querySelectorAll('.split-friend-row').length, 4);

  app.element('splitAmountInput').value = '100';
  const ids = app.state.friends.map(friend => friend.id);
  [10, 20, 15, 15].forEach((amount, index) => {
    app.element('splitAmount_' + ids[index]).value = String(amount);
  });
  app.call('renderSplitPreview');
  assert.match(app.element('splitPreview').textContent, /Rs\. 40/);

  app.element('saveSplitBtn').click();
  assert.equal(app.state.transactions[0].amount, 100);
  assert.equal(app.state.loans.map(loan => loan.amount).sort().join(','), '10,15,15,20');
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 60');

  const second = splitApp();
  second.call('openSplitModal');
  second.element('splitAmountInput').value = '50';
  second.element('saveSplitBtn').click();
  assert.equal(second.state.transactions.length, 0);
  assert.equal(second.state.loans.length, 0);
  assert.match(second.calls.alerts.at(-1), /every selected friend/i);

  second.state.friends.forEach(friend => {
    second.element('splitAmount_' + friend.id).value = '1';
  });
  second.element('splitAmount_' + second.state.friends[0].id).value = '60';
  second.element('saveSplitBtn').click();
  assert.equal(second.state.transactions.length, 0);
  assert.match(second.calls.alerts.at(-1), /exceed the bill/i);
});

test('Me chip can be turned off so the full bill is still expensed and friends receive the split', () => {
  const app = splitApp();
  app.call('openSplitModal');

  const meChip = app.element('splitFriendChips').querySelector('.split-me-chip');
  assert.equal(meChip.classList.contains('active'), true);
  activateInline(app, meChip);
  assert.equal(app.element('splitFriendChips').querySelector('.split-me-chip').classList.contains('active'), false);
  assert.equal(app.call('splitShares').includeMe, false);

  app.state.friends.slice(3).forEach(friend => app.call('toggleSplitFriend', friend.id));
  app.element('splitAmountInput').value = '90';
  app.element('splitEqualBtn').click();
  assert.equal(app.element('splitPreview').textContent.includes('You · your share'), false);
  app.element('saveSplitBtn').click();

  assert.equal(app.state.transactions.length, 1);
  assert.equal(app.state.transactions[0].amount, 90);
  assert.equal(app.state.loans.length, 3);
  assert.equal(app.state.loans.reduce((sum, loan) => sum + loan.amount, 0), 90);
  app.state.loans.forEach(loan => assert.equal(loan.amount, 30));
  assert.equal(app.element('totalExpenseVal').textContent, 'Rs. 90');
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 90');
});

test('later splits append to each friend existing pending loan instead of creating new loans', () => {
  const app = splitApp();
  const targets = app.state.friends.slice(0, 2);

  app.call('openSplitModal');
  activateInline(app, app.element('splitFriendChips').querySelector('.split-me-chip'));
  app.state.friends.slice(2).forEach(friend => app.call('toggleSplitFriend', friend.id));
  app.element('splitAmountInput').value = '60';
  app.element('splitNoteInput').value = 'Dinner';
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();

  assert.equal(app.state.loans.length, 2);
  targets.forEach(friend => {
    const loan = app.state.loans.find(item => item.friendId === friend.id);
    assert.equal(loan.amount, 30);
    assert.equal(loan.originalAmount, 30);
    assert.equal(loan.adjustments.length, 0);
  });

  app.call('openSplitModal');
  activateInline(app, app.element('splitFriendChips').querySelector('.split-me-chip'));
  app.state.friends.slice(2).forEach(friend => app.call('toggleSplitFriend', friend.id));
  app.element('splitAmountInput').value = '40';
  app.element('splitNoteInput').value = 'Snacks';
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();

  assert.equal(app.state.loans.length, 2);
  targets.forEach(friend => {
    const loan = app.state.loans.find(item => item.friendId === friend.id);
    assert.equal(loan.amount, 50);
    assert.equal(loan.originalAmount, 30);
    assert.equal(loan.adjustments.length, 1);
    assert.equal(loan.adjustments[0].delta, 20);
    assert.match(loan.adjustments[0].note, /Snacks/);
  });

  const firstLoan = app.state.loans.find(loan => loan.friendId === targets[0].id);
  app.call('viewLoan', firstLoan.id);
  const detail = app.element('loanDetailBody').textContent;
  assert.match(detail, /Dinner/);
  assert.match(detail, /Snacks/);
  assert.match(detail, /Split bill added/);
  app.call('closeLoanDetail');
});

test('split validation, wallet choice, undo, back navigation and restore work together', () => {
  const app = splitApp();

  app.element('splitBillBtn').click();
  app.element('saveSplitBtn').click();
  assert.match(app.calls.alerts.at(-1), /bill amount greater than zero/i);
  app.element('splitAmountInput').value = '100';
  app.state.friends.forEach(friend => app.call('toggleSplitFriend', friend.id));
  app.element('saveSplitBtn').click();
  assert.match(app.calls.alerts.at(-1), /select at least one friend/i);
  app.call('toggleSplitFriend', app.state.friends[0].id);
  app.element('splitAmountInput').value = '0.01';
  app.element('splitEqualBtn').click();
  assert.match(app.calls.alerts.at(-1), /too small to split/i);

  app.element('splitAccountPickerBtn').click();
  assert.equal(app.element('accountPickerTitle').textContent, 'Split Account / Wallet');
  app.call('selectWalletAccount', 'eSewa');
  app.element('splitAmountInput').value = '50';
  app.element('splitEqualBtn').click();
  app.element('splitNoteInput').value = 'Pizza';
  app.element('saveSplitBtn').click();
  assert.equal(app.state.transactions[0].account, 'eSewa');
  assert.equal(app.state.loans[0].account, 'eSewa');
  assert.equal(app.state.loans[0].amount, 25);
  assert.match(app.state.loans[0].note, /Pizza/);
  assert.equal(app.call('getWalletSummary').balances.eSewa, -50);

  app.call('undoLastAction');
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.state.loans.length, 0);
  assert.equal(app.state.friends.length, 4);

  app.call('openSplitModal');
  assert.equal(app.call('handleAndroidBack'), true);
  assert.equal(app.element('splitModal').classList.contains('show'), false);
  app.call('openAddFriendDialog');
  assert.equal(app.call('handleAndroidBack'), true);
  assert.equal(app.element('addFriendDialog').classList.contains('show'), false);

  const reloaded = createApp({ storage: Object.fromEntries(app.storage) });
  reloaded.start();
  assert.equal(reloaded.state.friends.length, 4);
  reloaded.restore(JSON.stringify({ transactions: [], loans: [], settings: reloaded.state.settings }));
  assert.equal(reloaded.state.friends.length, 0);
});

test('split 200 between 4 from eSewa: full bill leaves wallet, share is annotated, and approval returns friend amounts', () => {
  const app = splitApp();
  app.element('splitBillBtn').click();
  app.element('splitAccountPickerBtn').click();
  app.call('selectWalletAccount', 'eSewa');

  app.call('toggleSplitFriend', app.state.friends[3].id);
  app.element('splitAmountInput').value = '200';
  app.element('splitNoteInput').value = 'Dinner';
  app.element('splitEqualBtn').click();
  app.element('saveSplitBtn').click();

  assert.equal(app.state.transactions.length, 1);
  assert.equal(app.state.transactions[0].type, 'expense');
  assert.equal(app.state.transactions[0].amount, 200);
  assert.equal(app.state.transactions[0].account, 'eSewa');
  assert.equal(app.call('getWalletSummary').balances.eSewa, -200);
  assert.equal(app.element('netBalanceVal').textContent, '-200');
  assert.equal(app.element('totalExpenseVal').textContent, 'Rs. 200');

  assert.equal(app.state.loans.length, 3);
  assert.ok(app.state.loans.every(loan => loan.direction === 'receive' && loan.amount === 50 && loan.status === 'pending'));
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 150');

  const card = app.element('txListContainer').querySelector('.timeline-split-card');
  assert.match(card.querySelector('.tx-amount').textContent, /Rs\. 200/);
  assert.match(card.querySelector('.split-share-note').textContent, /Rs\. 50 your share/);

  app.state.loans.forEach(loan => {
    app.call('approveLoan', loan.id);
    app.element('confirmApproveLoanBtn').click();
  });

  assert.equal(app.call('getWalletSummary').balances.eSewa, -50);
  assert.equal(app.element('netBalanceVal').textContent, '-50');
  assert.equal(app.element('loanReceiveTotal').textContent, 'Rs. 0');
});
