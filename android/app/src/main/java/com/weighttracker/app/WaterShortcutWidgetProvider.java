package com.weighttracker.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * 独立 1×1 「喝一杯」快捷小组件：仅一个水滴图标 + 今日杯数，点按即 +1 杯。
 * 与喝水展示小组件共用同一加水广播（WaterAddCupReceiver.ACTION_ADD_WATER）。
 */
public class WaterShortcutWidgetProvider extends AppWidgetProvider {
  private static final String PREFS = "water_widget";

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      updateAppWidget(context, appWidgetManager, id);
    }
  }

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager,
                                         int appWidgetId, Bundle newOptions) {
    updateAppWidget(context, appWidgetManager, appWidgetId);
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
  }

  /** JS 数据变更后由插件调用，刷新所有已放置的快捷小组件 */
  static void pushUpdate(Context context) {
    try {
      AppWidgetManager awm = AppWidgetManager.getInstance(context);
      int[] ids = awm.getAppWidgetIds(new ComponentName(context, WaterShortcutWidgetProvider.class));
      if (ids != null) {
        for (int id : ids) updateAppWidget(context, awm, id);
      }
    } catch (Throwable t) {
      // 永不因小组件问题拖垮宿主 App
    }
  }

  static void updateAppWidget(Context context, AppWidgetManager awm, int appWidgetId) {
    try {
      SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.water_shortcut);

      int cups = sp.getInt("w_cups", 0);
      views.setTextViewText(R.id.w_short_cups, String.valueOf(cups));

      // 点按即 +1 杯（与展示小组件同一广播）
      Intent add = new Intent(WaterWidgetProvider.ACTION_ADD_WATER);
      PendingIntent piAdd = PendingIntent.getBroadcast(
          context, 2, add,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.w_root, piAdd);

      try {
        awm.updateAppWidget(appWidgetId, views);
      } catch (Exception ignored) {
      }
    } catch (Throwable t) {
      // 兜底
    }
  }
}
