'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('home-screen widget is declared and wired to the new transaction editor', () => {
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(manifest, /<receiver[\s\S]*android:name="\.NewTransactionWidget"[\s\S]*<\/receiver>/);
  assert.match(manifest, /android.appwidget.action.APPWIDGET_UPDATE/);
  assert.match(manifest, /android:resource="@xml\/new_transaction_widget_info"/);

  const provider = read('app/src/main/res/xml/new_transaction_widget_info.xml');
  assert.match(provider, /android:initialLayout="@layout\/widget_new_transaction"/);
  assert.match(provider, /android:minWidth="40dp"/);
  assert.match(provider, /android:minHeight="40dp"/);
  assert.match(provider, /android:resizeMode="none"/);

  const layout = read('app/src/main/res/layout/widget_new_transaction.xml');
  assert.match(layout, /android:id="@\+id\/widget_new_transaction"/);
  assert.equal((layout.match(/android:id="@\+id\//g) || []).length, 1);

  const widget = read('app/src/main/java/com/bespoke/paisa/NewTransactionWidget.java');
  assert.match(widget, /EXTRA_TRANSACTION_TYPE/);
  assert.match(widget, /R\.id\.widget_new_transaction/);
  assert.match(widget, /PendingIntent\.getActivity/);

  const activity = read('app/src/main/java/com/bespoke/paisa/MainActivity.java');
  assert.match(activity, /NewTransactionWidget\.EXTRA_TRANSACTION_TYPE/);
  assert.match(activity, /protected void onNewIntent\(Intent intent\)/);
  assert.match(activity, /biometricController\.grantWidgetAccess\(\)/);
  assert.match(activity, /openAddModal\(/);

  const bridge = read('app/src/main/java/com/bespoke/paisa/WebAppInterface.java');
  assert.match(bridge, /boolean shouldLockOnStart\(\)/);
});
