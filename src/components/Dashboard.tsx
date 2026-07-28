import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  ReferenceLine,
} from 'recharts'
import type { WeightRecord, Period } from '../db'
import { PERIOD_LABELS } from '../db'
import {
  computeStats,
  computeStreak,
  formatDateTime,
  mealLabel,
  shortLabel,
  movingAverage,
  round1,
} from '../utils'
import { useTheme } from '../lib/theme'
import Empty from './ui/Empty'
import ProgressRing from './ui/ProgressRing'
import {
  IconChart,
  IconFlame,
  IconActivity,
  IconTrendDown,
  IconTrendUp,
  IconAward,
} from './ui/icons'

interface Props {
  records: WeightRecord[]
  target: number | null
  onTargetChange: (v: number | null) => void
}

interface TrendPoint {
  ts: number
  label: string
  weight: number
  period: Period
  meal: string
  ma: number | null
}

function TrendTooltip({ active, payload, palette }: any) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload as TrendPoint
  return (
    <div className="chart-tip" style={{ background: palette.tipBg, border: `1px solid ${palette.tipBorder}`, color: palette.tipText }}>
      <div>{formatDateTime(p.ts)}</div>
      <div className="tip-row">
        <span className="tip-dot" style={{ background: palette.accent }} />
        体重 <b>{p.weight.toFixed(1)} kg</b>
      </div>
      {p.ma != null && (
        <div className="tip-row">
          <span className="tip-dot" style={{ background: palette.trend }} />
          7日均值 <b>{p.ma.toFixed(1)} kg</b>
        </div>
      )}
      <div className="muted" style={{ marginTop: 2 }}>
        {PERIOD_LABELS[p.period]} · {p.meal !== '—' ? p.meal : '未标注'}
      </div>
    </div>
  )
}

