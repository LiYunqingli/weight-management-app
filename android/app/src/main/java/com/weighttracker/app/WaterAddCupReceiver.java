package com.weighttracker.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import java.util.Calendar;
import java.util.Locale;

/**
 * 接收「喝一杯」加水广播，即使宿主 App 已关闭也能即时 +1 杯：
 *   - 在原生 water_widget SharedPreferences 中累加今日总量 / 杯数，并刷新两个小组件（即时反馈）；
 *   - 累加 pending_cups 计数，宿主 App 下次启动/前台时据此把杯数回写进 IndexedDB（避免重复计数）；
 *   - 跨日自动重置今日累计；
 *   - 若 App 正在运行，则通知 WebView 立即消费 pending_cups（即时持久化 + 应用内 UI 同步）。
 *
 * 注意：本接收器不导出（exported=false），仅由本应用自身的 PendingIntent 触发，安全。
 */
public class WaterAddCupReceiver extends BroadcastReceiver {
  private static final String PREFS = "water_widget";
  private static final String ACTION = WaterWidgetProvider.ACTION_ADD_WATER;

  @Override
  public void onReceive(Context context, Intent intent) {
    // 接受「action 匹配」或「显式指向本接收器组件」两种触发方式，确保一定能进入处理逻辑
    boolean matched = false;
    if (intent != null) {
      if (ACTION.equals(intent.getAction())) {
        matched = true;
      } else if (intent.getComponent() != null
          && WaterAddCupReceiver.class.getName().equals(intent.getComponent().getClassName())) {
        matched = true;
      }
    }
    if (!matched) return;
    try {
      SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      SharedPreferences.Editor ed = sp.edit();

      String today = dayKey(System.currentTimeMillis());

      // 跨日重置今日累计
      if (!today.equals(sp.getString("w_date", ""))) {
        ed.putString("w_total", "0");
        ed.putInt("w_cups", 0);
        ed.putString("w_date", today);
      }

      int cupMl = parseIntSafe(sp.getString("w_cup_ml", ""), 250);
      int curTotal = parseIntSafe(sp.getString("w_total", "0"), 0);
      int newTotal = curTotal + cupMl;
      int cups = sp.getInt("w_cups", 0) + 1;
      int pending = sp.getInt("w_pending", 0) + 1;

      ed.putString("w_total", String.valueOf(newTotal));
      ed.putInt("w_cups", cups);
      ed.putInt("w_pending", pending);
      ed.putString("w_updated", String.valueOf(System.currentTimeMillis()));
      ed.apply();

      Log.d("WaterAddCupReceiver", "加水 +" + cupMl + "ml，杯数=" + cups + "，pending=" + pending
          + "，appRunning=" + (MainActivity.instance != null));

      // 即时刷新两个小组件（即使 App 已死也能看到 +1）
      WaterWidgetProvider.pushUpdate(context);
      WaterShortcutWidgetProvider.pushUpdate(context);

      // 若 App 正在运行，通知 WebView 立即把 pending 杯数写回 IndexedDB
      if (MainActivity.instance != null) {
        MainActivity.instance.consumeCupsFromWidget();
      }
    } catch (Throwable t) {
      Log.e("WaterAddCupReceiver", "处理加水广播异常", t);
      // 任何异常都绝不能让广播接收拖垮系统
    }
  }

  private static String dayKey(long ms) {
    Calendar c = Calendar.getInstance();
    c.setTimeInMillis(ms);
    return String.format(Locale.CHINA, "%04d-%02d-%02d",
        c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
  }

  private static int parseIntSafe(String s, int def) {
    if (s == null || s.isEmpty()) return def;
    try {
      return Integer.parseInt(s.trim());
    } catch (Exception e) {
      return def;
    }
  }
}
