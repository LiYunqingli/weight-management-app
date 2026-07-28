import { useMemo } from 'react'
import type { WeightRecord } from '../db'
import type { Profile } from '../settings'
import {
  computeStats,
  computeStreak,
  computeBMI,
  bmiCategory,
  round1,
} from '../utils'
import RecordItem from './RecordItem'
import ProgressRing from './ui/ProgressRing'
import Button from './ui/Button'
import Empty from './ui/Empty'
import {
  IconScale,
  IconFlame,
  IconActivity,
  IconTrendDown,
  IconTrendUp,
  IconPlus,
  IconChevronRight,
  IconChart,
} from './ui/icons'

interface Props {
  records: WeightRecord[]
  profile: Profile
  onNavigate: (tab: 'records' | 'analysis' | 'me') => void
  onQuickAdd: () => void
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 280
  const h = 46
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / span) * (h - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = pts[pts.length - 1].split(',').map(Number)
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
    </svg>
  )
}

export default function Overview({ records, profile, onNavigate, onQuickAdd }: Props) {
  const stats = useMemo(() => computeStats(records), [records])
  const streak = useMemo(() => computeStreak(records), [records])

  const sorted = useMemo(() => [...records].sort((a, b) => b.timestamp - a.timestamp), [records])
  const latest = sorted[0]?.weight ?? null
  const prev = sorted[1]?.weight ?? null
  const delta = latest != null && prev != null ? round1(latest - prev) : null

  const bmi = latest != null ? computeBMI(latest, profile.height) : null
  const bmiCat = bmi != null ? bmiCategory(bmi) : null

  const recent = sorted.slice(0, 4)
  const sparkValues = useMemo(
    () => [...records].sort((a, b) => a.timestamp - b.timestamp).slice(-14).map((r) => r.weight),
    [records],
  )

  const goalP =
    profile.target != null && stats.first != null && latest != null
      ? Math.max(0, Math.min(1, (stats.first - latest) / (stats.first - profile.target || 1)))
      : null

  if (!records.length) {
    return (
      <div className="card">
        <Empty
          icon={<IconScale />}
          text="还没有任何记录"
          action={
            <Button variant="primary" icon={<IconPlus />} onClick={onQuickAdd}>
              添加第一条记录
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-label">当前体重</div>
            <div className="hero-weight">
              <span className="hero-big tnum">{latest != null ? latest.toFixed(1) : '--'}</span>
              <span className="hero-unit">kg</span>
            </div>
            {delta != null && (
              <div className={`hero-delta ${delta < 0 ? 'down' : delta > 0 ? 'up' : ''}`}>
                {delta < 0 ? '▼' : delta > 0 ? '▲' : '—'} {Math.abs(delta).toFixed(1)} kg 较上次
              </div>
            )}
          </div>
          <div className="hero-goal">
            {profile.target != null ? (
              <>
                <div style={{ opacity: 0.82 }}>目标</div>
                <div className="tnum" style={{ fontSize: 18, fontWeight: 700 }}>
                  {profile.target.toFixed(1)}
                  <span style={{ fontSize: 12, fontWeight: 500 }}> kg</span>
                </div>
                {latest != null && (
                  <div style={{ marginTop: 4 }}>
                    {latest <= profile.target ? '已达成 🎉' : `差 ${round1(latest - profile.target).toFixed(1)} kg`}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => onNavigate('me')}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                设置目标 →
              </button>
            )}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 14 }}>
          <Sparkline values={sparkValues} color="rgba(255,255,255,0.85)" />
        </div>
      </div>

      {/* BMI + 目标进度 */}
      <div className="stat-grid">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <span className="card-title">
              <span className="dot" /> BMI
            </span>
            {bmiCat && <span className={`bmi-badge ${bmiCat.tone}`}>{bmiCat.label}</span>}
          </div>
          {bmi != null ? (
            <>
              <div className="stat-value tnum" style={{ fontSize: 26 }}>
                {bmi.toFixed(1)}
              </div>
              <div className="stat-sub">参考范围 {bmiCat?.range}</div>
            </>
          ) : (
            <>
              <div className="muted" style={{ fontSize: 13 }}>未设置身高</div>
              <button className="card-link" style={{ padding: '6px 0' }} onClick={() => onNavigate('me')}>
                去设置身高 <IconChevronRight />
              </button>
            </>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <span className="card-title">
              <span className="dot" /> 目标进度
            </span>
          </div>
          {goalP != null ? (
            <div className="ring-wrap" style={{ justifyContent: 'center' }}>
              <ProgressRing progress={goalP} size={76} stroke={8}>
                <div className="ring-pct" style={{ fontSize: 16 }}>{Math.round(goalP * 100)}%</div>
              </ProgressRing>
            </div>
          ) : (
            <>
              <div className="muted" style={{ fontSize: 13 }}>未设置目标</div>
              <button className="card-link" style={{ padding: '6px 0' }} onClick={() => onNavigate('me')}>
                设置目标体重 →
              </button>
            </>
          )}
        </div>
      </div>

      {/* 快速统计 */}
      <div className="stat-grid cols-3">
        <div className="stat">
          <div className="stat-ico"><IconFlame /></div>
          <div className="stat-value tnum">{streak}</div>
          <div className="stat-sub">连续天数</div>
        </div>
        <div className="stat">
          <div className="stat-ico"><IconActivity /></div>
          <div className="stat-value tnum">{stats.avg7 != null ? stats.avg7.toFixed(1) : '—'}</div>
          <div className="stat-sub">7 日均值 kg</div>
        </div>
        <div className="stat">
          <div className="stat-ico">
            {stats.change != null && stats.change <= 0 ? <IconTrendDown /> : <IconTrendUp />}
          </div>
          <div className={`stat-value tnum ${stats.change < 0 ? 'tone-down' : stats.change > 0 ? 'tone-up' : 'tone-flat'}`}>
            {stats.change > 0 ? '+' : ''}
            {stats.change.toFixed(1)}
          </div>
          <div className="stat-sub">累计变化 kg</div>
        </div>
      </div>

      {/* 最近记录 */}
      <div className="card flush">
        <div className="card-head" style={{ padding: '16px 16px 4px' }}>
          <span className="card-title">
            <span className="dot" /> 最近记录
          </span>
          <button className="card-link" onClick={() => onNavigate('records')}>
            查看全部 <IconChevronRight />
          </button>
        </div>
        <div style={{ padding: '0 16px 8px' }}>
          {recent.map((r) => (
            <RecordItem key={r.id} record={r} compact />
          ))}
        </div>
      </div>

      {/* 快捷入口 */}
      <button
        className="card"
        onClick={() => onNavigate('analysis')}
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: '1px solid var(--border)' }}
      >
        <div className="stat-ico" style={{ margin: 0 }}><IconChart /></div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>查看详细分析</div>
          <div className="muted" style={{ fontSize: 12 }}>趋势图 · 时段对比 · 智能洞察</div>
        </div>
        <IconChevronRight style={{ width: 20, height: 20, color: 'var(--text-3)' }} />
      </button>
    </div>
  )
}
