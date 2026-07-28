import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WaterRecord } from '../db'
import { useWaterSettings } from '../waterSettings'
import { useToast } from '../lib/toast'
import { dayKey, relativeDay, formatTime } from '../utils'
import Field from './ui/Field'
import Button from './ui/Button'
import Modal from './ui/Modal'
import ProgressRing from './ui/ProgressRing'
import Empty from './ui/Empty'
import { IconDroplet, IconPlus, IconTrash, IconCheck, IconCalendar } from './ui/icons'

const CUP_PRESETS = [200, 250, 300, 350, 500]
const GOAL_PRESETS = [1500, 2000, 2500, 3000]

interface DailyTotal {
  key: string
  date: number
  total: number
  cups: number
}

function buildDaily(records: WaterRecord[]): Map<string, DailyTotal> {
  const map = new Map<string, DailyTotal>()
  for (const r of records) {
    const key = dayKey(r.timestamp)
    const cur = map.get(key) ?? { key, date: r.timestamp, total: 0, cups: 0 }
    cur.total += r.amount
    cur.cups += 1
    map.set(key, cur)
  }
  return map
}

/** 连续天数：从今天（或昨天）往回数，满足「达标」或「当天有记录」的连续日历日 */
function computeStreak(daily: Map<string, DailyTotal>, goalMl: number | null): number {
  if (daily.size === 0) return 0
  const meets = (d: DailyTotal) => (goalMl == null ? d.cups > 0 : d.total >= goalMl)
  let cursor = dayjs()
  if (!daily.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day')
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = daily.get(cursor.format('YYYY-MM-DD'))
    if (d && meets(d)) {
      streak++
      cursor = cursor.subtract(1, 'day')
    } else break
  }
  return streak
}

function toLocalInput(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DDTHH:mm')
}

