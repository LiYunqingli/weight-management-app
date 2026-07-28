import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateSampleRecords, generateSampleWater } from './db'
import { useProfile } from './settings'
import { useTheme } from './lib/theme'
import { pushWidgetSnapshot, consumeWidgetTab } from './lib/widget'
import { computeStats, computeStreak, computeBMI, bmiCategory } from './utils'
import Overview from './components/Overview'
import RecordsList from './components/RecordsList'
import Dashboard from './components/Dashboard'
import Profile from './components/Profile'
import Water from './components/Water'
import AddRecordForm from './components/AddRecordForm'
import Modal from './components/ui/Modal'
import {
  IconHome,
  IconList,
  IconChart,
  IconUser,
  IconPlus,
  IconSun,
  IconMoon,
  IconDroplet,
} from './components/ui/icons'

type TabKey = 'overview' | 'records' | 'analysis' | 'me' | 'water'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: '概览', icon: <IconHome /> },
  { key: 'records', label: '记录', icon: <IconList /> },
  { key: 'analysis', label: '分析', icon: <IconChart /> },
  { key: 'water', label: '喝水', icon: <IconDroplet /> },
  { key: 'me', label: '我的', icon: <IconUser /> },
]

export default function App() {
  const records = useLiveQuery(() => db.records.orderBy('timestamp').reverse().toArray(), [], [])
  const [profile, , patchProfile] = useProfile()
  const { mode, toggle } = useTheme()
  const [active, setActive] = useState<TabKey>('overview')
  const [addOpen, setAddOpen] = useState(false)

  // 首次启动：库为空时生成示例数据，便于直接体验完整界面（可随时在「我的」清空）
  useEffect(() => {
    const KEY = 'wm_seeded_v1'
    if (localStorage.getItem(KEY)) return
    ;(async () => {
      const count = await db.records.count()
      if (count === 0) {
        await db.records.bulkAdd(generateSampleRecords(14))
      }
      localStorage.setItem(KEY, '1')
    })()
  }, [])

  // 首次启动：饮水表示例数据（独立 key，不影响体重示例数据）
  useEffect(() => {
    const KEY = 'wm_water_seeded_v1'
    if (localStorage.getItem(KEY)) return
    ;(async () => {
      const count = await db.waters.count()
      if (count === 0) {
        await db.waters.bulkAdd(generateSampleWater(14))
      }
      localStorage.setItem(KEY, '1')
    })()
  }, [])

  // 数据/目标变化时，把多维数据快照推给原生，刷新桌面小组件
  useEffect(() => {
    const s = computeStats(records)
    const hasTarget = profile.target != null && s.first != null && s.latest != null
    const progress = hasTarget
      ? Math.max(0, Math.min(1, (s.first! - s.latest!) / (s.first! - profile.target! || 1)))
      : null

    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp)
    const latest = sorted[0]?.weight ?? null
    const prev = sorted[1]?.weight ?? null

    const bmi = latest != null ? computeBMI(latest, profile.height) : null
    const bmiCat = bmi != null ? bmiCategory(bmi) : null

    const avgOf = (rs: typeof records) =>
      rs.length ? Math.round((rs.reduce((sum, r) => sum + r.weight, 0) / rs.length) * 10) / 10 : null
    const periodMorning = avgOf(records.filter((r) => r.period === 'morning'))
    const periodNoon = avgOf(records.filter((r) => r.period === 'noon'))
    const periodEvening = avgOf(records.filter((r) => r.period === 'evening'))

    const streak = computeStreak(records)

    pushWidgetSnapshot({
      latest,
      prev,
      target: profile.target,
      progress,
      avg: s.avg,
      min: s.min,
      max: s.max,
      change: s.change,
      avg7: s.avg7,
      change7: s.change7,
      change30: s.change30,
      bmi,
      bmiLabel: bmiCat?.label ?? null,
      bmiTone: bmiCat?.tone ?? null,
      streak,
      count: s.count,
      periodMorning,
      periodNoon,
      periodEvening,
      updatedAt: Date.now(),
    })
  }, [records, profile.target, profile.height])

  // 小组件点击：消费「直达分析页」深链 / 监听运行中的事件
  useEffect(() => {
    const openAnalysis = (tab: string | null) => {
      if (tab === 'analysis') setActive('analysis')
    }
    consumeWidgetTab().then(openAnalysis)
    const onTab = () => openAnalysis('analysis')
    window.addEventListener('widget-tab', onTab)
    return () => window.removeEventListener('widget-tab', onTab)
  }, [])

  const navigate = (t: TabKey) => setActive(t)

  return (
    <div className="app-shell">
      {/* 顶部应用栏 */}
      <header className="app-header">
        <div className="brand">
          <span className="logo">⚖</span>
          体重管理
        </div>
        <div className="head-actions">
          <button
            className="btn btn-ghost btn-icon"
            onClick={toggle}
            aria-label="切换主题"
            data-tip={mode === 'dark' ? '切换浅色' : '切换深色'}
          >
            {mode === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>

      {/* 内容区 */}
      <main className="app-content">
        {active === 'overview' && (
          <Overview
            records={records}
            profile={profile}
            onNavigate={navigate}
            onQuickAdd={() => setAddOpen(true)}
          />
        )}
        {active === 'records' && <RecordsList records={records} />}
        {active === 'analysis' && (
          <Dashboard
            records={records}
            target={profile.target}
            onTargetChange={(v) => patchProfile({ target: v })}
          />
        )}
        {active === 'water' && <Water />}
        {active === 'me' && (
          <Profile
            profile={profile}
            onProfileChange={patchProfile}
            records={records}
            onDataChanged={() => {}}
          />
        )}
      </main>

      {/* 悬浮添加按钮 */}
      <button className="fab" onClick={() => setAddOpen(true)} aria-label="添加记录">
        <IconPlus />
      </button>

      {/* 底部导航 */}
      <nav className="app-tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${active === t.key ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* 添加记录底部弹层 */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="记录体重"
        footer={
          <button className="btn btn-default btn-block" onClick={() => setAddOpen(false)}>
            完成
          </button>
        }
      >
        <AddRecordForm onDone={() => setAddOpen(false)} />
      </Modal>
    </div>
  )
}
