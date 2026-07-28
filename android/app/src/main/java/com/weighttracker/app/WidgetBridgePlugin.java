package com.weighttracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;

/**
 * 桥接层：让 WebView(JS) 能把多维体重数据快照写入原生 SharedPreferences，
 * 并让桌面小组件读取。同时承载「点击小组件」打开分析页的深链意图。
 * 注意：Capacitor 8 已移除 @PluginMethod，public 方法自动注册为插件方法。
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
  public static String pendingTab = null;
  private static final String PREFS = "weight_widget";

  @PluginMethod
  public void updateWidget(PluginCall call) {
    Context ctx = getContext();
    if (ctx == null) {
      call.resolve();
      return;
    }
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    SharedPreferences.Editor ed = sp.edit();
    ed.putString("w_latest", call.getString("latest", ""));
    ed.putString("w_prev", call.getString("prev", ""));
    ed.putString("w_target", call.getString("target", ""));
    ed.putInt("w_progress", call.getInt("progress", -1));
    ed.putString("w_avg", call.getString("avg", ""));
    ed.putString("w_min", call.getString("min", ""));
    ed.putString("w_max", call.getString("max", ""));
    ed.putString("w_change", call.getString("change", ""));
    ed.putString("w_avg7", call.getString("avg7", ""));
    ed.putString("w_change7", call.getString("change7", ""));
    ed.putString("w_change30", call.getString("change30", ""));
    ed.putString("w_bmi", call.getString("bmi", ""));
    ed.putString("w_bmiLabel", call.getString("bmiLabel", ""));
    ed.putString("w_bmiTone", call.getString("bmiTone", ""));
    ed.putInt("w_streak", call.getInt("streak", 0));
    ed.putInt("w_count", call.getInt("count", 0));
    ed.putString("w_pm", call.getString("periodMorning", ""));
    ed.putString("w_pn", call.getString("periodNoon", ""));
    ed.putString("w_pe", call.getString("periodEvening", ""));
    ed.putString("w_updated", call.getString("updatedAt", ""));
    ed.apply();

    // 数据变了，立即刷新已放置的小组件（任何异常都不能中断插件调用或拖垮宿主 App）
    try {
      WeightWidgetProvider.pushUpdate(ctx);
    } catch (Throwable ignored) {
    }
    call.resolve();
  }

  @PluginMethod
  public void getLaunchAction(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("tab", pendingTab == null ? "" : pendingTab);
    pendingTab = null;
    call.resolve(ret);
  }
}
