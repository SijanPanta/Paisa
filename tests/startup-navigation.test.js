'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function biometricApp({ supported = true, unlocked = false, enabled = true } = {}) {
  const auth = [];
  let touches = 0;
  const app = createApp({
    storage: { paisa_state: JSON.stringify({ settings: { biometricLock: enabled } }) },
    bridge: {
      isBiometricSupported: () => supported,
      isSessionUnlocked: () => unlocked,
      authenticateBiometric: (...args) => auth.push(args),
      refreshActiveTimestamp: () => touches++
    }
  });
  return { app, auth, touches: () => touches };
}

for (const [label, options, shouldLock] of [
  ['supported, expired session', {}, true],
  ['supported, current session', { unlocked: true }, true],
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
