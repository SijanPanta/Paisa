package com.bespoke.paisa;

import android.app.Activity;
import android.animation.ValueAnimator;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

public final class WebAppInterface {

    private final Activity activity;
    private final SharedPreferences prefs;
    private final Vibrator vibrator;
    private final BiometricController biometricController;
    private final FileFlowController fileFlowController;
    private ValueAnimator statusAnimator;
    private ValueAnimator navigationBarAnimator;

    WebAppInterface(Activity activity, SharedPreferences prefs,
                    BiometricController biometricController, FileFlowController fileFlowController) {
        this.activity = activity;
        this.prefs = prefs;
        this.vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        this.biometricController = biometricController;
        this.fileFlowController = fileFlowController;
    }

    @JavascriptInterface
    public void vibrate(long milliseconds) {
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(milliseconds);
            }
        }
    }

    @JavascriptInterface
    public void showToast(final String message) {
        activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface
    public void shareText(final String title, final String text) {
        activity.runOnUiThread(() -> {
            Intent sendIntent = new Intent();
            sendIntent.setAction(Intent.ACTION_SEND);
            sendIntent.putExtra(Intent.EXTRA_TITLE, title);
            sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            sendIntent.setType("text/plain");
            Intent shareIntent = Intent.createChooser(sendIntent, title);
            activity.startActivity(shareIntent);
        });
    }

    @JavascriptInterface
    public void saveFile(final String fileName, final String mimeType, final String content) {
        fileFlowController.saveFile(fileName, mimeType, content);
    }

    @JavascriptInterface
    public void saveData(String key, String value) {
        prefs.edit().putString(key, value).apply();
    }

    @JavascriptInterface
    public String getData(String key, String defVal) {
        return prefs.getString(key, defVal);
    }

    @JavascriptInterface
    public void setStatusBarColor(final String colorHex, final boolean lightStatusBar) {
        activity.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                Window window = activity.getWindow();
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                try {
                    final int color = Color.parseColor(colorHex);

                    // Cross-fade the system bars with the page theme instead of snapping.
                    if (statusAnimator != null) statusAnimator.cancel();
                    if (navigationBarAnimator != null) navigationBarAnimator.cancel();
                    statusAnimator = animateColor(window.getStatusBarColor(), color,
                            value -> window.setStatusBarColor(value));
                    navigationBarAnimator = animateColor(window.getNavigationBarColor(), color,
                            value -> window.setNavigationBarColor(value));

                    View webView = activity.findViewById(R.id.webview);
                    if (webView != null) {
                        webView.setBackgroundColor(color);
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        View decorView = window.getDecorView();
                        int flags = decorView.getSystemUiVisibility();
                        if (lightStatusBar) {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        } else {
                            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            if (lightStatusBar) {
                                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                            } else {
                                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                            }
                        }
                        decorView.setSystemUiVisibility(flags);
                    }
                } catch (Exception ignored) {}
            }
        });
    }

    private ValueAnimator animateColor(int from, int to, final java.util.function.IntConsumer apply) {
        ValueAnimator animator = ValueAnimator.ofArgb(from, to);
        animator.setDuration(240L);
        animator.addUpdateListener(animation -> apply.accept((Integer) animation.getAnimatedValue()));
        animator.start();
        return animator;
    }

    @JavascriptInterface
    public boolean isBiometricSupported() {
        return biometricController.isBiometricSupported();
    }

    @JavascriptInterface
    public void authenticateBiometric(final String reason, final String contextId) {
        biometricController.authenticateBiometric(reason, contextId);
    }

    @JavascriptInterface
    public boolean shouldLockOnStart() {
        return biometricController.shouldLockOnStart();
    }

    @JavascriptInterface
    public void setSessionUnlocked(boolean unlocked) {
        biometricController.setSessionUnlocked(unlocked);
    }

    @JavascriptInterface
    public void refreshActiveTimestamp() {
        biometricController.refreshActiveTimestamp();
    }

    @JavascriptInterface
    public void setDailySpendReminderEnabled(boolean enabled) {
        DailySpendReceiver.setReminderEnabled(activity, enabled);
        ReminderScheduler.sync(activity);
        if (enabled && activity instanceof MainActivity) {
            activity.runOnUiThread(((MainActivity) activity)::requestNotificationPermissionIfNeeded);
        }
    }

    @JavascriptInterface
    public String getNextReminderLabel() {
        return DailySpendScheduler.nextLabel();
    }

    @JavascriptInterface
    public void syncReminders() {
        ReminderScheduler.sync(activity);
    }
}
