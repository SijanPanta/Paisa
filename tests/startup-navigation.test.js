'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

const plain = value => JSON.parse(JSON.stringify(value));

function biometricApp({ supported = true, unlocked = false, enabled = true } = {}) {
  const auth = [];
  let touches = 0;
  const app = createApp({
    storage: { paisa_state: JSON.stringify({ settings: { biometricLock: enabled } }) },
    bridge: {
      isBiometricSupported: () => supported,
      shouldLockOnStart: () => !unlocked,
      authenticateBiometric: (...args) => auth.push(args),
      refreshActiveTimestamp: () => touches++
    }
  });
  return { app, auth, touches: () => touches };
}

for (const [label, options, shouldLock] of [
  ['supported, expired session', {}, true],
  ['supported, current session', { unlocked: true }, false],
  ['unsupported device', { supported: false }, false],
  ['lock disabled', { enabled: false }, false]
]) {
  test(`DOMContentLoaded startup: ${label}`, () => {
    const { app, auth, touches } = biometricApp(options);
    app.start();
    app.flushTimers();
    assert.equal(app.state.isLocked, shouldLock);
    assert.equal(auth.length, shouldLock ? 1 : 0);
    if (shouldLock) {
      assert.equal(auth[0][1], 'unlock');
      assert.match(auth[0][0], /open Paisa/);
      assert.equal(app.element('biometricLockOverlay').style.display, 'flex');
    }
    if (options.unlocked && !shouldLock) {
      assert.equal(app.element('biometricLockOverlay').classList.contains('hidden'), true);
      assert.equal(app.element('biometricLockOverlay').style.display, 'none');
    }
    app.touch();
    assert.equal(touches(), 1);
    assert.equal(app.element('fabAddBtn').listenerCount('click'), 1);
  });
}

test('biometric native callbacks unlock, retry, safely display errors and authenticate setting changes', () => {
  const { app, auth } = biometricApp();
  app.start();
  app.flushTimers();
  app.call('onBiometricFailed', 'unlock');
  assert.equal(app.state.isLocked, true);
  assert.match(app.element('lockStatusHint').textContent, /not recognized/);
  app.call('onBiometricError', 'Cancelled by user', 10, 'unlock');
  assert.match(app.element('lockStatusHint').textContent, /cancelled/);
  app.call('onBiometricError', '<img src=x onerror=bad()>', 1, 'unlock');
  assert.match(app.element('lockStatusHint').innerHTML, /&lt;img/);
  app.call('onBiometricSuccess', 'unlock');
  app.flushTimers();
  assert.equal(app.state.isLocked, false);
  assert.equal(app.element('biometricLockOverlay').style.display, 'none');

  app.element('setBiometricItem').click();
  assert.equal(auth.at(-1)[1], 'toggle');
  assert.equal(app.state.settings.biometricLock, true, 'setting changes only after native success');
  app.call('onBiometricSuccess', 'toggle');
  assert.equal(app.state.settings.biometricLock, false);
  assert.equal(JSON.parse(app.storage.get('paisa_state')).settings.biometricLock, false);
  app.call('onBiometricSuccess', 'toggle');
  assert.equal(app.state.settings.biometricLock, true);
  app.call('onAppRequireLock');
  assert.equal(app.state.isLocked, true);
  app.flushTimers();
  assert.equal(auth.at(-1)[1], 'unlock');
  app.call('onAppResumeUnlocked');
  app.flushTimers();
  assert.equal(app.state.isLocked, true, 'a resume callback cannot bypass an explicit lock');
  app.call('onBiometricSuccess', 'unlock');
  app.flushTimers();
  assert.equal(app.state.isLocked, false);
});

test('unsupported/throwing bridge is safe; native lock callbacks respect disabled security', () => {
  const app = createApp({ bridge: { isBiometricSupported() { throw new Error('not available'); } } });
  app.start();
  app.call('lockApp');
  app.call('onAppRequireLock');
  assert.equal(app.state.isLocked, false);
  assert.equal(app.element('settingBiometricVal').textContent, 'Not Supported');
  app.element('setBiometricItem').click();
  assert.equal(app.calls.alerts.at(-1), 'Biometrics not available on this device');
  app.state.isLocked = true;
  app.call('triggerBiometricAuth');
  assert.equal(app.state.isLocked, false, 'browser preview fallback unlocks without native auth');
  const disabled = biometricApp({ enabled: false });
  disabled.app.start();
  disabled.app.call('onAppRequireLock');
  disabled.app.flushTimers();
  assert.equal(disabled.auth.length, 0);
});

