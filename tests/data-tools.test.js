'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function fileApp() {
  const files = [];
  return { app: createApp({ bridge: { saveFile: (...args) => files.push(args) } }), files };
}

test('CSV export has the established header, transfer fields and quoted multiline notes', () => {
  const { app, files } = fileApp();
  app.call('exportCsv');
  assert.equal(files.length, 0);
  assert.equal(app.calls.alerts.at(-1), 'No transactions to export');
  app.state.transactions.push({
    id: 't1', date: '2026-01-15', time: '10:30', type: 'transfer', amount: 123.5,
    categoryName: 'Transfer', account: 'Cash', toAccount: 'eSewa', note: 'A "quoted", note\nnext line'
  });
  app.call('exportCsv');
  assert.match(files[0][0], /^Paisa-Transactions-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.equal(files[0][1], 'text/csv');
  assert.equal(files[0][2], 'ID,Date,Time,Type,Amount,Currency,Category,Account,ToAccount,Note\n' +
    '"t1","2026-01-15","10:30","transfer",123.5,"Rs.","Transfer","Cash","eSewa","A ""quoted"", note\nnext line"\n');
});

test('JSON backup and restore round-trip transactions, custom banks and settings', () => {
  const { app, files } = fileApp();
  app.state.transactions.push({ id: 'restored', type: 'income', amount: 50, account: 'Nabil', date: '2026-01-15' });
  app.state.bankAccounts.push({ id: 'Nabil', name: 'Nabil' });
  app.state.settings.currency = '$';
  app.state.settings.biometricLock = false;
  app.state.settings.theme = 'dark';
  app.state.activeFilter = 'income';
  app.state.searchQuery = 'stale';
  app.state.editingTxId = 'restored';
  app.call('backupJson');
  assert.match(files[0][0], /^Paisa-Backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(files[0][1], 'application/json');
  const backup = JSON.parse(files[0][2]);
  assert.equal(backup.transactions[0].id, 'restored');
  assert.equal(backup.bankAccounts[0].id, 'Nabil');

  const restored = createApp();
  restored.restore(files[0][2]);
  assert.equal(restored.state.transactions[0].amount, 50);
  assert.equal(restored.state.bankAccounts[0].name, 'Nabil');
  assert.equal(restored.state.settings.biometricLock, false);
  assert.equal(restored.document.body.dataset.theme, 'dark');
  assert.equal(restored.state.activeFilter, 'all');
  assert.equal(restored.state.searchQuery, '');
  assert.equal(restored.state.editingTxId, null);
  assert.equal(restored.state.viewingTxId, null);
  assert.equal(restored.state.selectedType, 'expense');
  assert.equal(restored.state.selectedCat, 'food');
  assert.equal(JSON.parse(restored.storage.get('paisa_state')).transactions[0].id, 'restored');
  assert.equal(restored.calls.alerts.at(-1), 'Successfully restored backup!');
});

test('restore accepts legacy backups, rejects malformed structures and cancelled selection without data loss', () => {
  const app = createApp();
  app.restore('{"transactions":[]}');
  assert.equal(app.state.bankAccounts.length, 0);
  assert.equal(app.state.settings.currency, 'Rs.');
  assert.equal(app.state.settings.budget, 35000);
  assert.equal(app.state.settings.haptics, true);
  app.state.transactions.push({ id: 'keep' });
  for (const [content, message] of [
    ['{"transactions":{}}', 'Invalid backup file'],
    ['{}', 'Invalid backup file'],
    ['broken', 'Failed to read backup file']
  ]) {
    app.restore(content);
    assert.equal(app.state.transactions[0].id, 'keep');
    assert.equal(app.calls.alerts.at(-1), message);
  }
  const alerts = app.calls.alerts.length;
  app.call('handleFileRestore', { target: { files: [] } });
  assert.equal(app.calls.alerts.length, alerts);
  assert.equal(app.state.transactions[0].id, 'keep');
  let clicks = 0;
  app.element('restoreFileInput').addEventListener('click', () => clicks++);
  app.call('restoreJson');
  assert.equal(clicks, 1);
});
