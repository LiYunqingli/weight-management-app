package com.weighttracker.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.res.ColorStateList;
import android.os.Build;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 桌面小组件：按尺寸自适应展示体重管理数据（纯展示，无记录功能）。
 *
 * 布局骨架（宽/窄两套布局共用相同 id）：
 *   标题行   「体重管理」              「更新 HH:mm」
 *   主数据行 大体重 + kg 单位（底对齐）   较上次变化（右）
 *   进度行   ─── 进度条 ───  NN%
 *   ─────── 分割线 ───────
 *   指标网格 （宽 3×2 / 窄 2×3）卡片式单元格：平均·低高·连续·7日均值·7日变化·30日变化
 *   BMI 行   BMI xx · 标签
 *   时段行   早 x  中 x  晚 x
 *
 * 分档（dp，高度驱动，顶部对齐，小尺寸即可展示完整内容）：
 *   - tiny：最小边 < 100（≈1×1）→ 仅标题 + 大体重 + 单位
 *   - showGrid：高度 ≥ 130 → 显示进度行 + 分割线 + 指标网格
 *   - showExtra：高度 ≥ 200（覆盖 2×4）→ 再显示 BMI / 时段均值
 *   - narrow：宽 < 200 → 用 2 列网格布局，否则 3 列
 *   - 更新时间始终显示（有数据时）
 *
 * 数据来自 WidgetBridgePlugin 写入的 SharedPreferences。
 */
public class WeightWidgetProvider extends AppWidgetProvider {
  private static final String PREFS = "weight_widget";

  private static final int MINT = 0xFF7FD1B8; // 下降/达标（翠绿）
  private static final int ROSE = 0xFFE08AA0; // 上升（玫瑰）
  private static final int SUB = 0xFF9FB3AA;  // 次要文字
  private static final int TEXT = 0xFFF0EDE6; // 主文字

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

  /** JS 数据变更后由插件调用，刷新所有已放置的小组件 */
  static void pushUpdate(Context context) {
    try {
      AppWidgetManager awm = AppWidgetManager.getInstance(context);
      int[] ids = awm.getAppWidgetIds(new ComponentName(context, WeightWidgetProvider.class));
      if (ids != null) {
        for (int id : ids) updateAppWidget(context, awm, id);
      }
    } catch (Throwable t) {
      // 永不因小组件问题拖垮宿主 App
    }
  }

  private static double getD(SharedPreferences sp, String k) {
    String v = sp.getString(k, "");
    if (v == null || v.isEmpty()) return Double.NaN;
    try {
      return Double.parseDouble(v);
    } catch (Exception e) {
      return Double.NaN;
    }
  }

  private static String fmt(double v) {
    return String.format(Locale.CHINA, "%.1f", v);
  }

  private static void setStat(RemoteViews v, int vid, int lid, String val, String label) {
    v.setTextViewText(vid, val);
    v.setTextViewText(lid, label);
    v.setTextColor(vid, TEXT);
  }

  private static void setToneStat(RemoteViews v, int vid, int lid, double change, String label) {
    v.setTextViewText(lid, label);
    if (Double.isNaN(change)) {
      v.setTextViewText(vid, "—");
      v.setTextColor(vid, TEXT);
    } else {
      v.setTextViewText(vid, (change > 0 ? "+" : "") + fmt(change));
      v.setTextColor(vid, change < 0 ? MINT : change > 0 ? ROSE : TEXT);
    }
  }

