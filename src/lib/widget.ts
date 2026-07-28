import { registerPlugin } from '@capacitor/core'

// 对应原生 WidgetBridgePlugin（android/app/.../WidgetBridgePlugin.java）
const WidgetBridge = registerPlugin<any>('WidgetBridge')

export interface WidgetSnapshot {
  latest: number | null
  prev: number | null
  target: number | null
  /** 0~1，null 表示未设目标 */
  progress: number | null
  avg: number | null
  min: number | null
  max: number | null
  change: number | null
  avg7: number | null
  change7: number | null
  change30: number | null
  bmi: number | null
  bmiLabel: string | null
  bmiTone: string | null
  streak: number | null
  count: number | null
  periodMorning: number | null
  periodNoon: number | null
  periodEvening: number | null
  /** epoch 毫秒，null 表示未知 */
  updatedAt: number | null
}

function s(v: number | null): string {
  return v == null || !isFinite(v) ? '' : String(Math.round(v * 10) / 10)
}

/** 把多维数据快照推给原生，刷新桌面小组件。无原生环境（浏览器）时静默失败。 */
export function pushWidgetSnapshot(d: WidgetSnapshot) {
  try {
    WidgetBridge.updateWidget({
      latest: s(d.latest),
      prev: s(d.prev),
      target: s(d.target),
      progress: d.progress == null ? -1 : Math.round(d.progress * 100),
      avg: s(d.avg),
      min: s(d.min),
      max: s(d.max),
      change: s(d.change),
      avg7: s(d.avg7),
      change7: s(d.change7),
      change30: s(d.change30),
      bmi: s(d.bmi),
      bmiLabel: d.bmiLabel ?? '',
      bmiTone: d.bmiTone ?? '',
      streak: d.streak == null ? 0 : Math.round(d.streak),
      count: d.count == null ? 0 : Math.round(d.count),
      periodMorning: s(d.periodMorning),
      periodNoon: s(d.periodNoon),
      periodEvening: s(d.periodEvening),
      updatedAt: d.updatedAt == null ? '' : String(Math.round(d.updatedAt)),
    })
  } catch {
    /* 浏览器 / 未安装原生插件：忽略 */
  }
}

/** 消费小组件点击带来的深链（'analysis' 表示打开分析页）。 */
export async function consumeWidgetTab(): Promise<string | null> {
  try {
    const res = await WidgetBridge.getLaunchAction()
    return res && res.tab ? res.tab : null
  } catch {
    return null
  }
}
