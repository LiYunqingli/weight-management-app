import dayjs from 'dayjs'
import { saveAs } from 'file-saver'
import type { WeightRecord, Period, MealStatus } from './db'
import { PERIOD_LABELS, MEAL_LABELS, getPeriodFromDate } from './db'

/* ---------------- labels & formatting ---------------- */

export function periodLabel(p: Period): string {
  return PERIOD_LABELS[p]
}

export function mealLabel(status: MealStatus): string {
  if (status === 'before') return MEAL_LABELS.before
  if (status === 'after') return MEAL_LABELS.after
  return '—'
}

export function formatDateTime(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

export function formatDate(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD')
}

export function formatTime(ts: number): string {
  return dayjs(ts).format('HH:mm')
}

/** 相对日期：今天/昨天/星期几/日期 */
export function relativeDay(ts: number): string {
  const d = dayjs(ts)
  const today = dayjs().startOf('day')
  const diff = today.diff(d.startOf('day'), 'day')
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff > 1 && diff < 7) return `${diff} 天前`
  return d.format('MM-DD')
}

/** 趋势图 X 轴标签 */
export function shortLabel(ts: number): string {
  return dayjs(ts).format('MM-DD HH:mm')
}

export function dayKey(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD')
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/* ---------------- BMI ---------------- */

export function computeBMI(weightKg: number, heightCm: number | null): number | null {
  if (!heightCm || heightCm <= 0) return null
  const h = heightCm / 100
  return round1(weightKg / (h * h))
}

export type BMITone = 'low' | 'ok' | 'warn' | 'high'

export function bmiCategory(bmi: number): { label: string; tone: BMITone; range: string } {
  if (bmi < 18.5) return { label: '偏瘦', tone: 'low', range: '< 18.5' }
  if (bmi < 24) return { label: '正常', tone: 'ok', range: '18.5 – 23.9' }
  if (bmi < 28) return { label: '超重', tone: 'warn', range: '24 – 27.9' }
  return { label: '肥胖', tone: 'high', range: '≥ 28' }
}

/* ---------------- 统计分析 ---------------- */

export interface Stats {
  latest: number | null
  first: number | null
  avg: number
  min: number
  max: number
  change: number // latest - first
  count: number
  avg7: number | null
  avg30: number | null
  change7: number | null // 7 天变化
  change30: number | null // 30 天变化
}

export function computeStats(records: WeightRecord[]): Stats {
  if (!records.length) {
    return {
      latest: null,
      first: null,
      avg: 0,
      min: 0,
      max: 0,
      change: 0,
      count: 0,
      avg7: null,
      avg30: null,
      change7: null,
      change30: null,
    }
  }
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp)
  const weights = sorted.map((r) => r.weight)
  const latest = weights[weights.length - 1]
  const first = weights[0]
  const avg = round1(weights.reduce((s, w) => s + w, 0) / weights.length)
  const min = Math.min(...weights)
  const max = Math.max(...weights)

  const now = dayjs()
  const last7 = records.filter((r) => dayjs(r.timestamp).isAfter(now.subtract(7, 'day')))
  const last30 = records.filter((r) => dayjs(r.timestamp).isAfter(now.subtract(30, 'day')))
  const avgOf = (rs: WeightRecord[]) =>
    rs.length ? round1(rs.reduce((s, r) => s + r.weight, 0) / rs.length) : null
  const avg7 = avgOf(last7)
  const avg30 = avgOf(last30)

  // 7 天变化：最近 7 天平均 - 前 7 天平均
  const prev7 = records.filter((r) => {
    const d = dayjs(r.timestamp)
    return d.isAfter(now.subtract(14, 'day')) && !d.isAfter(now.subtract(7, 'day'))
  })
  const prev7Avg = avgOf(prev7)
  const change7 = avg7 != null && prev7Avg != null ? round1(avg7 - prev7Avg) : null

  const prev30 = records.filter((r) => {
    const d = dayjs(r.timestamp)
    return d.isAfter(now.subtract(60, 'day')) && !d.isAfter(now.subtract(30, 'day'))
  })
  const prev30Avg = avgOf(prev30)
  const change30 = avg30 != null && prev30Avg != null ? round1(avg30 - prev30Avg) : null

  return {
    latest,
    first,
    avg,
    min,
    max,
    change: round1(latest - first),
    count: records.length,
    avg7,
    avg30,
    change7,
    change30,
  }
}

/** 连续打卡天数：从今天（或昨天）往回数有记录的连续日历日 */
export function computeStreak(records: WeightRecord[]): number {
  if (!records.length) return 0
  const days = new Set(records.map((r) => dayKey(r.timestamp)))
  let streak = 0
  let cursor = dayjs()
  if (!days.has(cursor.format('YYYY-MM-DD'))) {
    cursor = cursor.subtract(1, 'day')
  }
  while (days.has(cursor.format('YYYY-MM-DD'))) {
    streak++
    cursor = cursor.subtract(1, 'day')
  }
  return streak
}

