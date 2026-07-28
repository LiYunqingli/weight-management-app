import Dexie, { type Table } from 'dexie'
import dayjs from 'dayjs'

/** 饭前 / 饭后 / 留空 */
export type MealStatus = 'before' | 'after' | ''

/** 早 / 中 / 晚：根据测量时间自动归类 */
export type Period = 'morning' | 'noon' | 'evening'

export interface WeightRecord {
  id?: number
  weight: number // kg，保留一位小数
  timestamp: number // epoch 毫秒
  period: Period // 由 timestamp 自动推导
  mealStatus: MealStatus // 录入时选择，默认为空
  note?: string
  /** 体脂率 %，可选（向后兼容，旧记录无此字段） */
  bodyFat?: number
}

/** 一条饮水记录：喝了一杯/一口的量（毫升）与发生时间 */
export interface WaterRecord {
  id?: number
  amount: number // ml，整数
  timestamp: number // epoch 毫秒
  note?: string
}

export const PERIOD_LABELS: Record<Period, string> = {
  morning: '早',
  noon: '中',
  evening: '晚',
}

/** 成熟配色：琥珀 / 苔绿 / 玫瑰梅 —— 全程避开蓝色 */
export const PERIOD_COLORS: Record<Period, string> = {
  morning: '#d98c2b',
  noon: '#3f8f5c',
  evening: '#9b4d6f',
}

export const MEAL_LABELS: Record<'before' | 'after', string> = {
  before: '饭前',
  after: '饭后',
}

/** 根据时间自动归类时段：早 05:00–10:59，中 11:00–16:59，晚 17:00–04:59 */
export function getPeriodFromDate(date: Date | number): Period {
  const h = dayjs(date).hour()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'noon'
  return 'evening'
}

export class WeightDB extends Dexie {
  records!: Table<WeightRecord, number>
  waters!: Table<WaterRecord, number>

  constructor() {
    super('WeightManagementDB')
    this.version(1).stores({
      // bodyFat 非索引字段，无需在 schema 声明，旧记录自动兼容
      records: '++id, timestamp, period, mealStatus',
    })
    // 饮水记录表（新增功能，独立版本，不影响既有 records 数据）
    this.version(2).stores({
      waters: '++id, timestamp',
    })
  }
}

export const db = new WeightDB()

/** 生成一段示例数据（最近 N 天，每天 早/中/晚 各一条，含轻微波动） */
export function generateSampleRecords(days = 14): WeightRecord[] {
  const out: WeightRecord[] = []
  const base = 70
  const now = dayjs()
  for (let d = days - 1; d >= 0; d--) {
    const day = now.subtract(d, 'day')
    const slots: { period: Period; hour: number; meal: MealStatus }[] = [
      { period: 'morning', hour: 7, meal: 'before' },
      { period: 'noon', hour: 12, meal: 'after' },
      { period: 'evening', hour: 19, meal: 'after' },
    ]
    slots.forEach((s, i) => {
      const ts = day.hour(s.hour).minute(0).second(0).millisecond(0).valueOf()
      const trend = (days - 1 - d) * -0.12
      const noise = (Math.sin(d * 3 + i) + Math.cos(d + i)) * 0.25
      const mealShift = s.meal === 'after' ? 0.4 : 0
      const weight = Math.round((base + trend + noise + mealShift) * 10) / 10
      out.push({
        weight,
        timestamp: ts,
        period: s.period,
        mealStatus: s.meal,
        note: '',
        bodyFat: Math.round((18 + (weight - 65) * 0.4 + noise) * 10) / 10,
      })
    })
  }
  return out
}

/** 生成一段示例饮水数据（最近 N 天，每天 4–8 杯，约 7:00–20:00 间均匀分布） */
export function generateSampleWater(days = 14): WaterRecord[] {
  const out: WaterRecord[] = []
  const now = dayjs()
  const cup = 250
  for (let d = days - 1; d >= 0; d--) {
    const day = now.subtract(d, 'day')
    const n = 4 + Math.floor(Math.random() * 5) // 4–8 杯
    for (let i = 0; i < n; i++) {
      const hour = 7 + Math.floor((i / n) * 13) // 7–20 点之间
      const minute = Math.floor(Math.random() * 60)
      const ts = day.hour(hour).minute(minute).second(0).millisecond(0).valueOf()
      out.push({ amount: cup, timestamp: ts })
    }
  }
  return out
}