test('one filter listener per live chip after startup and re-render; one click renders/vibrates once', () => {
  const app = createApp();
  app.start();
  const exercise = () => {
    const chips = app.document.querySelectorAll('#typeFilterRow .pill-chip');
    assert.ok(chips.length >= 7);
    for (const chip of chips) assert.equal(chip.listenerCount('click'), 1, chip.dataset.filter);
    app.evaluate('globalThis.filterRenderCount = 0; globalThis.realRenderTransactions = renderTransactions; renderTransactions = function() { filterRenderCount++; return realRenderTransactions(); };');
    const before = app.calls.vibrations.length;
    chips.find(chip => chip.dataset.filter === 'income').click();
    assert.equal(app.state.activeFilter, 'income');
    assert.equal(app.evaluate('filterRenderCount'), 1);
    assert.equal(app.calls.vibrations.length - before, 1);
    assert.equal(chips.filter(chip => chip.classList.contains('active')).length, 1);
    app.evaluate('renderTransactions = realRenderTransactions;');
  };
  exercise();
  app.call('render');
  exercise();
});

test('theme toggle persists and informs native status bar; navigation and wallet filter update UI', () => {
  const colors = [];
  const app = createApp({ bridge: { setStatusBarColor: (...args) => colors.push(args) } });
  app.start();
  app.element('themeToggleBtn').click();
  assert.equal(app.document.body.dataset.theme, 'dark');
  assert.equal(JSON.parse(app.storage.get('paisa_state')).settings.theme, 'dark');
  assert.deepEqual(colors.at(-1), ['#121316', false]);
  app.element('themeToggleBtn').click();
  assert.deepEqual(colors.at(-1), ['#F8F9FA', true]);
  app.element('searchToggleBtn').click();
  app.call('switchTab', 'viewWallets');
  assert.equal(app.element('viewWallets').classList.contains('active'), true);
  assert.equal(app.element('viewHome').classList.contains('active'), false);
  assert.equal(app.element('pageTitle').textContent, 'Wallets');
  assert.equal(app.element('searchToggleBtn').style.display, 'none');
  assert.equal(app.element('searchBarWrap').classList.contains('show'), false);
  assert.equal(app.document.querySelector('.nav-item.active').dataset.target, 'viewWallets');
  app.call('filterByWallet', 'eSewa');
  app.flushTimers();
  assert.equal(app.state.activeFilter, 'esewa');
  assert.equal(app.element('pageTitle').textContent, 'Paisa');
  assert.equal(app.element('searchToggleBtn').style.display, 'flex');
  assert.equal(app.document.querySelector('#typeFilterRow .pill-chip.active').dataset.filter, 'esewa');
  assert.equal(app.document.querySelector('#typeFilterRow .pill-chip.active').lastScroll.inline, 'center');
});

test('Android back honors lock and closes dialogs, editor, search and details in established priority', () => {
  const app = createApp();
  const ids = ['currencyDialog', 'txModal', 'searchBarWrap', 'txDetailModal'];
  ids.forEach(id => app.element(id).classList.add('show'));
  app.state.isLocked = true;
  assert.equal(app.call('handleAndroidBack'), false);
  assert.ok(ids.every(id => app.element(id).classList.contains('show')));
  app.state.isLocked = false;
  for (const id of ids) {
    assert.equal(app.call('handleAndroidBack'), true);
    assert.equal(app.element(id).classList.contains('show'), false, id);
  }
  assert.equal(app.call('handleAndroidBack'), false);
});