/** 简单移动平均，与输入对齐；窗口不足时返回 null */
export function movingAverage(values: number[], window: number): (number | null)[] {
  if (window <= 0) return values.map(() => null)
  const out: (number | null)[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      out.push(null)
      continue
    }
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += values[j]
    out.push(round1(sum / window))
  }
  return out
}

/** 达成目标的进度 0–1（以首条记录为起点，target 为终点） */
export function goalProgress(latest: number, first: number, target: number): number {
  if (target === first) return latest <= target ? 1 : 0
  const done = first - latest // 已减（正为减）
  const total = first - target
  if (total === 0) return 0
  const p = done / total
  if (p < 0) return 0
  if (p > 1) return 1
  return p
}

/* ---------------- 导入导出 ---------------- */

export interface ExportRow {
  id: number | string
  weight: number
  bodyFat: string | number
  date: string
  time: string
  period: string
  mealStatus: string
  note: string
}

export function toExportRows(records: WeightRecord[]): ExportRow[] {
  return records.map((r) => ({
    id: r.id ?? '',
    weight: r.weight,
    bodyFat: r.bodyFat ?? '',
    date: dayjs(r.timestamp).format('YYYY-MM-DD'),
    time: dayjs(r.timestamp).format('HH:mm'),
    period: PERIOD_LABELS[r.period],
    mealStatus: mealLabel(r.mealStatus),
    note: r.note ?? '',
  }))
}

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

/** 导出 CSV（带 BOM，Excel 中文不乱码） */
export function exportToCSV(records: WeightRecord[]) {
  if (!records.length) return
  const header = ['id', 'weight', 'bodyFat', 'date', 'time', 'period', 'mealStatus', 'note']
  const rows = toExportRows(records).map((r) =>
    [r.id, r.weight, r.bodyFat, r.date, r.time, r.period, r.mealStatus, r.note]
      .map(csvCell)
      .join(','),
  )
  const csv = [header.map(csvCell).join(','), ...rows].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `体重数据_${dayjs().format('YYYYMMDD_HHmm')}.csv`)
}

/** 导出 JSON */
export function exportToJSON(records: WeightRecord[]) {
  if (!records.length) return
  const data = JSON.stringify(records, null, 2)
  const blob = new Blob([data], { type: 'application/json;charset=utf-8;' })
  saveAs(blob, `体重数据_${dayjs().format('YYYYMMDD_HHmm')}.json`)
}

/**
 * 从 CSV 文本解析记录。兼容导出格式（含表头）。
 * 已存在相同 时间+体重 的记录会被跳过以避免重复。
 */
export function parseCSV(
  text: string,
  existing: WeightRecord[],
): { toAdd: WeightRecord[]; skipped: number } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return { toAdd: [], skipped: 0 }

  const first = lines[0].replace(/^﻿/, '')
  const headers = first.split(',').map((h) => h.replace(/^"|"$/g, '').trim())
  const idx = (name: string) => headers.findIndex((h) => h === name)
  const iDate = idx('date')
  const iTime = idx('time')
  const iWeight = idx('weight')
  const iPeriod = idx('period')
  const iMeal = idx('mealStatus')
  const iNote = idx('note')
  const iFat = idx('bodyFat')
  const hasHeader = iDate >= 0 || iWeight >= 0

  const start = hasHeader ? 1 : 0
  const periodFromLabel = (s: string): Period =>
    s.includes('早') ? 'morning' : s.includes('中') ? 'noon' : s.includes('晚') ? 'evening' : 'morning'
  const mealFromLabel = (s: string): MealStatus =>
    s.includes('饭前') ? 'before' : s.includes('饭后') ? 'after' : ''

  const seen = new Set(existing.map((r) => `${r.timestamp}_${r.weight}`))
  const toAdd: WeightRecord[] = []
  let skipped = 0

  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim())
    const weight = parseFloat(cells[iWeight >= 0 ? iWeight : 1])
    if (!isFinite(weight)) continue
    const date = iDate >= 0 ? cells[iDate] : ''
    const time = iTime >= 0 ? cells[iTime] : '08:00'
    const ts = dayjs(`${date} ${time}`, 'YYYY-MM-DD HH:mm').valueOf()
    if (!isFinite(ts)) continue
    const fatRaw = iFat >= 0 ? cells[iFat] : ''
    const bodyFat = fatRaw !== '' && isFinite(parseFloat(fatRaw)) ? parseFloat(fatRaw) : undefined
    const rec: WeightRecord = {
      weight: round1(weight),
      timestamp: ts,
      period: iPeriod >= 0 ? periodFromLabel(cells[iPeriod]) : getPeriodFromDate(ts),
      mealStatus: iMeal >= 0 ? mealFromLabel(cells[iMeal]) : '',
      note: iNote >= 0 ? cells[iNote] : '',
      ...(bodyFat != null ? { bodyFat: round1(bodyFat) } : {}),
    }
    const key = `${rec.timestamp}_${rec.weight}`
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    toAdd.push(rec)
  }
  return { toAdd, skipped }
}
