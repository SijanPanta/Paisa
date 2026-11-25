package com.bespoke.paisa;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

public class MainActivity extends Activity {

    private static final int THEME_LIGHT_BG = 0xFFF8F9FA;
    private static final int THEME_DARK_BG = 0xFF121316;

    private WebView webView;
    private BiometricController biometricController;
    private FileFlowController fileFlowController;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SharedPreferences prefs = getSharedPreferences("paisa_money_tracker", Context.MODE_PRIVATE);
        // Paint window/system bars in the saved theme before the first frame,
        // so the opening screen never flashes white with a dark theme.
        applySavedThemeColors(prefs);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        webView.setBackgroundColor(isDarkTheme(prefs) ? THEME_DARK_BG : THEME_LIGHT_BG);
        biometricController = new BiometricController(this, webView, prefs);
        fileFlowController = new FileFlowController(this);
        String widgetType = readWidgetType(getIntent());
        if (widgetType != null) {
            biometricController.grantWidgetAccess();
        }
        setupWebView(prefs, widgetType);

        biometricController.registerScreenLockReceiver();
        if (DailySpendReceiver.isReminderEnabled(this)) {
            DailySpendScheduler.schedule(this);
            requestNotificationPermissionIfNeeded();
        }
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String type = readWidgetType(intent);
        if (type != null) {
            biometricController.grantWidgetAccess();
            intent.removeExtra(NewTransactionWidget.EXTRA_TRANSACTION_TYPE);
            openTransactionEditor(type);
        }
    }

    private boolean isDarkTheme(SharedPreferences prefs) {
        try {
            String raw = prefs.getString("paisa_backup", null);
            if (raw != null) {
                JSONObject settings = new JSONObject(raw).optJSONObject("settings");
                if (settings != null) {
                    return "dark".equals(settings.optString("theme"));
                }
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private void applySavedThemeColors(SharedPreferences prefs) {
        boolean dark = isDarkTheme(prefs);
        int background = dark ? THEME_DARK_BG : THEME_LIGHT_BG;
        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(background));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(background);
            window.setNavigationBarColor(background);
            View decorView = window.getDecorView();
            int flags = decorView.getSystemUiVisibility();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = dark ? (flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
                        : (flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags = dark ? (flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
                        : (flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            }
            decorView.setSystemUiVisibility(flags);
        }
    }

    private void setupWebView(SharedPreferences prefs, final String pendingType) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                openTransactionEditor(pendingType);
            }
        });
        webView.setWebChromeClient(fileFlowController);
        webView.addJavascriptInterface(
            new WebAppInterface(this, prefs, biometricController, fileFlowController), "AndroidBridge");
    }

    private String readWidgetType(Intent intent) {
        if (intent == null) return null;
        return normalizeTransactionType(intent.getStringExtra(NewTransactionWidget.EXTRA_TRANSACTION_TYPE));
    }

    private String normalizeTransactionType(String type) {
        if ("expense".equals(type) || "income".equals(type) || "transfer".equals(type)) {
            return type;
        }
        return null;
    }

    private void openTransactionEditor(String type) {
        String safeType = normalizeTransactionType(type);
        if (safeType == null || webView == null) return;
        webView.evaluateJavascript(
            "if (typeof openAddModal === 'function') { openAddModal('" + safeType + "'); }", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        biometricController.onPause();
    }

    @Override
    protected void onStop() {
        super.onStop();
        biometricController.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        biometricController.onResume();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        biometricController.onDestroy();
    }

    void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 2001);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (!fileFlowController.onActivityResult(requestCode, resultCode, data)) {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        // Dispatch back event to webview so it can close modal/bottom sheets first
        webView.evaluateJavascript(
            "if (window.handleAndroidBack && window.handleAndroidBack()) { true; } else { false; }",
            value -> {
                if (!"true".equals(value)) {
                    super.onBackPressed();
                }
            }
        );
    }
}
