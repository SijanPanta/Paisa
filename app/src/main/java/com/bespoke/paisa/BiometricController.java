package com.bespoke.paisa;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.hardware.fingerprint.FingerprintManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.webkit.WebView;

import org.json.JSONObject;

final class BiometricController {

    private static final long BIOMETRIC_TIMEOUT_MS = 5 * 60 * 1000L;
    private static final long WIDGET_TRUST_MS = 10 * 1000L;

    private final Activity activity;
    private final WebView webView;
    private final SharedPreferences prefs;
    private CancellationSignal biometricCancellationSignal;
    private long lastActiveTimestamp;
    private boolean isSessionAuthenticated;
    private boolean shouldForceBiometricOnResume = false;
    private long widgetTrustedUntil;
    private BroadcastReceiver screenReceiver;

    BiometricController(Activity activity, WebView webView, SharedPreferences prefs) {
        this.activity = activity;
        this.webView = webView;
        this.prefs = prefs;
        // Restore session state — survives process death within 5-min window
        lastActiveTimestamp = prefs.getLong("bio_last_active", 0);
        isSessionAuthenticated = prefs.getBoolean("bio_session_auth", false);
    }

    void registerScreenLockReceiver() {
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    shouldForceBiometricOnResume = true;
                    isSessionAuthenticated = false;
                    persistBiometricSession();
                    if (webView != null) {
                        webView.evaluateJavascript("if (window.lockApp) { window.lockApp(); }", null);
                    }
                }
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(screenReceiver, filter);
        }
    }

    boolean isBiometricSupported() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager bm = activity.getSystemService(BiometricManager.class);
            if (bm != null) {
                int can = bm.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG |
                    BiometricManager.Authenticators.BIOMETRIC_WEAK |
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                );
                return can == BiometricManager.BIOMETRIC_SUCCESS;
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            BiometricManager bm = activity.getSystemService(BiometricManager.class);
            if (bm != null) {
                return bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            FingerprintManager fm = (FingerprintManager) activity.getSystemService(Context.FINGERPRINT_SERVICE);
            if (fm != null && fm.isHardwareDetected() && fm.hasEnrolledFingerprints()) {
                return true;
            }
        }
        KeyguardManager km = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
        return km != null && km.isKeyguardSecure();
    }

    void authenticateBiometric(final String reason, final String contextId) {
        activity.runOnUiThread(() -> {
            if (!"toggle".equals(contextId)) {
                setSessionUnlocked(false);
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
                sendBiometricError("Biometric not supported on this Android version", 1, contextId);
                return;
            }

            if (biometricCancellationSignal != null && !biometricCancellationSignal.isCanceled()) {
                biometricCancellationSignal.cancel();
            }
            biometricCancellationSignal = new CancellationSignal();

            BiometricPrompt.Builder builder = new BiometricPrompt.Builder(activity)
                .setTitle("Paisa");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG |
                    BiometricManager.Authenticators.BIOMETRIC_WEAK |
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                );
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setDeviceCredentialAllowed(true);
            } else {
                builder.setNegativeButton("Cancel", activity.getMainExecutor(), (dialog, which) -> {
                    sendBiometricError("Authentication cancelled", BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED, contextId);
                });
            }

            try {
                BiometricPrompt prompt = builder.build();
                prompt.authenticate(biometricCancellationSignal, activity.getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        sendBiometricSuccess(contextId);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        sendBiometricError(errString != null ? errString.toString() : "Authentication error", errorCode, contextId);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        sendBiometricFailed(contextId);
                    }
                });
            } catch (Exception e) {
                sendBiometricError(e.getMessage() != null ? e.getMessage() : "Failed to launch biometric authentication", -1, contextId);
            }
        });
    }

    boolean isSessionUnlocked() {
        if (!isBiometricSupported()) return true;
        return !shouldLockOnStart();
    }

    boolean shouldLockOnStart() {
        long now = System.currentTimeMillis();
        if (now < widgetTrustedUntil) return false;
        if (shouldForceBiometricOnResume) return true;
        if (!isSessionAuthenticated) return true;
        KeyguardManager km = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isKeyguardLocked()) return true;
        long elapsed = now - lastActiveTimestamp;
        return lastActiveTimestamp <= 0 || elapsed < 0 || elapsed >= BIOMETRIC_TIMEOUT_MS;
    }

    void grantWidgetAccess() {
        shouldForceBiometricOnResume = false;
        isSessionAuthenticated = true;
        widgetTrustedUntil = System.currentTimeMillis() + WIDGET_TRUST_MS;
        lastActiveTimestamp = System.currentTimeMillis();
        persistBiometricSession();
    }

    void setSessionUnlocked(boolean unlocked) {
        isSessionAuthenticated = unlocked;
        if (unlocked) {
            shouldForceBiometricOnResume = false;
            lastActiveTimestamp = System.currentTimeMillis();
        } else {
            shouldForceBiometricOnResume = true;
        }
        persistBiometricSession();
    }

    void refreshActiveTimestamp() {
        if (isSessionAuthenticated) {
            lastActiveTimestamp = System.currentTimeMillis();
            prefs.edit().putLong("bio_last_active", lastActiveTimestamp).apply();
        }
    }

    private void persistBiometricSession() {
        prefs.edit()
            .putBoolean("bio_session_auth", isSessionAuthenticated)
            .putLong("bio_last_active", lastActiveTimestamp)
            .apply();
    }

    private void sendBiometricSuccess(final String contextId) {
        if (!"toggle".equals(contextId)) {
            isSessionAuthenticated = true;
            shouldForceBiometricOnResume = false;
            lastActiveTimestamp = System.currentTimeMillis();
            persistBiometricSession();
        }
        activity.runOnUiThread(() -> {
            String script = String.format("if (window.onBiometricSuccess) { window.onBiometricSuccess(%s); }",
                JSONObject.quote(contextId != null ? contextId : ""));
            webView.evaluateJavascript(script, null);
        });
    }

    private void sendBiometricError(final String errString, final int errorCode, final String contextId) {
        activity.runOnUiThread(() -> {
            if (!"toggle".equals(contextId)) {
                setSessionUnlocked(false);
            }
            String script = String.format("if (window.onBiometricError) { window.onBiometricError(%s, %d, %s); }",
                JSONObject.quote(errString != null ? errString : "Authentication failed"),
                errorCode,
                JSONObject.quote(contextId != null ? contextId : ""));
            webView.evaluateJavascript(script, null);
        });
    }

    private void sendBiometricFailed(final String contextId) {
        activity.runOnUiThread(() -> {
            String script = String.format("if (window.onBiometricFailed) { window.onBiometricFailed(%s); }",
                JSONObject.quote(contextId != null ? contextId : ""));
            webView.evaluateJavascript(script, null);
        });
    }

    void onPause() {
        if (isSessionAuthenticated) {
            lastActiveTimestamp = System.currentTimeMillis();
        }
        KeyguardManager km = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isKeyguardLocked()) {
            shouldForceBiometricOnResume = true;
            isSessionAuthenticated = false;
        }
        persistBiometricSession();
    }

    void onStop() {
        if (biometricCancellationSignal != null && !biometricCancellationSignal.isCanceled()) {
            biometricCancellationSignal.cancel();
            biometricCancellationSignal = null;
        }
    }

    void onResume() {
        checkAndDispatchBiometricRequirement();
    }

    private void checkAndDispatchBiometricRequirement() {
        if (shouldLockOnStart()) {
            isSessionAuthenticated = false;
            persistBiometricSession();
            if (webView != null) {
                webView.evaluateJavascript("if (window.onAppRequireLock) { window.onAppRequireLock(); }", null);
            }
        } else {
            isSessionAuthenticated = true;
            lastActiveTimestamp = System.currentTimeMillis();
            shouldForceBiometricOnResume = false;
            persistBiometricSession();
            if (webView != null) {
                webView.evaluateJavascript("if (window.onAppResumeUnlocked) { window.onAppResumeUnlocked(); }", null);
            }
        }
    }

    void onDestroy() {
        if (screenReceiver != null) {
            try {
                activity.unregisterReceiver(screenReceiver);
            } catch (Exception ignored) {}
        }
    }
}
