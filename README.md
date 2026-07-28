# 体重管理 App (Weight Management)

一个使用 React + Ant Design + Dexie(IndexedDB) + Recharts 构建的本地体重管理应用。
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

## 运行方式

```bash
npm install      # 安装依赖
npm run dev      # 本地开发，默认 http://localhost:5173
# 或者
npm run build    # 生产构建
npm run preview  # 预览构建产物，默认 http://localhost:4173
```

> 说明：本项目在 React 19 + Ant Design v6 环境下构建并验证通过。

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

如需改用真正的 SQLite，可替换为 `sql.js`（浏览器内 WASM）并将持久化落盘到文件或 IndexedDB，数据模型保持一致即可平滑迁移。

## 目录结构

```
src/
  db.ts                     # Dexie 数据库、类型、时段自动归类、示例数据
  utils.ts                  # 格式化、CSV/JSON 导出与导入解析
  App.tsx                   # 手机外壳布局 + 底部导航 + 首屏 Hero
  components/
    AddRecordForm.tsx       # 录入表单（含自动归类提示）
    RecordsList.tsx         # 历史记录移动列表（编辑/删除/分页）
    Dashboard.tsx           # 数据分析图表
    DataManagement.tsx      # 导出/导入/示例/清空
```
