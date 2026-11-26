// ── NATIVE BRIDGE HELPERS ──────────────────────────────────────
function nativeVibrate(ms = 25) {
  if (!state.settings.haptics) return;
  if (window.AndroidBridge && window.AndroidBridge.vibrate) {
    window.AndroidBridge.vibrate(ms);
  } else if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

function nativeToast(msg) {
  if (window.AndroidBridge && window.AndroidBridge.showToast) {
    window.AndroidBridge.showToast(msg);
  } else {
    alert(msg);
  }
}

function nativeShare(title, text) {
  if (window.AndroidBridge && window.AndroidBridge.shareText) {
    window.AndroidBridge.shareText(title, text);
  } else if (navigator.share) {
    navigator.share({ title, text }).catch(() => {});
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(text);
    nativeToast('Copied to clipboard!');
  }
}

function nativeSaveFile(fileName, mimeType, content) {
  if (window.AndroidBridge && window.AndroidBridge.saveFile) {
    window.AndroidBridge.saveFile(fileName, mimeType, content);
  } else {
    // Browser preview fallback: share as text
    nativeShare(fileName, content);
  }
}

function nativeCanPostNotifications() {
  if (!window.AndroidBridge || !window.AndroidBridge.canPostNotifications) return true;
  return !!window.AndroidBridge.canPostNotifications();
}

function nativeNextReminderLabel() {
  if (!window.AndroidBridge || !window.AndroidBridge.getNextReminderLabel) return '';
  return window.AndroidBridge.getNextReminderLabel() || '';
}

function nativeSendTestNotification() {
  if (window.AndroidBridge && window.AndroidBridge.sendTestNotification) {
    window.AndroidBridge.sendTestNotification();
    return true;
  }
  nativeToast('Test notifications are only available in the Android app');
  return false;
}

function nativeSyncReminders() {
  if (window.AndroidBridge && window.AndroidBridge.syncReminders) {
    window.AndroidBridge.syncReminders();
    return true;
  }
  return false;
}

function nativeSendTestReminder(id) {
  if (window.AndroidBridge && window.AndroidBridge.sendTestReminder) {
    window.AndroidBridge.sendTestReminder(id);
    return true;
  }
  nativeToast('Test notifications are only available in the Android app');
  return false;
}

function nativeOpenNotificationSettings() {
  if (window.AndroidBridge && window.AndroidBridge.openNotificationSettings) {
    window.AndroidBridge.openNotificationSettings();
  } else {
    nativeToast('Notification settings are only available in the Android app');
  }
}
