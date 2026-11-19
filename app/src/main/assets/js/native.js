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
