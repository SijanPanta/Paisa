'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

const plain = value => JSON.parse(JSON.stringify(value));

test('loadState merges old settings with defaults without restoring session/UI state', () => {
  const app = createApp({ storage: { paisa_state: JSON.stringify({
    transactions: [{ id: 'old' }], bankAccounts: [{ id: 'Nabil', name: 'Nabil' }],
    settings: { currency: '$', budget: 0, haptics: false }, isLocked: true, activeFilter: 'income'
  }) } });
  app.call('loadState');
  assert.deepEqual(plain(app.state.transactions), [{ id: 'old' }]);
  assert.equal(app.state.bankAccounts[0].name, 'Nabil');
  assert.deepEqual(plain(app.state.reminders), []);
  assert.deepEqual(plain(app.state.settings), {
    currency: '$', budget: 0, haptics: false, biometricLock: true, dailySpendReminder: false, theme: 'light'
  });
  assert.equal(app.state.isLocked, false);
  assert.equal(app.state.activeFilter, 'all');
});

test('saveState uses established local/native keys and omits only the lock session', () => {
  const saves = [];
  const app = createApp({ bridge: { saveData: (...args) => saves.push(args) } });
  app.state.isLocked = true;
  app.state.bankAccounts.push({ id: 'bank-1', name: 'Bank One' });
  app.call('saveState');
  const serialized = app.storage.get('paisa_state');
  assert.equal(Object.hasOwn(JSON.parse(serialized), 'isLocked'), false);
  assert.equal(JSON.parse(serialized).bankAccounts[0].id, 'bank-1');
  assert.deepEqual(JSON.parse(serialized).reminders, []);
  assert.deepEqual(saves, [['paisa_backup', serialized]]);
  assert.equal(app.state.isLocked, true);
});

test('native backup is used only when local state is absent', () => {
  const gets = [];
  const bridge = { getData: (...args) => {
    gets.push(args);
    return JSON.stringify({ transactions: [{ id: 'native' }], settings: { theme: 'dark' } });
  } };
  const app = createApp({ bridge });
  app.call('loadState');
  assert.deepEqual(gets, [['paisa_backup', '']]);
  assert.equal(app.state.transactions[0].id, 'native');
  assert.equal(app.state.settings.theme, 'dark');
  gets.length = 0;
  const local = createApp({ bridge, storage: { paisa_state: '{"transactions":[{"id":"local"}]}' } });
  local.call('loadState');
  assert.equal(local.state.transactions[0].id, 'local');
  assert.equal(gets.length, 0);
});

test('corrupt local JSON is logged and leaves usable defaults', () => {
  const app = createApp({ storage: { paisa_state: '{broken' } });
  assert.doesNotThrow(() => app.call('loadState'));
  assert.equal(app.calls.errors.length, 1);
  assert.equal(app.state.transactions.length, 0);
  assert.equal(app.state.settings.currency, 'Rs.');
});

test('native helpers preserve argument order and respect haptics preference', () => {
  const calls = [];
  const bridge = Object.fromEntries(['vibrate', 'showToast', 'shareText', 'saveFile'].map(name =>
    [name, (...args) => calls.push([name, ...args])]));
  const app = createApp({ bridge });
  app.call('nativeVibrate');
  app.call('nativeToast', 'hello');
  app.call('nativeShare', 'title', 'body');
  app.call('nativeSaveFile', 'a.json', 'application/json', '{}');
  app.state.settings.haptics = false;
  app.call('nativeVibrate', 99);
  assert.deepEqual(calls, [
    ['vibrate', 25], ['showToast', 'hello'], ['shareText', 'title', 'body'],
    ['saveFile', 'a.json', 'application/json', '{}']
  ]);
});

test('browser fallbacks vibrate, alert, share or copy without AndroidBridge', async () => {
  const app = createApp();
  app.call('nativeVibrate', 12);
  app.call('nativeToast', 'preview');
  app.call('nativeSaveFile', 'backup.json', 'application/json', '{"ok":true}');
  assert.deepEqual(app.calls.vibrations, [12]);
  assert.deepEqual(app.calls.alerts, ['preview', 'Copied to clipboard!']);
  assert.deepEqual(app.calls.clipboard, ['{"ok":true}']);
  const shares = [];
  const shared = createApp({ navigator: { share: payload => { shares.push(plain(payload)); return Promise.reject(new Error('cancelled')); } } });
  shared.call('nativeShare', 'title', 'text');
  await Promise.resolve();
  assert.deepEqual(shares, [{ title: 'title', text: 'text' }]);
});

test('native reminder helper calls the sync bridge and degrades in browser preview', () => {
  const calls = [];
  const app = createApp({ bridge: { syncReminders: () => calls.push('sync') } });
  assert.equal(app.call('nativeSyncReminders'), true);
  assert.deepEqual(calls, ['sync']);

  const preview = createApp();
  assert.equal(preview.call('nativeSyncReminders'), false);
});

test('formatters retain currency grouping, relative dates and HTML escaping', () => {
  const app = createApp();
  assert.equal(app.call('formatCurrency', 123456.75), 'Rs. 1,23,456.75');
  app.state.settings.currency = '$';
  assert.equal(app.call('formatCurrency', null), '$ 0');
  assert.equal(app.call('formatDateHeader', new Date().toISOString()), 'Today');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  assert.equal(app.call('formatDateHeader', yesterday.toISOString()), 'Yesterday');
  assert.equal(app.call('escapeHtml', '<a title="x">&'), '&lt;a title=&quot;x&quot;&gt;&amp;');
  assert.equal(app.call('escapeHtml', null), '');
});

test('reminder helpers label schedules, clamp monthly dates and reject past one-time reminders', () => {
  const app = createApp();
  const now = new Date(2026, 0, 31, 10, 0, 0);
  const next = app.call('nextReminderDate', { date: '2026-01-31', time: '09:00', repeat: 'monthly' }, now);
  assert.equal(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`, '2026-02-28');
  assert.equal(app.call('nextReminderDate', { date: '2026-01-01', time: '09:00', repeat: 'none' }, now), null);
  assert.equal(app.call('reminderTimeLabel', '21:00'), '9:00 PM');
  assert.equal(app.call('reminderScheduleLabel', { date: '2026-12-20', time: '21:00', repeat: 'monthly' }), 'Monthly on 20 · 9:00 PM');
  assert.equal(app.call('reminderScheduleLabel', { date: '2026-12-20', time: '09:00', repeat: 'weekly' }), 'Every Sun · 9:00 AM');
});
