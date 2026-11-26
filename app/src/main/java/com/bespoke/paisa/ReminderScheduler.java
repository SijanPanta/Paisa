package com.bespoke.paisa;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

public final class ReminderScheduler {

    static final String ACTION_CUSTOM_REMINDER = "com.bespoke.paisa.action.CUSTOM_REMINDER";
    static final String EXTRA_REMINDER_ID = "reminder_id";

    private static final String PREFS_NAME = "paisa_money_tracker";
    private static final String BACKUP_KEY = "paisa_backup";
    private static final String SCHEDULED_KEY = "paisa_scheduled_reminders";

    private ReminderScheduler() {}

    static void sync(Context context) {
        cancelAll(context);
        JSONObject root = readRoot(context);
        JSONObject settings = root.optJSONObject("settings");
        if (settings != null && settings.optBoolean("dailySpendReminder", false)) {
            DailySpendScheduler.schedule(context);
        }

        JSONArray reminders = root.optJSONArray("reminders");
        JSONArray scheduled = new JSONArray();
        if (reminders != null) {
            Calendar now = Calendar.getInstance();
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject reminder = reminders.optJSONObject(i);
                if (reminder == null || !reminder.optBoolean("enabled", true)) continue;
                String id = reminder.optString("id", "");
                if (id.isEmpty()) continue;
                Calendar next = nextOccurrence(reminder, now);
                if (next == null) continue;
                schedule(context, id, next);
                scheduled.put(id);
            }
        }
        prefs(context).edit().putString(SCHEDULED_KEY, scheduled.toString()).apply();
    }

    static boolean hasEnabledReminders(Context context) {
        JSONArray reminders = readRoot(context).optJSONArray("reminders");
        if (reminders == null) return false;
        Calendar now = Calendar.getInstance();
        for (int i = 0; i < reminders.length(); i++) {
            JSONObject reminder = reminders.optJSONObject(i);
            if (reminder == null || !reminder.optBoolean("enabled", true)) continue;
            if (reminder.optString("id", "").isEmpty()) continue;
            if (nextOccurrence(reminder, now) != null) return true;
        }
        return false;
    }

    static JSONObject findReminder(Context context, String id) {
        if (id == null || id.isEmpty()) return null;
        JSONArray reminders = readRoot(context).optJSONArray("reminders");
        if (reminders == null) return null;
        for (int i = 0; i < reminders.length(); i++) {
            JSONObject reminder = reminders.optJSONObject(i);
            if (reminder != null && id.equals(reminder.optString("id", ""))) return reminder;
        }
        return null;
    }

    static void setEnabled(Context context, String id, boolean enabled) {
        JSONObject root = readRoot(context);
        JSONArray reminders = root.optJSONArray("reminders");
        if (reminders == null) return;
        for (int i = 0; i < reminders.length(); i++) {
            JSONObject reminder = reminders.optJSONObject(i);
            if (reminder != null && id.equals(reminder.optString("id", ""))) {
                try {
                    reminder.put("enabled", enabled);
                } catch (Exception ignored) {
                }
                writeRoot(context, root);
                sync(context);
                return;
            }
        }
    }

    static Calendar nextOccurrence(JSONObject reminder, Calendar now) {
        String date = reminder.optString("date", "");
        String time = reminder.optString("time", "09:00");
        if (date.length() != 10 || time.length() < 5) return null;
        try {
            String[] dateParts = date.split("-");
            String[] timeParts = time.split(":");
            int year = Integer.parseInt(dateParts[0]);
            int month = Integer.parseInt(dateParts[1]) - 1;
            int day = Integer.parseInt(dateParts[2]);
            int hour = Integer.parseInt(timeParts[0]);
            int minute = Integer.parseInt(timeParts[1]);
            if (month < 0 || month > 11 || day < 1 || day > 31 || hour < 0 || hour > 23
                    || minute < 0 || minute > 59) return null;

            Calendar candidate = Calendar.getInstance();
            candidate.clear();
            candidate.set(year, month, day, hour, minute, 0);
            candidate.set(Calendar.MILLISECOND, 0);
            String repeat = reminder.optString("repeat", "none");

            if ("daily".equals(repeat)) {
                while (!candidate.after(now)) candidate.add(Calendar.DAY_OF_YEAR, 1);
            } else if ("weekly".equals(repeat)) {
                while (!candidate.after(now)) candidate.add(Calendar.DAY_OF_YEAR, 7);
            } else if ("monthly".equals(repeat)) {
                int targetDay = candidate.get(Calendar.DAY_OF_MONTH);
                while (!candidate.after(now)) {
                    candidate.set(Calendar.DAY_OF_MONTH, 1);
                    candidate.add(Calendar.MONTH, 1);
                    candidate.set(Calendar.DAY_OF_MONTH,
                            Math.min(targetDay, candidate.getActualMaximum(Calendar.DAY_OF_MONTH)));
                }
            } else if (!"none".equals(repeat) || !candidate.after(now)) {
                return null;
            }
            return candidate;
        } catch (Exception ignored) {
            return null;
        }
    }

    static void schedule(Context context, String id, Calendar at) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pendingIntent(context, id, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.getTimeInMillis(), pi);
        } catch (Exception ignored) {
            try {
                am.set(AlarmManager.RTC_WAKEUP, at.getTimeInMillis(), pi);
            } catch (Exception ignoredAgain) {
            }
        }
    }

    static int notificationId(String id) {
        return requestCode(id);
    }

    private static void cancelAll(Context context) {
        DailySpendScheduler.cancel(context);
        try {
            JSONArray ids = new JSONArray(prefs(context).getString(SCHEDULED_KEY, "[]"));
            for (int i = 0; i < ids.length(); i++) {
                String id = ids.optString(i, "");
                if (!id.isEmpty()) cancel(context, id);
            }
        } catch (Exception ignored) {
        }
    }

    private static void cancel(Context context, String id) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pendingIntent(context, id, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        pi.cancel();
    }

    private static PendingIntent pendingIntent(Context context, String id, int flags) {
        Intent intent = new Intent(context, DailySpendReceiver.class);
        intent.setAction(ACTION_CUSTOM_REMINDER);
        intent.putExtra(EXTRA_REMINDER_ID, id);
        return PendingIntent.getBroadcast(context, requestCode(id), intent, flags);
    }

    private static int requestCode(String id) {
        return 3000 + (id.hashCode() & 0x7fffffff) % 100000;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static JSONObject readRoot(Context context) {
        String raw = prefs(context).getString(BACKUP_KEY, null);
        if (raw == null) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    static void writeRoot(Context context, JSONObject root) {
        prefs(context).edit().putString(BACKUP_KEY, root.toString()).apply();
    }
}