test('bound controls support search, type switching, detail actions, settings and dialog validation', () => {
  const app = createApp();
  app.start();
  app.element('fabAddBtn').click();
  app.document.querySelector('.type-tab[data-type="income"]').click();
  assert.equal(app.state.selectedType, 'income');
  app.element('txAmountInput').value = '100';
  app.element('saveTxBtn').click();
  const id = app.state.transactions[0].id;
  app.call('viewTransaction', id);
  app.element('editTxFromDetailBtn').click();
  assert.equal(app.state.editingTxId, id);
  assert.equal(app.element('txDetailModal').classList.contains('show'), false);
  app.element('closeModalBtn').click();
  app.call('viewTransaction', id);
  app.element('deleteTxFromDetailBtn').click();
  app.element('cancelDeleteTxBtn').click();
  assert.equal(app.state.transactions.length, 1);
  app.element('searchToggleBtn').click();
  app.element('searchInput').value = 'no match';
  app.element('searchInput').dispatchEvent({ type: 'input' });
  app.flushTimers();
  assert.equal(app.state.searchQuery, 'no match');
  assert.equal(app.element('txListContainer').querySelectorAll('.tx-row').length, 0);
  app.element('searchToggleBtn').click();
  assert.equal(app.state.searchQuery, '');
  assert.equal(app.element('txListContainer').querySelectorAll('.tx-row').length, 1);
  app.element('setCurrencyItem').click();
  app.element('customCurrencyInput').value = '  USD  ';
  app.element('customCurrencyInput').dispatchEvent({ type: 'input' });
  app.element('saveCurrencyBtn').click();
  assert.equal(app.state.settings.currency, 'USD');
  app.element('setBudgetItem').click();
  app.element('budgetAmountInput').value = '-1';
  app.element('saveBudgetBtn').click();
  assert.equal(app.state.settings.budget, 35000);
  assert.equal(app.element('budgetDialog').classList.contains('show'), true);
  app.element('budgetAmountInput').value = '0';
  app.element('saveBudgetBtn').click();
  assert.equal(app.state.settings.budget, 0);
  assert.equal(app.element('budgetWrap').style.display, 'none');
  app.element('setHapticItem').click();
  assert.equal(app.state.settings.haptics, false);
  app.element('resetDataBtn').click();
  assert.equal(app.state.transactions.length, 1);
  app.element('confirmResetBtn').click();
  assert.equal(app.state.transactions.length, 0);
});

test('daily spend reminder setting toggles, persists and notifies native bridge', () => {
  const calls = [];
  const app = createApp({
    bridge: {
      isBiometricSupported: () => false,
      setDailySpendReminderEnabled: enabled => calls.push(enabled)
    }
  });
  app.start();
  assert.equal(app.state.settings.dailySpendReminder, false);
  assert.equal(app.element('settingDailyReminderVal').textContent, 'Disabled');

  app.element('setDailyReminderItem').click();
  assert.equal(app.state.settings.dailySpendReminder, true);
  assert.equal(app.element('settingDailyReminderVal').textContent, 'Enabled');
  assert.deepEqual(calls, [true]);
  assert.equal(JSON.parse(app.storage.get('paisa_state')).settings.dailySpendReminder, true);

  app.element('setDailyReminderItem').click();
  assert.equal(app.state.settings.dailySpendReminder, false);
  assert.equal(app.element('settingDailyReminderVal').textContent, 'Disabled');
  assert.deepEqual(calls, [true, false]);
});

test('daily reminder state is saved before the native bridge is called', () => {
  const observed = [];
  let app;
  app = createApp({
    bridge: {
      isBiometricSupported: () => false,
      setDailySpendReminderEnabled: enabled => observed.push({
        enabled,
        saved: JSON.parse(app.storage.get('paisa_state')).settings.dailySpendReminder
      })
    }
  });
  app.start();
  app.element('setDailyReminderItem').click();
  assert.deepEqual(observed, [{ enabled: true, saved: true }]);
});

test('restoring a backup resyncs the daily reminder with native scheduling', () => {
  const calls = [];
  const app = createApp({
    bridge: {
      isBiometricSupported: () => false,
      setDailySpendReminderEnabled: enabled => calls.push(enabled)
    }
  });
  app.start();
  app.restore(JSON.stringify({ transactions: [], settings: { dailySpendReminder: true } }));
  assert.deepEqual(calls, [true]);
  const saved = JSON.parse(app.storage.get('paisa_state'));
  assert.equal(saved.settings.dailySpendReminder, true);
  assert.equal(saved.settings.biometricLock, true);
});

test('startup resyncs custom reminders restored from local state', () => {
  const calls = [];
  const reminder = {
    id: 'r-start', title: 'Rent', amount: 4000, note: '', date: '2026-12-20',
    time: '09:00', repeat: 'monthly', enabled: true, createdAt: 1
  };
  const app = createApp({
    storage: { paisa_state: JSON.stringify({ transactions: [], reminders: [reminder], settings: { rentReminderSeeded: true } }) },
    bridge: {
      isBiometricSupported: () => false,
      syncReminders: () => calls.push('sync')
    }
  });
  app.start();
  assert.deepEqual(calls, ['sync']);
  assert.deepEqual(plain(app.state.reminders), [reminder]);
});