export default function Dashboard({ records, target, onTargetChange }: Props) {
  const { palette } = useTheme()

  const stats = useMemo(() => computeStats(records), [records])
  const streak = useMemo(() => computeStreak(records), [records])

  const trend = useMemo<TrendPoint[]>(() => {
    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp)
    const weights = sorted.map((r) => r.weight)
    const ma = movingAverage(weights, 7)
    return sorted.map((r, i) => ({
      ts: r.timestamp,
      label: shortLabel(r.timestamp),
      weight: r.weight,
      period: r.period,
      meal: mealLabel(r.mealStatus),
      ma: ma[i],
    }))
  }, [records])

  const periodAvg = useMemo(() => {
    const periods: Period[] = ['morning', 'noon', 'evening']
    return periods.map((p) => {
      const rs = records.filter((r) => r.period === p)
      const a = rs.length ? rs.reduce((s, r) => s + r.weight, 0) / rs.length : 0
      return { period: PERIOD_LABELS[p], key: p, avg: round1(a), count: rs.length }
    })
  }, [records])

  const mealData = useMemo(() => {
    const avgOf = (rs: WeightRecord[]) =>
      rs.length ? round1(rs.reduce((s, r) => s + r.weight, 0) / rs.length) : 0
    const before = records.filter((r) => r.mealStatus === 'before')
    const after = records.filter((r) => r.mealStatus === 'after')
    return [
      { name: '饭前', weight: avgOf(before), count: before.length },
      { name: '饭后', weight: avgOf(after), count: after.length },
    ]
  }, [records])

  const distData = useMemo(() => {
    const periods: Period[] = ['morning', 'noon', 'evening']
    return periods
      .map((p) => ({
        name: PERIOD_LABELS[p],
        value: records.filter((r) => r.period === p).length,
        key: p,
      }))
      .filter((d) => d.value > 0)
  }, [records])

  if (!records.length) {
    return <Empty icon={<IconChart />} text="暂无数据，先去记录几条体重吧" />
  }

  const periodColor = (p: Period) =>
    p === 'morning' ? palette.morning : p === 'noon' ? palette.noon : palette.evening

  const Dot = (props: any) => {
    const { cx, cy, payload, index } = props
    if (cx == null || cy == null) return null
    return <circle key={index} cx={cx} cy={cy} r={3} fill={periodColor(payload.period)} stroke={palette.tipBg} strokeWidth={1} />
  }

  const change = stats.change
  const goalP =
    target != null && stats.first != null && stats.latest != null
      ? Math.max(0, Math.min(1, (stats.first - stats.latest) / (stats.first - target || 1)))
      : null

  return (
    <div>
      <div className="section-title">概览数据</div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">最新体重</div>
          <div className="stat-value tnum">
            {stats.latest?.toFixed(1)}
            <span className="suf">kg</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">平均体重</div>
          <div className="stat-value tnum">
            {stats.avg.toFixed(1)}
            <span className="suf">kg</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">最低 / 最高</div>
          <div className="stat-value tnum" style={{ fontSize: 18 }}>
            {stats.min.toFixed(1)} / {stats.max.toFixed(1)}
            <span className="suf">kg</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">累计变化</div>
          <div className={`stat-value tnum ${change < 0 ? 'tone-down' : change > 0 ? 'tone-up' : 'tone-flat'}`}>
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}
            <span className="suf">kg</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">近 7 日均值</div>
          <div className="stat-value tnum">
            {stats.avg7 != null ? stats.avg7.toFixed(1) : '—'}
            <span className="suf">kg</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">30 日变化</div>
          <div
            className={`stat-value tnum ${
              stats.change30 == null ? 'tone-flat' : stats.change30 < 0 ? 'tone-down' : 'tone-up'
            }`}
          >
            {stats.change30 == null ? '—' : `${stats.change30 > 0 ? '+' : ''}${stats.change30.toFixed(1)}`}
            <span className="suf">kg</span>
          </div>
        </div>
      </div>

      {/* 目标进度 */}
      {target != null && stats.latest != null && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">
              <span className="dot" /> 目标进度
            </span>
            <button className="card-link" onClick={() => onTargetChange(null)}>
              清除目标
            </button>
          </div>
          <div className="ring-wrap">
            <ProgressRing progress={goalP ?? 0}>
              <div className="ring-pct">{Math.round((goalP ?? 0) * 100)}%</div>
              <div className="ring-cap">达成</div>
            </ProgressRing>
            <div style={{ flex: 1 }}>
              <div className="kv">
                <span className="k">当前</span>
                <span className="v tnum">{stats.latest.toFixed(1)} kg</span>
              </div>
              <div className="kv">
                <span className="k">目标</span>
                <span className="v tnum">{target.toFixed(1)} kg</span>
              </div>
              <div className="kv">
                <span className="k">还差</span>
                <span className="v tnum">
                  {stats.latest <= target ? '已达成 🎉' : `${round1(stats.latest - target).toFixed(1)} kg`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 洞察 */}
      <div className="section-title">智能洞察</div>
      <div className="card" style={{ padding: 14 }}>
        <div className="insight">
          <div className="ins-ico amber">
            <IconFlame />
          </div>
          <div className="ins-body">
            <div className="ins-title">连续打卡</div>
            <div className="ins-desc">{streak > 0 ? '保持记录习惯，继续加油' : '今天还没记录哦'}</div>
          </div>
          <div className="ins-val tnum">{streak}<span style={{ fontSize: 12, color: 'var(--text-3)' }}> 天</span></div>
        </div>

        <div className="insight">
          <div className="ins-ico green">
            <IconActivity />
          </div>
          <div className="ins-body">
            <div className="ins-title">7 日趋势</div>
            <div className="ins-desc">对比上一周均值变化</div>
          </div>
          <div className={`ins-val tnum ${stats.change7 == null ? 'tone-flat' : stats.change7 < 0 ? 'tone-down' : 'tone-up'}`}>
            {stats.change7 == null ? '—' : `${stats.change7 > 0 ? '+' : ''}${stats.change7.toFixed(1)} kg`}
          </div>
        </div>

        <div className="insight">
          <div className="ins-ico accent">
            {change <= 0 ? <IconTrendDown /> : <IconTrendUp />}
          </div>
          <div className="ins-body">
            <div className="ins-title">总体走势</div>
            <div className="ins-desc">
              {change < 0 ? '体重在下降，状态不错' : change > 0 ? '体重有所上升，留意一下' : '体重保持稳定'}
            </div>
          </div>
          <div className={`ins-val tnum ${change < 0 ? 'tone-down' : change > 0 ? 'tone-up' : 'tone-flat'}`}>
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}
          </div>
        </div>

        <div className="insight" style={{ marginBottom: 0 }}>
          <div className="ins-ico rose">
            <IconAward />
          </div>
          <div className="ins-body">
            <div className="ins-title">最佳时段</div>
            <div className="ins-desc">体重最低的测量时段</div>
          </div>
          <div className="ins-val">
            {(() => {
              const best = [...periodAvg].sort((a, b) => a.avg - b.avg)[0]
              return best ? `${best.period} ${best.avg.toFixed(1)} kg` : '—'
            })()}
          </div>
        </div>
      </div>

      {/* 趋势图 */}
      <div className="section-title">体重趋势</div>
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <span className="dot" /> 体重走势 · 7 日均线
          </span>
          <span className="card-subtitle">{records.length} 条</span>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: palette.axis }} minTickGap={28} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: palette.axis }} width={42} />
              <Tooltip content={<TrendTooltip palette={palette} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {target != null && (
                <ReferenceLine y={target} stroke={palette.trend} strokeDasharray="5 4" label={{ value: '目标', fill: palette.axis, fontSize: 10 }} />
              )}
              <Line
                type="monotone"
                dataKey="ma"
                name="7日均值"
                stroke={palette.trend}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="weight"
                name="体重"
                stroke={palette.accent}
                strokeWidth={2.5}
                dot={<Dot />}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 时段均值 */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <span className="dot" /> 各时段平均体重
          </span>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodAvg} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: palette.axis }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: palette.axis }} width={42} />
              <Tooltip
                cursor={{ fill: palette.grid, opacity: 0.4 }}
                formatter={(v: any) => [`${v} kg`, '平均']}
                contentStyle={{ background: palette.tipBg, border: `1px solid ${palette.tipBorder}`, borderRadius: 10, fontSize: 12, color: palette.tipText }}
              />
              <Bar dataKey="avg" name="平均体重" radius={[7, 7, 0, 0]} maxBarSize={64}>
                {periodAvg.map((d) => (
                  <Cell key={d.key} fill={periodColor(d.key)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <span className="card-title">
              <span className="dot" /> 饭前 vs 饭后
            </span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mealData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: palette.axis }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: palette.axis }} width={40} />
                <Tooltip
                  cursor={{ fill: palette.grid, opacity: 0.4 }}
                  formatter={(v: any, n: any) => [`${v} kg`, `${n}（${mealData.find((d) => d.name === n)?.count ?? 0}条）`]}
                  contentStyle={{ background: palette.tipBg, border: `1px solid ${palette.tipBorder}`, borderRadius: 10, fontSize: 12, color: palette.tipText }}
                />
                <Bar dataKey="weight" name="平均体重" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  <Cell fill={palette.meal1} />
                  <Cell fill={palette.meal2} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <span className="card-title">
              <span className="dot" /> 时段分布
            </span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={distData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                >
                  {distData.map((d) => (
                    <Cell key={d.key} fill={periodColor(d.key)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, n: any) => [`${v} 次`, `${n}`]}
                  contentStyle={{ background: palette.tipBg, border: `1px solid ${palette.tipBorder}`, borderRadius: 10, fontSize: 12, color: palette.tipText }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
