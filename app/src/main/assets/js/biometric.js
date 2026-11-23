// ── BIOMETRIC / FINGERPRINT CONTROLLER ─────────────────────────
let biometricPromptActive = false;

function isBiometricSupported() {
  if (window.AndroidBridge && window.AndroidBridge.isBiometricSupported) {
    try {
      return window.AndroidBridge.isBiometricSupported();
    } catch (e) {
      return false;
    }
  }
  return false;
}

function lockApp() {
  if (state.settings.biometricLock === false) return;
  if (!isBiometricSupported()) return;
  state.isLocked = true;
  // An explicit lock revokes any earlier native grace-period session.
  if (window.AndroidBridge && window.AndroidBridge.setSessionUnlocked) {
    window.AndroidBridge.setSessionUnlocked(false);
  }
  const overlay = document.getElementById('biometricLockOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    const hint = document.getElementById('lockStatusHint');
    if (hint) hint.innerHTML = 'Touch fingerprint sensor';
  }
}

function unlockApp() {
  state.isLocked = false;
  biometricPromptActive = false;
  const overlay = document.getElementById('biometricLockOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => {
      if (!state.isLocked) overlay.style.display = 'none';
    }, 280);
  }
}

function triggerBiometricAuth(contextId = 'unlock') {
  if (biometricPromptActive) return;
  nativeVibrate(20);
  if (window.AndroidBridge && window.AndroidBridge.authenticateBiometric) {
    biometricPromptActive = true;
    const hint = document.getElementById('lockStatusHint');
    if (hint && contextId === 'unlock') {
      hint.innerHTML = 'Scan fingerprint...';
    }
    window.AndroidBridge.authenticateBiometric(
      contextId === 'toggle' ? "Confirm fingerprint to change security setting" : "Verify fingerprint to open Paisa",
      contextId
    );
  } else {
    unlockApp();
  }
}

window.onBiometricSuccess = function(contextId) {
  biometricPromptActive = false;
  nativeVibrate(35);
  if (contextId === 'toggle') {
    state.settings.biometricLock = !state.settings.biometricLock;
    saveState();
    renderSettings();
    nativeToast('Fingerprint lock ' + (state.settings.biometricLock ? 'enabled' : 'disabled'));
  } else {
    unlockApp();
  }
};

window.onBiometricFailed = function(contextId) {
  nativeVibrate(45);
  const hint = document.getElementById('lockStatusHint');
  if (hint) {
    hint.innerHTML = '<span style="color:var(--expense)">Fingerprint not recognized. Try again.</span>';
  }
};

window.onBiometricError = function(errMsg, errorCode, contextId) {
  biometricPromptActive = false;
  const hint = document.getElementById('lockStatusHint');
  if (errorCode === 10 || (errMsg && errMsg.toLowerCase().includes('cancel'))) {
    if (hint) hint.innerHTML = 'Verification cancelled. Tap to retry.';
  } else {
    if (hint) hint.innerHTML = `<span style="color:var(--expense)">${escapeHtml(errMsg || 'Verification failed')}</span>`;
  }
};

window.onAppRequireLock = function() {
  if (state.settings.biometricLock === false) return;
  if (!isBiometricSupported()) return;
  lockApp();
  setTimeout(() => triggerBiometricAuth('unlock'), 250);
};

window.onAppResumeUnlocked = function() {
  // Only authentication success may dismiss an already-visible lock.
  if (state.isLocked) return;
  unlockApp();
};

function initializeBiometricLock() {
  const bridge = window.AndroidBridge;
  const nativeRequiresLock = bridge && typeof bridge.shouldLockOnStart === 'function'
    ? bridge.shouldLockOnStart()
    : true;
  const securityEnabled = state.settings.biometricLock !== false && isBiometricSupported();

  if (securityEnabled && nativeRequiresLock) {
    lockApp();
    setTimeout(() => triggerBiometricAuth('unlock'), 350);
  } else {
    if (bridge && typeof bridge.setSessionUnlocked === 'function') {
      bridge.setSessionUnlocked(true);
    }
    unlockApp();
  }

  // Refresh active session timestamp while user touches/interacts with app
  window.addEventListener('touchstart', () => {
    if (window.AndroidBridge && window.AndroidBridge.refreshActiveTimestamp) {
      window.AndroidBridge.refreshActiveTimestamp();
    }
  }, { passive: true });
}