test('default rent reminder is listed, enabled and editable', () => {
  const app = createApp({ bridge: { isBiometricSupported: () => false } });
  app.start();
  assert.equal(app.state.reminders.length, 1);
  assert.match(app.element('customRemindersList').innerHTML, /Rent tirne din/);
  assert.match(app.element('customRemindersList').innerHTML, /Rs\. 4,000 · Monthly on 24 .* · 7:30 AM/);
  const row = app.element('customRemindersList').querySelector('[data-reminder-id="rent_default"]');
  row.click();
  assert.equal(app.element('reminderTitleInput').value, 'Rent tirne din');
  assert.equal(app.element('reminderTimeInput').value, '07:30');
  assert.equal(app.element('reminderEnabledInput').checked, true);
  assert.equal(app.element('deleteReminderBtn').style.display, '');
  app.element('reminderTitleInput').value = 'Rent tirne din (custom)';
  app.element('saveReminderBtn').click();
  assert.equal(app.state.reminders[0].title, 'Rent tirne din (custom)');
});

test('custom reminders are validated, saved, synced and listed with repeat labels', () => {
  const calls = [];
  const app = createApp({
    storage: { paisa_state: JSON.stringify({ settings: { rentReminderSeeded: true } }) },
    bridge: {
      isBiometricSupported: () => false,
      syncReminders: () => calls.push('sync')
    }
  });
  app.start();
  calls.length = 0;
  app.element('addReminderBtn').click();
  assert.equal(app.element('reminderDialog').classList.contains('show'), true);
  assert.equal(app.element('reminderEnabledRow').style.display, 'none');
  assert.equal(app.element('deleteReminderBtn').style.display, 'none');
  assert.equal(app.element('reminderActions').classList.contains('single-action'), true);
  assert.equal(app.element('reminderDateGroup').style.display, '');
  assert.equal(app.element('reminderWeekdayGroup').style.display, 'none');
  assert.equal(app.element('reminderTimeGroup').style.display, '');
  assert.equal(app.element('reminderBsYearInput').style.display, 'none');
  assert.equal(app.element('reminderBsMonthInput').style.display, 'none');
  assert.equal(app.element('reminderBsDateRow').classList.contains('day-only'), true);

  app.element('saveReminderBtn').click();
  assert.equal(app.state.reminders.length, 0);
  assert.equal(app.calls.alerts.at(-1), 'Please enter a reminder title');

  app.element('reminderTitleInput').value = 'Rent';
  app.element('reminderAmountInput').value = '4000';
  app.element('reminderNoteInput').value = 'Pay on time';
  app.element('reminderBsYearInput').value = '2083';
  app.element('reminderBsMonthInput').value = '9';
  app.element('reminderBsDayInput').value = '5';
  app.element('reminderTimeInput').value = '09:00';
  app.element('saveReminderBtn').click();

  assert.equal(app.state.reminders.length, 1);
  assert.equal(app.state.reminders[0].title, 'Rent');
  assert.equal(app.state.reminders[0].amount, 4000);
  assert.equal(app.state.reminders[0].repeat, 'monthly');
  assert.equal(app.state.reminders[0].calendar, 'bs');
  assert.equal(app.state.reminders[0].bsDate, '2083-09-05');
  assert.equal(app.state.reminders[0].date, '2026-12-20');
  assert.equal(app.state.reminders[0].enabled, true);
  assert.equal(JSON.parse(app.storage.get('paisa_state')).reminders[0].title, 'Rent');
  assert.equal(app.element('reminderDateHint').textContent, '5 Poush 2083');
  assert.deepEqual(calls, ['sync']);
  assert.equal(app.element('reminderDialog').classList.contains('show'), false);
  const list = app.element('customRemindersList').innerHTML;
  assert.match(list, /Rent/);
  assert.match(list, /Rs\. 4,000 · Pay on time · Monthly on 5 Poush · 9:00 AM/);
  assert.doesNotMatch(list, /Dec 20|2026-12-20/);
  assert.match(list, /data-action="edit" data-reminder-id=/);
  assert.match(list, />On</);
  assert.doesNotMatch(list, /data-action="toggle"|data-action="delete"/);
});

