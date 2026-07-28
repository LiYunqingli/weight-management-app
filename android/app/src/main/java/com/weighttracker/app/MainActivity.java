package com.weighttracker.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebView;
import android.content.Intent;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // 必须在 super.onCreate() 之前注册本地插件：bridge 在 super.onCreate() 内的
    // load() -> create() 时会据此生成 PluginHeaders（注入到 WebView），JS 才能识别到
    // "WidgetBridge" 插件；若晚于 create() 注册，JS 会报
    // "plugin is not implemented on android"。
    registerPlugin(WidgetBridgePlugin.class);
    super.onCreate(savedInstanceState);
    // 开启 WebView 远程调试：手机连电脑 USB 后，在电脑 Chrome 访问
    // chrome://inspect/#devices 即可看到控制台日志，便于排查白屏等问题。
    WebView.setWebContentsDebuggingEnabled(true);
    handleIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    handleIntent(intent);
  }

  /** 小组件点击带 openTab=analysis 启动本 Activity 时，记录待消费动作 */
  private void handleIntent(Intent intent) {
    if (intent != null && "analysis".equals(intent.getStringExtra("openTab"))) {
      WidgetBridgePlugin.pendingTab = "analysis";
      // 若 App 已在运行，直接通知 Web 切到分析页
      dispatchTabEvent();
    }
  }

  private void dispatchTabEvent() {
    try {
      com.getcapacitor.Bridge bridge = getBridge();
      if (bridge != null && bridge.getWebView() != null) {
        bridge.getWebView().evaluateJavascript(
            "window.dispatchEvent(new Event('widget-tab'))", null);
      }
    } catch (Exception ignored) {
    }
  }
}