export default function Water() {
  const toast = useToast()
  const [settings, patch] = useWaterSettings()
  const waters = useLiveQuery(
    () => db.waters.orderBy('timestamp').reverse().toArray(),
    [],
    [] as WaterRecord[],
  )
  const [customOpen, setCustomOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState(String(settings.cupMl))
  const [customTime, setCustomTime] = useState(toLocalInput(Date.now()))

  const goal = settings.goalMl

  const daily = useMemo(() => buildDaily(waters), [waters])
  const todayKey = dayKey(Date.now())
  const today = daily.get(todayKey)
  const todayTotal = today?.total ?? 0
  const todayCups = today?.cups ?? 0

  const ringP =
    goal != null ? Math.max(0, Math.min(1, todayTotal / goal)) : Math.min(1, todayTotal / 2500)
  const meetGoal = goal != null && todayTotal >= goal

  const { avg7, bestDay } = useMemo(() => {
    const start = dayjs().startOf('day')
    let sum = 0
    for (let i = 0; i < 7; i++) {
      const d = daily.get(start.subtract(i, 'day').format('YYYY-MM-DD'))
      sum += d?.total ?? 0
    }
    let best = 0
    daily.forEach((d) => {
      if (d.total > best) best = d.total
    })
    return { avg7: Math.round(sum / 7), bestDay: best }
  }, [daily])

  const streak = useMemo(() => computeStreak(daily, goal), [daily, goal])

  const history = useMemo(
    () => [...daily.values()].sort((a, b) => b.date - a.date).slice(0, 14),
    [daily],
  )

  const todayList = useMemo(
    () =>
      waters
        .filter((w) => dayKey(w.timestamp) === todayKey)
        .sort((a, b) => b.timestamp - a.timestamp),
    [waters, todayKey],
  )

  const adjustCup = (delta: number) => {
    const next = Math.max(50, Math.min(1000, settings.cupMl + delta))
    patch({ cupMl: next })
  }

  const drinkCup = async () => {
    try {
      await db.waters.add({ amount: settings.cupMl, timestamp: Date.now() })
      toast.success(`已记录一杯 · +${settings.cupMl} ml`)
    } catch {
      toast.error('记录失败，请重试')
    }
  }

  const removeCup = async (id?: number) => {
    if (id == null) return
    try {
      await db.waters.delete(id)
      toast.success('已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const openCustom = () => {
    setCustomAmount(String(settings.cupMl))
    setCustomTime(toLocalInput(Date.now()))
    setCustomOpen(true)
  }

  const saveCustom = async () => {
    const amt = parseInt(customAmount, 10)
    const t = dayjs(customTime).valueOf()
    if (!isFinite(amt) || amt <= 0) return toast.error('请输入有效水量')
    if (amt > 3000) return toast.error('单次水量过大（≤3000ml）')
    if (!isFinite(t)) return toast.error('请选择饮水时间')
    try {
      await db.waters.add({ amount: amt, timestamp: t })
      toast.success(`已记录 · +${amt} ml`)
      setCustomOpen(false)
    } catch {
      toast.error('记录失败，请重试')
    }
  }

  return (
    <div>
      {/* 今日饮水 hero */}
      <div className="hero water">
        <div className="hero-top">
          <div>
            <div className="hero-label">今日饮水</div>
            <div className="hero-weight">
              <span className="hero-big tnum">{todayTotal}</span>
              <span className="hero-unit">ml</span>
            </div>
            <div className={`hero-delta ${meetGoal ? 'down' : ''}`}>
              {todayCups} 杯{goal != null ? ` · 目标 ${goal} ml` : ' · 未设目标'}
            </div>
          </div>
          <ProgressRing
            progress={ringP}
            size={84}
            stroke={9}
            color="var(--water)"
            track="rgba(255,255,255,0.22)"
          >
            <div className="ring-pct" style={{ color: '#fff', fontSize: 17 }}>
              {goal != null ? `${Math.round(ringP * 100)}%` : `${todayCups}杯`}
            </div>
            {goal != null && (
              <div className="ring-cap" style={{ color: 'rgba(255,255,255,0.82)' }}>达成度</div>
            )}
          </ProgressRing>
        </div>
      </div>

      {/* 喝一杯 CTA */}
      <div className="card">
        <button className="water-cta" onClick={drinkCup}>
          <IconDroplet /> 喝一杯 +{settings.cupMl} ml
        </button>
        <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
          <button className="link-btn water" onClick={openCustom}>
            <IconPlus /> 自定义水量 / 时间
          </button>
        </div>
      </div>

      {/* 设置：水杯容量 + 每日目标 */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <span className="dot" style={{ background: 'var(--water)' }} /> 设置
          </span>
        </div>

        <Field label="水杯容量 (ml)" hint="点击「喝一杯」即记录该容量的一杯水">
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              style={{ color: 'var(--water)' }}
              onClick={() => adjustCup(-10)}
              aria-label="减少"
            >
              −
            </button>
            <input
              className="input stepper-input tnum"
              type="number"
              inputMode="numeric"
              step={10}
              min={50}
              max={1000}
              value={settings.cupMl}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (isFinite(v)) patch({ cupMl: v })
              }}
            />
            <button
              type="button"
              className="stepper-btn"
              style={{ color: 'var(--water)' }}
              onClick={() => adjustCup(10)}
              aria-label="增加"
            >
              +
            </button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 10, gap: 8 }}>
            {CUP_PRESETS.map((p) => (
              <button
                key={p}
                className={`preset ${settings.cupMl === p ? 'on' : ''}`}
                onClick={() => patch({ cupMl: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="每日目标 (ml)" hint="可选，留空则不显示目标进度">
          <input
            className="input tnum"
            type="number"
            inputMode="numeric"
            step={100}
            min={500}
            max={6000}
            placeholder="例如 2000"
            value={goal ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : parseInt(e.target.value, 10)
              patch({ goalMl: v })
            }}
          />
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 10, gap: 8 }}>
            {GOAL_PRESETS.map((p) => (
              <button
                key={p}
                className={`preset ${goal === p ? 'on' : ''}`}
                onClick={() => patch({ goalMl: p })}
              >
                {p}
              </button>
            ))}
            {goal != null && (
              <button className="preset" onClick={() => patch({ goalMl: null })}>
                不设置
              </button>
            )}
          </div>
        </Field>
      </div>

      {/* 今日记录 */}
      <div className="card flush">
        <div className="card-head" style={{ padding: '16px 16px 4px' }}>
          <span className="card-title">
            <span className="dot" style={{ background: 'var(--water)' }} /> 今日记录
          </span>
          <span className="card-subtitle">{todayCups} 杯</span>
        </div>
        {todayList.length === 0 ? (
          <div style={{ padding: '22px 16px' }}>
            <Empty icon={<IconDroplet />} text="今天还没喝水，点上方按钮记录一杯吧" />
          </div>
        ) : (
          <div style={{ padding: '0 16px 8px' }}>
            {todayList.map((w) => (
              <div className="record" key={w.id}>
                <div
                  className="record-dot"
                  style={{
                    background: 'linear-gradient(140deg, var(--water-2), var(--water-press))',
                  }}
                >
                  <IconDroplet />
                </div>
                <div className="record-main">
                  <div className="record-weight tnum">
                    {w.amount}
                    <span className="suf">ml</span>
                  </div>
                  <div className="record-meta">
                    {formatTime(w.timestamp)}
                    {w.note ? ` · ${w.note}` : ''}
                  </div>
                </div>
                <div className="record-actions">
                  <button className="act danger" onClick={() => removeCup(w.id)} aria-label="删除">
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 历史 14 天 */}
      <div className="card flush">
        <div className="card-head" style={{ padding: '16px 16px 4px' }}>
          <span className="card-title">
            <span className="dot" style={{ background: 'var(--water)' }} /> 历史记录
          </span>
          <span className="card-subtitle">近 14 天</span>
        </div>
        <div style={{ padding: '0 16px 8px' }}>
          {history.length === 0 ? (
            <div style={{ padding: '22px 16px' }}>
              <Empty icon={<IconDroplet />} text="暂无历史记录" />
            </div>
          ) : (
            history.map((d) => {
              const p =
                goal != null
                  ? Math.max(0, Math.min(1, d.total / goal))
                  : Math.min(1, d.total / 2500)
              const met = goal != null && d.total >= goal
              return (
                <div className="wday" key={d.key}>
                  <div className="wday-top">
                    <span className="wday-date">{relativeDay(d.date)}</span>
                    <span className="wday-total tnum">
                      {d.total}
                      <span className="suf">ml</span>
                    </span>
                  </div>
                  <div className="progress water">
                    <span style={{ width: `${Math.round(p * 100)}%` }} />
                  </div>
                  <div className="wday-meta">
                    {d.cups} 杯{goal != null && met ? ' · 已达标 ✓' : ''}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 数据统计 */}
      <div className="section-title">数据统计</div>
      <div className="stat-grid cols-3">
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--water-soft)', color: 'var(--water)' }}>
            <IconDroplet />
          </div>
          <div className="stat-value tnum">{todayTotal}</div>
          <div className="stat-sub">今日 ml</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--water-soft)', color: 'var(--water)' }}>
            <IconPlus />
          </div>
          <div className="stat-value tnum">{todayCups}</div>
          <div className="stat-sub">今日杯数</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--water-soft)', color: 'var(--water)' }}>
            <IconCalendar />
          </div>
          <div className="stat-value tnum">{avg7}</div>
          <div className="stat-sub">7 日日均 ml</div>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value tnum">{streak}</div>
          <div className="stat-sub">{goal != null ? '达标连续天数' : '打卡连续天数'}</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum">{bestDay}</div>
          <div className="stat-sub">单日最高 ml</div>
        </div>
      </div>

      {/* 自定义饮水弹层 */}
      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="自定义饮水"
        footer={
          <>
            <Button variant="default" onClick={() => setCustomOpen(false)}>
              取消
            </Button>
            <Button variant="primary" icon={<IconCheck />} onClick={saveCustom}>
              记录
            </Button>
          </>
        }
      >
        <Field label="水量 (ml)">
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              style={{ color: 'var(--water)' }}
              onClick={() =>
                setCustomAmount(String(Math.max(0, (parseInt(customAmount, 10) || 0) - 50)))
              }
              aria-label="减少"
            >
              −
            </button>
            <input
              className="input stepper-input tnum"
              type="number"
              inputMode="numeric"
              step={50}
              min={0}
              max={3000}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
            <button
              type="button"
              className="stepper-btn"
              style={{ color: 'var(--water)' }}
              onClick={() =>
                setCustomAmount(String((parseInt(customAmount, 10) || 0) + 50))
              }
              aria-label="增加"
            >
              +
            </button>
          </div>
        </Field>
        <Field label="饮水时间">
          <input
            className="input"
            type="datetime-local"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  )
}