test('repeat choice shows only the fields it needs and weekly asks for a weekday', () => {
  const app = createApp({
    storage: { paisa_state: JSON.stringify({ settings: { rentReminderSeeded: true } }) },
    bridge: { isBiometricSupported: () => false }
  });
  app.start();
  app.element('addReminderBtn').click();

  const scheduleChildren = app.element('reminderTimeGroup').parentElement.children;
  assert.ok(scheduleChildren.indexOf(app.element('reminderTimeGroup')) >= 0);
  assert.equal(scheduleChildren.indexOf(app.element('reminderEnabledRow')), -1);
  assert.equal(app.element('reminderEnabledRow').classList.contains('reminder-section'), true);
  assert.match(app.element('reminderEnabledRow').textContent, /Status/);

  app.document.querySelector('#reminderRepeatPresets [data-repeat="daily"]').click();
  assert.equal(app.element('reminderDateGroup').style.display, 'none');
  assert.equal(app.element('reminderWeekdayGroup').style.display, 'none');
  assert.equal(app.element('reminderTimeGroup').style.display, '');
  assert.match(app.element('reminderDateHint').textContent, /^Every day · /);

  app.document.querySelector('#reminderRepeatPresets [data-repeat="weekly"]').click();
  assert.equal(app.element('reminderDateGroup').style.display, 'none');
  assert.equal(app.element('reminderWeekdayGroup').style.display, '');
  assert.match(app.element('reminderDateHint').textContent, /^Every .*day · /);

  app.element('reminderTitleInput').value = 'Standup';
  app.element('reminderWeekdayInput').value = '1';
  app.element('reminderWeekdayInput').dispatchEvent({ type: 'change' });
  const anchor = app.element('reminderDateInput').value;
  assert.equal(new Date(`${anchor}T12:00:00`).getDay(), 1);
  assert.match(app.element('reminderDateHint').textContent, /^Every Monday · /);
  app.element('saveReminderBtn').click();

  assert.equal(app.state.reminders.length, 1);
  assert.equal(app.state.reminders[0].repeat, 'weekly');
  assert.equal(app.state.reminders[0].date, anchor);
  assert.match(app.element('customRemindersList').innerHTML, /Standup/);
  assert.match(app.element('customRemindersList').innerHTML, /Every Mon · 9:00 AM/);

  app.element('addReminderBtn').click();
  app.document.querySelector('#reminderRepeatPresets [data-repeat="none"]').click();
  assert.equal(app.element('reminderDateGroup').style.display, '');
  assert.equal(app.element('reminderWeekdayGroup').style.display, 'none');
  assert.equal(app.element('reminderBsYearInput').style.display, '');
  assert.equal(app.element('reminderBsMonthInput').style.display, '');
  assert.equal(app.element('reminderBsDateRow').classList.contains('day-only'), false);
  app.element('closeReminderBtn').click();
  assert.equal(app.element('reminderDialog').classList.contains('show'), false);
});

test('custom reminder actions toggle, edit, delete and close on Android back', () => {
  const calls = [];
  const app = createApp({
    storage: { paisa_state: JSON.stringify({ settings: { rentReminderSeeded: true } }) },
    bridge: {
      isBiometricSupported: () => false,
      syncReminders: () => calls.push('sync')
    }
  });
  app.start();
  calls.length = 0;
  app.state.reminders.push({
    id: 'r1', title: 'Water', amount: null, note: '', date: '2026-12-20',
    time: '09:00', repeat: 'monthly', enabled: true, createdAt: 1
  });
  app.call('renderSettings');
  const row = () => app.element('customRemindersList').querySelector('[data-reminder-id="r1"]');

  row().click();
  assert.equal(app.element('reminderDialog').classList.contains('show'), true);
  assert.equal(app.element('reminderTitleInput').value, 'Water');
  assert.equal(app.element('reminderEnabledInput').checked, true);
  assert.equal(app.element('reminderEnabledRow').style.display, 'block');
  assert.equal(app.element('deleteReminderBtn').style.display, '');
  assert.equal(app.element('reminderActions').classList.contains('single-action'), false);

  app.element('reminderEnabledInput').checked = false;
  app.element('reminderEnabledInput').dispatchEvent({ type: 'change' });
  assert.equal(app.state.reminders[0].enabled, false);
  assert.deepEqual(calls, ['sync']);

  app.element('reminderTitleInput').value = 'Water bill';
  app.element('saveReminderBtn').click();
  assert.equal(app.state.reminders[0].title, 'Water bill');
  assert.equal(app.state.reminders[0].enabled, false);
  assert.equal(app.state.reminders[0].calendar, 'bs');
  assert.equal(app.state.reminders[0].bsDate, '2083-09-05');

  row().click();
  assert.equal(app.element('reminderTitleInput').value, 'Water bill');
  app.element('deleteReminderBtn').click();
  assert.equal(app.element('reminderDialog').classList.contains('show'), false);
  assert.equal(app.element('deleteReminderDialog').classList.contains('show'), true);
  app.call('handleAndroidBack');
  assert.equal(app.element('deleteReminderDialog').classList.contains('show'), false);

  row().click();
  app.element('deleteReminderBtn').click();
  app.element('confirmDeleteReminderBtn').click();
  assert.equal(app.state.reminders.length, 0);
  assert.equal(calls.at(-1), 'sync');
});
