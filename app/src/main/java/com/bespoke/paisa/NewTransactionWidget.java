package com.bespoke.paisa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

public class NewTransactionWidget extends AppWidgetProvider {
    public static final String EXTRA_TRANSACTION_TYPE = "com.bespoke.paisa.EXTRA_TRANSACTION_TYPE";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_new_transaction);
            views.setOnClickPendingIntent(R.id.widget_new_transaction, pendingIntent(context, appWidgetId));
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    private PendingIntent pendingIntent(Context context, int appWidgetId) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra(EXTRA_TRANSACTION_TYPE, "expense");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, appWidgetId, intent, flags);
    }
}
