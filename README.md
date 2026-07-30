# 体重管理 App (Weight Management)

一个使用 React 19 + Vite + Capacitor(Android) + Dexie(IndexedDB) + Recharts 构建的本地体重管理应用，支持 Android 桌面小组件。
所有数据保存在浏览器本地，**无需后端、无需联网注册**，刷新不丢失。

## 功能特性

- **移动 App 风格 UI**：整体约束为手机宽度的「外壳」，顶部渐变应用栏 + 底部导航（记录 / 分析 / 数据），首屏体重 Hero 卡片；桌面端居中显示为一部手机，移动端自动铺满全屏。
- **录入即自动归类**：录入体重时选择测量时间，系统按时间自动判断时段（早 05:00–10:59 / 中 11:00–16:59 / 晚 17:00–04:59），无需手动选择。
- **饭前 / 饭后标记**：录入时可选「饭前」「饭后」，默认留空。
- **历史记录管理**：移动端卡片列表展示（时段圆形标记 + 体重 + 时间/饭前饭后/备注），支持编辑、删除、分页。
- **数据分析图表**：
  - 体重趋势折线图（早/中/晚 分色，可设目标体重参考线）
  - 各时段平均体重柱状图
  - 饭前 vs 饭后 平均体重对比
  - 记录分布饼图
  - 关键指标卡：最新 / 平均 / 最低最高 / 累计变化 / 记录数
- **数据导出 / 导入**：
  - 导出 CSV（带 BOM，Excel 中文不乱码）
  - 导出 JSON
  - 导入 CSV（自动按「时间+体重」去重）
- **一键示例数据**：内置 14 天示例，方便快速预览效果。
- **Android 桌面小组件**：
  - **体重追踪**：展示最新体重、趋势与目标进度（纯展示）。
  - **喝水追踪**：展示今日饮水量(ml)/杯数/目标进度，并内置「喝一杯」按钮。
  - **喝一杯（1×1 快捷）**：水滴图标 + 今日杯数，点按即 +1 杯。
  - 关键能力：即使 App 已关闭，点「喝一杯」也能**即时 +1 杯**（原生层直接计数）；打开 App 后自动把待回写杯数同步进本地数据库，绝不重复计数。

## 运行方式

```bash
npm install      # 安装依赖
npm run dev      # 本地开发，默认 http://localhost:5173
# 或者
npm run build    # 生产构建
npm run preview  # 预览构建产物，默认 http://localhost:4173
```

> 说明：本项目在 React 19 + Ant Design v6 环境下构建并验证通过。

## Android 构建与安装（桌面小组件需原生编译）

```bash
npm run build                 # Web 构建（含类型检查）
npx cap sync android          # 同步 Web 产物到 Android 原生工程
cd android && ./gradlew assembleDebug   # 需要 JDK 17
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> 注意：桌面小组件的点击行为与选择器名称/预览元数据，需**覆盖安装**后才会刷新。本机沙箱仅有 JRE 8，AGP 8.13 需 JDK 17 才能编译原生工程。

## 数据存储

使用 **Dexie（IndexedDB）** 作为轻量本地存储方案（即需求中提到的「其他简单数据存储方式」）。
相比 SQLite，IndexedDB 无需任何后端或原生模块，纯浏览器环境即可持久化，更适合此类单机小工具。
数据表 `records` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 自增主键 |
| weight | number | 体重 (kg) |
| timestamp | number | 测量时间 (epoch 毫秒) |
| period | string | 自动归类：morning / noon / evening |
| mealStatus | string | 饭前 before / 饭后 after / 空 |
| note | string | 备注（可选） |

数据表 `waters` 字段（饮水记录）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 自增主键 |
| amount | number | 饮水量 (ml) |
| timestamp | number | 饮水时间 (epoch 毫秒) |

如需改用真正的 SQLite，可替换为 `sql.js`（浏览器内 WASM）并将持久化落盘到文件或 IndexedDB，数据模型保持一致即可平滑迁移。

## 目录结构

```
src/
  db.ts                     # Dexie 数据库、类型、时段自动归类、示例数据
  utils.ts                  # 格式化、CSV/JSON 导出与导入解析
  App.tsx                   # 手机外壳布局 + 底部导航 + 首屏 Hero + 小组件数据同步
  waterSettings.ts          # 饮水目标 / 杯容量设置
  lib/widget.ts             # 与原生桌面小组件通信的桥接（Capacitor WidgetBridge）
  components/
    AddRecordForm.tsx       # 录入表单（含自动归类提示）
    RecordsList.tsx         # 历史记录移动列表（编辑/删除/分页）
    Dashboard.tsx           # 数据分析图表
    DataManagement.tsx      # 导出/导入/示例/清空
    Water.tsx               # 饮水录入与今日进度
android/app/src/main/
  java/com/weighttracker/app/
    WeightWidgetProvider.java       # 体重展示小组件
    WaterWidgetProvider.java        # 喝水展示小组件
    WaterShortcutWidgetProvider.java# 「喝一杯」1×1 快捷小组件
    WaterAddCupReceiver.java        # 「喝一杯」加水广播（App 关闭也能计数）
    WidgetBridgePlugin.java         # Capacitor 插件：写入小组件数据 / 待回写杯数
  res/layout/ 与 res/xml/            # 小组件布局 与 AppWidgetProviderInfo
```

## 桌面小组件说明

应用提供 3 个桌面小组件（在系统小组件列表「体重管理」下，名称分别为 **体重追踪 / 喝水追踪 / 喝一杯**）：

| 组件 | 尺寸 | 作用 |
| --- | --- | --- |
| 体重追踪 | 自适应（建议 ≥2×3） | 展示最新体重、趋势、目标进度等（纯展示） |
| 喝水追踪 | 自适应（建议 ≥2×2） | 展示今日饮水量(ml)/杯数/目标进度，含「喝一杯」按钮 |
| 喝一杯 | 1×1 | 水滴图标 + 今日杯数，点按即 +1 杯 |

**「喝一杯」即时加水的实现**（即使 App 已关闭也能 +1 杯，且不重复计数）：

```
桌面点按「喝一杯」─▶ ACTION_ADD_WATER 广播 ─▶ WaterAddCupReceiver
        ├─ 原生累加 water_widget SharedPreferences 的 w_total/w_cups/w_pending，并立即刷新两个小组件（即时反馈）
        └─ 若 App 正在运行 ─▶ MainActivity.consumeCupsFromWidget ─▶ Web 收到 widget-add-cup 事件

Web(db.waters, IndexedDB 为唯一真相源)
        ├─ 启动 / 前台被点击时：consumePendingCups 读取 w_pending → bulkAdd 到 IndexedDB → clearPendingCups
        └─ 数据变化时：pushWaterWidgetSnapshot 把权威快照写回原生，重置镜像
```

- 原生层只做「即时反馈 + 待回写计数」，App 启动后由 IndexedDB 的权威数据重置原生镜像，因此**不会重复计数**。
- 各组件均已在 `appwidget-provider` XML 与 `<receiver>` 标签设置 `android:label`，确保在原生 Android 与国产 OEM 启动器（荣耀 / 华为等）下都显示独立名称。
- 小组件选择器预览通过 `android:previewLayout` 复用真实布局，避免显示成 App 图标。