  static void updateAppWidget(Context context, AppWidgetManager awm, int appWidgetId) {
   try {
    SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    Bundle opts = awm.getAppWidgetOptions(appWidgetId);
    int w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
    int h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);

    int minSide = Math.min(w, h);
    boolean tiny = minSide > 0 && minSide < 100;
    boolean showGrid = !tiny && h >= 130;   // 进度行 + 分割线 + 网格（放宽）
    boolean showExtra = !tiny && h >= 200;  // BMI + 时段均值（2×4 即可完整）
    boolean narrow = w < 200;               // 窄卡片 2 列网格，宽卡片 3 列

    int layout = narrow ? R.layout.weight_widget_narrow : R.layout.weight_widget;
    RemoteViews views = new RemoteViews(context.getPackageName(), layout);

    double latest = getD(sp, "w_latest");
    double prev = getD(sp, "w_prev");
    int progress = sp.getInt("w_progress", -1);
    double avg = getD(sp, "w_avg");
    double min = getD(sp, "w_min");
    double max = getD(sp, "w_max");
    double change7 = getD(sp, "w_change7");
    double change30 = getD(sp, "w_change30");
    double avg7 = getD(sp, "w_avg7");
    double bmi = getD(sp, "w_bmi");
    String bmiLabel = sp.getString("w_bmiLabel", "");
    int streak = sp.getInt("w_streak", 0);
    double pm = getD(sp, "w_pm");
    double pn = getD(sp, "w_pn");
    double pe = getD(sp, "w_pe");
    String updated = sp.getString("w_updated", "");

    // ── 标题行 ──
    views.setViewVisibility(R.id.w_title, View.VISIBLE);
    // 更新时间：有数据即显示，不局限于 showExtra
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

    // ── 主数据行：大体重 + 单位（字号自适应，上限收紧）──
    int weightSize = (int) Math.max(24, Math.min(36, Math.max(w / 7f, h / 8f)));
    if (tiny) weightSize = Math.min(weightSize, 26);
    views.setTextViewTextSize(R.id.w_weight, TypedValue.COMPLEX_UNIT_SP, weightSize);
    views.setTextViewText(R.id.w_weight, Double.isNaN(latest) ? "--" : fmt(latest));
    views.setViewVisibility(R.id.w_unit, View.VISIBLE);

    // 较上次变化（右；tiny 隐藏省空间）
    if (!tiny && !Double.isNaN(latest) && !Double.isNaN(prev) && prev != latest) {
      double d = Math.round((latest - prev) * 10) / 10.0;
      views.setViewVisibility(R.id.w_delta, View.VISIBLE);
      views.setTextViewText(R.id.w_delta, (d > 0 ? "▲ +" : "▼ ") + fmt(Math.abs(d)) + "kg");
      views.setTextColor(R.id.w_delta, d < 0 ? MINT : ROSE);
    } else {
      views.setViewVisibility(R.id.w_delta, View.GONE);
    }

    // ── 目标进度行（有目标才显示）──
    if (progress >= 0) {
      views.setViewVisibility(R.id.w_progress_row, View.VISIBLE);
      views.setProgressBar(R.id.w_progress_bar, 100, progress, false);
      // setColorStateList 是 API 31(Android 12) 才加入的 RemoteViews 方法；
      // 旧系统(API<31)调用会抛 NoSuchMethodError(属于 Error 非 Exception)，必须守卫，否则拖垮宿主 App
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        try {
          views.setColorStateList(R.id.w_progress_bar, "setProgressTintList", ColorStateList.valueOf(MINT));
        } catch (Throwable ignored) {
        }
      }
      views.setTextViewText(R.id.w_progress, progress + "%");
    } else {
      views.setViewVisibility(R.id.w_progress_row, View.GONE);
    }

    views.setViewVisibility(R.id.w_chart_block, View.VISIBLE);
    views.setTextViewText(R.id.w_chart_title, "近 7 天趋势");

    int[] chartValues = new int[]{45, 60, 70, 55, 30};
    if (!Double.isNaN(change7)) {
      int base = (int) Math.max(20, Math.min(80, 50 + change7 * 8));
      chartValues = new int[]{
          Math.max(15, base - 20),
          Math.max(15, base - 8),
          base,
          Math.max(15, base + 8),
          Math.max(15, base + 16)
      };
    }

    int chartColor = SUB;
    if (!Double.isNaN(change7)) {
      chartColor = change7 < 0 ? MINT : change7 > 0 ? ROSE : SUB;
    }

    for (int i = 1; i <= 5; i++) {
      int id = context.getResources().getIdentifier("chart_" + i, "id", context.getPackageName());
      views.setProgressBar(id, 100, chartValues[i - 1], false);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        try {
          views.setColorStateList(id, "setProgressTintList", ColorStateList.valueOf(chartColor));
        } catch (Throwable ignored) {
        }
      }
    }

    views.setTextViewText(R.id.w_summary_avg, Double.isNaN(avg7) ? "均值 —" : "均值 " + fmt(avg7) + "kg");
    views.setTextViewText(R.id.w_summary_bmi, Double.isNaN(bmi) ? "BMI —" : "BMI " + fmt(bmi));
    views.setTextViewText(R.id.w_summary_streak, streak > 0 ? streak + "天连续" : "起步中");
    views.setTextColor(R.id.w_summary_avg, TEXT);
    views.setTextColor(R.id.w_summary_bmi, TEXT);
    views.setTextColor(R.id.w_summary_streak, TEXT);

    // ── 隐藏原生 BMI / 时段文本（已用上方摘要 chip 展示）──
    views.setViewVisibility(R.id.w_bmi, View.GONE);
    views.setViewVisibility(R.id.w_period, View.GONE);

    // ── 点击整卡 → 打开 App 并直达分析页 ──
    Intent openApp = new Intent(context, MainActivity.class);
    openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
    openApp.putExtra("openTab", "analysis");
    PendingIntent pi = PendingIntent.getActivity(
        context, 0, openApp,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.w_root, pi);

    try {
      awm.updateAppWidget(appWidgetId, views);
    } catch (Exception ignored) {
      // 非法/未绑定的 widgetId 直接忽略，避免崩溃
    }
    } catch (Throwable t) {
      // 兜底：任何意外（含旧系统 RemoteViews 不支持 API 抛出的 NoSuchMethodError）都绝不能让宿主 App 崩溃
    }
  }
}
