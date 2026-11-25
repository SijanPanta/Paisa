package com.bespoke.paisa;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

public class DailySpendReceiver extends BroadcastReceiver {

    static final String CHANNEL_ID = "daily_spend";
    static final String ACTION_DAILY_SPEND = "com.bespoke.paisa.action.DAILY_SPEND";
    private static final String PREFS_NAME = "paisa_money_tracker";
    private static final String BACKUP_KEY = "paisa_backup";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            if (isReminderEnabled(context)) {
                DailySpendScheduler.schedule(context);
            }
            return;
        }
        if (!ACTION_DAILY_SPEND.equals(action)) return;

        if (isReminderEnabled(context)) {
            showSummary(context);
            DailySpendScheduler.schedule(context);
        }
    }

    static boolean isReminderEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        try {
            String raw = prefs.getString(BACKUP_KEY, null);
            if (raw == null) return false;
            JSONObject settings = new JSONObject(raw).optJSONObject("settings");
            return settings != null && settings.optBoolean("dailySpendReminder", false);
        } catch (Exception ignored) {
            return false;
        }
    }

    static void showSummary(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(BACKUP_KEY, null);
        if (raw == null) return;

        try {
            JSONObject root = new JSONObject(raw);
            JSONObject settings = root.optJSONObject("settings");
            String currency = settings != null ? settings.optString("currency", "Rs.") : "Rs.";
            JSONArray transactions = root.optJSONArray("transactions");
            if (transactions == null) transactions = new JSONArray();

            Calendar now = Calendar.getInstance();
            int year = now.get(Calendar.YEAR);
            int month = now.get(Calendar.MONTH);
            int day = now.get(Calendar.DAY_OF_MONTH);

            double total = 0;
            int count = 0;
            for (int i = 0; i < transactions.length(); i++) {
                JSONObject tx = transactions.optJSONObject(i);
                if (tx == null) continue;
                if (!isSpendToday(tx, year, month, day)) continue;
                total += Math.abs(tx.optDouble("amount", 0));
                count++;
            }

            String amount = formatCurrency(currency, total);
            String title = "Today's spending";
            if (total > 2000) {
                title = "Slow down, champ";
            } else if (total < 100) {
                title = "You poor bastard";
            }
            String text = count == 0
                    ? "No spending recorded today."
                    : "You spent " + amount + " today across " + count + " transaction" + (count == 1 ? "" : "s") + ".";

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            ensureChannel(nm);

            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 1001, openIntent, flags);

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(context, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(context);
            }
            builder.setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setStyle(new Notification.BigTextStyle().bigText(text))
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                nm.notify(2001, builder.build());
            } else {
                nm.notify(2001, builder.getNotification());
            }
        } catch (Exception ignored) {
        }
    }

    static boolean isSpendToday(JSONObject tx, int year, int month, int day) {
        String type = tx.optString("type", "");
        String account = tx.optString("account", "");
        String toAccount = tx.optString("toAccount", "");
        String categoryId = tx.optString("categoryId", "");
        String categoryName = tx.optString("categoryName", "");

        boolean isSavingsAccount = "Savings".equals(account);
        boolean isSavingsDeposit = "transfer".equals(type) && "Savings".equals(toAccount);
        boolean isNonSpendExpense = "expense".equals(type)
                && ("free_transfer".equals(categoryId) || "Free Transfer".equals(categoryName));
        boolean spends = ("expense".equals(type) && !isSavingsAccount && !isNonSpendExpense) || isSavingsDeposit;
        if (!spends) return false;

        Calendar txDate = parseDate(tx.optString("date", ""));
        if (txDate == null) return false;
        return txDate.get(Calendar.YEAR) == year
                && txDate.get(Calendar.MONTH) == month
                && txDate.get(Calendar.DAY_OF_MONTH) == day;
    }

    static Calendar parseDate(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        try {
            java.text.SimpleDateFormat sdf;
            if (raw.length() >= 24 && raw.charAt(23) == 'Z') {
                sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            } else if (raw.length() >= 20 && raw.charAt(19) == 'Z') {
                sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
            } else if (raw.length() >= 19) {
                sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
                sdf.setTimeZone(java.util.TimeZone.getDefault());
                java.util.Date parsed = sdf.parse(raw.substring(0, 19));
                if (parsed == null) return null;
                Calendar c = Calendar.getInstance();
                c.setTime(parsed);
                return c;
            } else {
                return null;
            }
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.util.Date parsed = sdf.parse(raw);
            if (parsed == null) return null;
            Calendar c = Calendar.getInstance();
            c.setTime(parsed);
            return c;
        } catch (Exception ignored) {
            return null;
        }
    }

    static String formatCurrency(String currency, double amount) {
        long rounded = Math.round(amount);
        NumberFormat nf = NumberFormat.getInstance(Locale.ENGLISH);
        nf.setGroupingUsed(true);
        nf.setMaximumFractionDigits(0);
        return currency + " " + nf.format(rounded);
    }

    static void ensureChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Daily spending", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Daily summary of your spending");
            nm.createNotificationChannel(channel);
        }
    }
}
