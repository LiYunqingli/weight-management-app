package com.weighttracker.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 喝水桌面小组件：展示今日饮水量（ml / 杯数）与目标进度，并提供「喝一杯」快捷按钮。
 *
 * 布局骨架（宽/窄两套布局共用相同 id）：
 *   标题行   「喝水追踪」              「更新 HH:mm」
 *   主数据行 今日 ml 大数字 + 单位      杯数
 *   进度行   ─── 目标进度条 ───  NN%
 *   按钮行   「喝一杯 +Nml」按钮
 *
 * 分档（dp，高度驱动，顶部对齐）：
 *   - tiny：最小边 < 100（≈1×1）→ 仅标题 + 大数字 + 单位
 *   - showAdd：高度 ≥ 110 → 显示「喝一杯」按钮
 *   - 目标进度行：仅在设置了目标（progress >= 0）时显示
 *   - 更新时间：有数据即显示
 *
 * 数据来自 WidgetBridgePlugin 写入的 SharedPreferences（water_widget）。
 * 「喝一杯」按钮与独立快捷小组件均通过 WaterAddCupReceiver 广播即时 +1 杯。
 */
public class WaterWidgetProvider extends AppWidgetProvider {
  /** 小组件点击「喝一杯」/ 独立快捷组件发出的加水广播 */
  public static final String ACTION_ADD_WATER = "com.weighttracker.app.ACTION_ADD_WATER";

  private static final String PREFS = "water_widget";

  private static final int ACCENT = 0xFF34CDB8; // 青绿（达成/进度）
  private static final int TEXT = 0xFFEAFBF8;   // 主文字
  private static final int SUB = 0xFF8FC7BD;    // 次要文字
  private static final int MUTED = 0xFF6FA79C;  // 更弱文字

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

  /** JS 数据变更后由插件调用，刷新所有已放置的喝水小组件 */
  static void pushUpdate(Context context) {
    try {
      AppWidgetManager awm = AppWidgetManager.getInstance(context);
      int[] ids = awm.getAppWidgetIds(new ComponentName(context, WaterWidgetProvider.class));
      if (ids != null) {
        for (int id : ids) updateAppWidget(context, awm, id);
      }
    } catch (Throwable t) {
      // 永不因小组件问题拖垮宿主 App
    }
  }

  private static int getI(SharedPreferences sp, String k, int def) {
    return sp.getInt(k, def);
  }

  private static String getS(SharedPreferences sp, String k) {
    String v = sp.getString(k, "");
    return v == null ? "" : v;
  }

  static void updateAppWidget(Context context, AppWidgetManager awm, int appWidgetId) {
    try {
      SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      Bundle opts = awm.getAppWidgetOptions(appWidgetId);
      int w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
      int h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);

      int minSide = Math.min(w, h);
      boolean tiny = minSide > 0 && minSide < 100;
      boolean showAdd = !tiny && h >= 110;

      int layout = (w < 200) ? R.layout.water_widget_narrow : R.layout.water_widget;
      RemoteViews views = new RemoteViews(context.getPackageName(), layout);

      // ── 今日数据 ──
      String totalS = getS(sp, "w_total");
      int total = totalS.isEmpty() ? 0 : parseIntSafe(totalS, 0);
      int cups = getI(sp, "w_cups", 0);
      int progress = getI(sp, "w_progress", -1);
      String cupMl = getS(sp, "w_cup_ml");
      if (cupMl.isEmpty()) cupMl = "250";
      String updated = getS(sp, "w_updated");

      // ── 标题行 ──
      views.setViewVisibility(R.id.w_title, View.VISIBLE);

      // 更新时间：有数据即显示
      if (!updated.isEmpty()) {
        try {
          long t = Long.parseLong(updated);
          views.setViewVisibility(R.id.w_footer, View.VISIBLE);
          views.setTextViewText(R.id.w_footer,
              "更新 " + new SimpleDateFormat("HH:mm", Locale.CHINA).format(new Date(t)));
        } catch (Exception e) {
          views.setViewVisibility(R.id.w_footer, View.GONE);
        }
      } else {
        views.setViewVisibility(R.id.w_footer, View.GONE);
      }

      // ── 主数据行：今日 ml 大数字 + 单位 ──
      int size = (int) Math.max(22, Math.min(34, Math.max(w / 7f, h / 8f)));
      if (tiny) size = Math.min(size, 26);
      views.setTextViewTextSize(R.id.w_total, TypedValue.COMPLEX_UNIT_SP, size);
      views.setTextViewText(R.id.w_total, totalS.isEmpty() ? "--" : totalS);
      views.setTextColor(R.id.w_total, TEXT);
      views.setViewVisibility(R.id.w_unit, View.VISIBLE);

      if (!tiny) {
        views.setViewVisibility(R.id.w_cups, View.VISIBLE);
        views.setTextViewText(R.id.w_cups, cups + " 杯");
        views.setTextColor(R.id.w_cups, SUB);
      } else {
        views.setViewVisibility(R.id.w_cups, View.GONE);
      }

      // ── 目标进度行 ──
      if (progress >= 0) {
        views.setViewVisibility(R.id.w_progress_row, View.VISIBLE);
        views.setProgressBar(R.id.w_progress_bar, 100, progress, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          try {
            views.setColorStateList(R.id.w_progress_bar, "setProgressTintList",
                ColorStateList.valueOf(ACCENT));
          } catch (Throwable ignored) {
          }
        }
        views.setTextViewText(R.id.w_progress, progress + "%");
        views.setTextColor(R.id.w_progress, ACCENT);
      } else {
        views.setViewVisibility(R.id.w_progress_row, View.GONE);
      }

      // ── 喝一杯 按钮 ──
      if (showAdd) {
        views.setViewVisibility(R.id.w_add_row, View.VISIBLE);
        views.setTextViewText(R.id.w_add, "喝一杯 +" + cupMl + "ml");

        // 关键修复：Android 12+(API31+) 会静默丢弃「发往未导出接收器的隐式广播 PendingIntent」，
        // 导致点击毫无反应。改用显式组件 Intent（仍带上 action 以便接收器校验），确保一定能送达。
        // 同时把点击挂到 w_add_row（根布局的直接子View，比深层 w_add 更可靠）。
        Intent add = new Intent(context, WaterAddCupReceiver.class);
        add.setAction(ACTION_ADD_WATER);
        PendingIntent piAdd = PendingIntent.getBroadcast(
            context, 1, add,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.w_add_row, piAdd);
      } else {
        views.setViewVisibility(R.id.w_add_row, View.GONE);
      }

      // ── 点击整卡 → 打开 App 并直达喝水页 ──
      Intent openApp = new Intent(context, MainActivity.class);
      openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
      openApp.putExtra("openTab", "water");
      PendingIntent piOpen = PendingIntent.getActivity(
          context, 3, openApp,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.w_root, piOpen);

      try {
        awm.updateAppWidget(appWidgetId, views);
      } catch (Exception ignored) {
        // 非法/未绑定的 widgetId 直接忽略，避免崩溃
      }
    } catch (Throwable t) {
      // 兜底：任何意外（含旧系统 RemoteViews 不支持的 API）都绝不能让宿主 App 崩溃
    }
  }

  private static int parseIntSafe(String s, int def) {
    try {
      return Integer.parseInt(s.trim());
    } catch (Exception e) {
      return def;
    }
  }
}
