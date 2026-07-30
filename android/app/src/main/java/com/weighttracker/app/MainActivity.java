package com.weighttracker.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebView;
import android.content.Intent;

public class MainActivity extends BridgeActivity {
  /** 静态实例：供 BroadcastReceiver（桌面快捷加水）在 App 运行期间回调 WebView */
  public static MainActivity instance = null;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // 必须在 super.onCreate() 之前注册本地插件：bridge 在 super.onCreate() 内的
    // load() -> create() 时会据此生成 PluginHeaders（注入到 WebView），JS 才能识别到
    // "WidgetBridge" 插件；若晚于 create() 注册，JS 会报
    // "plugin is not implemented on android"。
    registerPlugin(WidgetBridgePlugin.class);
    super.onCreate(savedInstanceState);
    instance = this;
    // 开启 WebView 远程调试：手机连电脑 USB 后，在电脑 Chrome 访问
    // chrome://inspect/#devices 即可看到控制台日志，便于排查白屏等问题。
    WebView.setWebContentsDebuggingEnabled(true);
    handleIntent(getIntent());
  }

  @Override
  public void onDestroy() {
    if (instance == this) instance = null;
    super.onDestroy();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    handleIntent(intent);
  }

  /** 小组件点击带 openTab=analysis/water 启动本 Activity 时，记录待消费动作 */
  private void handleIntent(Intent intent) {
    if (intent == null) return;
    String tab = intent.getStringExtra("openTab");
    if ("analysis".equals(tab) || "water".equals(tab)) {
      WidgetBridgePlugin.pendingTab = tab;
      // 若 App 已在运行，直接通知 Web 切到对应页
      dispatchEvent("widget-tab");
    }
  }

  /** 由 WaterAddCupReceiver 在 App 运行期间调用：通知 WebView 立即消费待回写杯数 */
  public void consumeCupsFromWidget() {
    dispatchEvent("widget-add-cup");
  }

  private void dispatchEvent(String name) {
    try {
      com.getcapacitor.Bridge bridge = getBridge();
      if (bridge != null && bridge.getWebView() != null) {
        bridge.getWebView().evaluateJavascript(
            "window.dispatchEvent(new Event('" + name + "'))", null);
      }
    } catch (Exception ignored) {
    }
  }
}
