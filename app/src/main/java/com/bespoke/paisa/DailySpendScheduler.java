package com.bespoke.paisa;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Calendar;

public final class DailySpendScheduler {

    private static final int DAILY_HOUR = 21;
    private static final int DAILY_MINUTE = 0;

    private DailySpendScheduler() {}

    static void schedule(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pendingIntent(context, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());

        Calendar next = nextFireTime();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                am.setExact(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
            }
        } catch (Exception ignored) {
            try {
                am.set(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
            } catch (Exception ignoredAgain) {
            }
        }
    }

    static Calendar nextFireTime() {
        Calendar now = Calendar.getInstance();
        Calendar next = (Calendar) now.clone();
        next.set(Calendar.HOUR_OF_DAY, DAILY_HOUR);
        next.set(Calendar.MINUTE, DAILY_MINUTE);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (!next.after(now)) {
            next.add(Calendar.DAY_OF_YEAR, 1);
        }
        return next;
    }

    static String nextLabel() {
        Calendar now = Calendar.getInstance();
        Calendar next = nextFireTime();
        boolean sameDay = now.get(Calendar.YEAR) == next.get(Calendar.YEAR)
                && now.get(Calendar.DAY_OF_YEAR) == next.get(Calendar.DAY_OF_YEAR);
        return sameDay ? "Today, 9:00 PM" : "Tomorrow, 9:00 PM";
    }

    static void cancel(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pendingIntent(context, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
        am.cancel(pi);
        pi.cancel();
    }

    private static PendingIntent pendingIntent(Context context, int flags) {
        Intent intent = new Intent(context, DailySpendReceiver.class);
        intent.setAction(DailySpendReceiver.ACTION_DAILY_SPEND);
        return PendingIntent.getBroadcast(context, 2001, intent, flags);
    }

    private static int immutableFlag() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return PendingIntent.FLAG_IMMUTABLE;
        }
        return 0;
    }
}
