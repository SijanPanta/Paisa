'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./frontend-fixture');

function sessionBridge() {
  let authenticated = true;
  let prompts = 0;
  return {
    isBiometricSupported: () => true,
    shouldLockOnStart: () => true,
    isSessionUnlocked: () => authenticated,
    setSessionUnlocked: value => { authenticated = value; },
    authenticateBiometric: () => { prompts++; },
    refreshActiveTimestamp() {},
    get prompts() { return prompts; }
  };
}

test('cancelling a fresh unlock invalidates the previous session across resume and recreation', () => {
  const bridge = sessionBridge();
  const app = createApp({ bridge });
  app.start();
  app.flushTimers();
  assert.equal(bridge.isSessionUnlocked(), false, 'showing the lock must revoke the previous session');
  assert.equal(bridge.prompts, 1);

  app.call('onBiometricError', 'Authentication cancelled', 10, 'unlock');
  app.touch();
  assert.equal(app.state.isLocked, true);
  assert.equal(bridge.isSessionUnlocked(), false);

  app.call(bridge.isSessionUnlocked() ? 'onAppResumeUnlocked' : 'onAppRequireLock');
  app.flushTimers();
  assert.equal(app.state.isLocked, true, 'resuming after cancellation must not expose the app');
  assert.equal(bridge.prompts, 2);

  const recreated = createApp({ bridge });
  recreated.start();
  recreated.flushTimers();
  assert.equal(recreated.state.isLocked, true);
  assert.equal(bridge.isSessionUnlocked(), false);
  assert.equal(bridge.prompts, 3);

  bridge.setSessionUnlocked(true);
  recreated.call('onBiometricSuccess', 'unlock');
  recreated.flushTimers();
  assert.equal(recreated.state.isLocked, false);
});

test('a stale resume-unlocked callback cannot dismiss an explicit lock or cancelled prompt', () => {
  const app = createApp({ bridge: sessionBridge() });
  app.start();
  app.flushTimers();
  app.call('onAppResumeUnlocked');
  app.flushTimers();
  assert.equal(app.state.isLocked, true);
  app.call('onBiometricError', 'Authentication cancelled', 10, 'unlock');
  app.call('onAppResumeUnlocked');
  app.flushTimers();
  assert.equal(app.state.isLocked, true);
  assert.equal(app.element('biometricLockOverlay').style.display, 'flex');
});

test('widget/trusted start skips the fingerprint prompt and keeps the app unlocked', () => {
  let unlockedCalls = 0;
  const bridge = {
    isBiometricSupported: () => true,
    shouldLockOnStart: () => false,
    isSessionUnlocked: () => true,
    setSessionUnlocked: value => { if (value) unlockedCalls++; },
    authenticateBiometric: () => { throw new Error('widget must not prompt'); },
    refreshActiveTimestamp() {}
  };
  const app = createApp({ bridge });
  app.start();
  app.flushTimers();
  assert.equal(app.state.isLocked, false);
  assert.equal(app.element('biometricLockOverlay').classList.contains('hidden'), true);
  assert.equal(app.element('biometricLockOverlay').style.display, 'none');
  assert.ok(unlockedCalls >= 1, 'native session is refreshed as unlocked');
});

test('cancelling security-setting verification preserves the existing unlocked session', () => {
  const bridge = sessionBridge();
  const app = createApp({ bridge });
  app.call('triggerBiometricAuth', 'toggle');
  app.call('onBiometricError', 'Authentication cancelled', 10, 'toggle');
  assert.equal(bridge.isSessionUnlocked(), true);
  assert.equal(app.state.isLocked, false);
  assert.equal(app.state.settings.biometricLock, true);
});
