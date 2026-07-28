import { useMemo, useState } from 'react'
import type { WeightRecord } from '../db'
import type { Profile as ProfileType, Gender } from '../settings'
import { computeBMI, bmiCategory, round1, goalProgress } from '../utils'
import { useTheme } from '../lib/theme'
import DataManagement from './DataManagement'
import Field from './ui/Field'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { IconSun, IconMoon, IconTarget, IconScale } from './ui/icons'

interface Props {
  profile: ProfileType
  onProfileChange: (patch: Partial<ProfileType>) => void
  records: WeightRecord[]
  onDataChanged: () => void
}

export default function Profile({ profile, onProfileChange, records, onDataChanged }: Props) {
  const { mode, toggle } = useTheme()
  const [targetOpen, setTargetOpen] = useState(false)
  const [targetDraft, setTargetDraft] = useState('')

  const latestWeight = useMemo(() => {
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp)
    return sorted[0]?.weight ?? null
  }, [records])

  const firstWeight = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp)
    return sorted[0]?.weight ?? null
  }, [records])

  const bmi = latestWeight != null ? computeBMI(latestWeight, profile.height) : null
  const bmiCat = bmi != null ? bmiCategory(bmi) : null

  const goalP =
    latestWeight != null && firstWeight != null && profile.target != null
      ? goalProgress(latestWeight, firstWeight, profile.target)
      : 0

  const openTarget = () => {
    setTargetDraft(profile.target != null ? profile.target.toFixed(1) : '')
    setTargetOpen(true)
  }
  const saveTarget = () => {
    const v = parseFloat(targetDraft)
    onProfileChange({ target: isFinite(v) ? round1(v) : null })
    setTargetOpen(false)
  }

  return (
    <div>
      <div className="section-title">身体数据</div>
      <div className="card">
        <div className="ring-wrap" style={{ alignItems: 'stretch' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <IconScale style={{ width: 30, height: 30 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {profile.height ? `${profile.height} cm` : '未填写身高'}
              {profile.age ? ` · ${profile.age} 岁` : ''}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '未设置性别'}
            </div>
            {bmi != null && bmiCat && (
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted" style={{ fontSize: 12 }}>BMI</span>
                <b className="tnum" style={{ fontSize: 16 }}>{bmi.toFixed(1)}</b>
                <span className={`bmi-badge ${bmiCat.tone}`}>{bmiCat.label}</span>
              </div>
            )}
          </div>
        </div>

        <hr className="divider" />

        <Field label="身高 (cm)">
          <input
            className="input tnum"
            type="number"
            min={80}
            max={250}
            placeholder="例如 170"
            value={profile.height ?? ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              onProfileChange({ height: isFinite(v) ? v : null })
            }}
          />
        </Field>
        <Field label="性别">
          <select
            className="select"
            value={profile.gender}
            onChange={(e) => onProfileChange({ gender: e.target.value as Gender })}
          >
            <option value="">不填写</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </Field>
        <Field label="年龄">
          <input
            className="input tnum"
            type="number"
            min={5}
            max={120}
            placeholder="例如 28"
            value={profile.age ?? ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              onProfileChange({ age: isFinite(v) ? Math.round(v) : null })
            }}
          />
        </Field>
      </div>

      {/* 目标体重 */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">
            <span className="dot" /> 目标体重
          </span>
          <button className="card-link" onClick={openTarget}>
            {profile.target != null ? '修改' : '设置'}
          </button>
        </div>
        {profile.target != null ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="stat-value tnum" style={{ fontSize: 26 }}>
                {profile.target.toFixed(1)}
                <span className="suf">kg</span>
              </div>
              {latestWeight != null && (
                <div className="stat-sub">
                  {latestWeight <= profile.target
                    ? '已达成目标 🎉'
                    : `还差 ${round1(latestWeight - profile.target).toFixed(1)} kg`}
                </div>
              )}
            </div>
            <div style={{ width: '50%' }}>
              <div className="progress">
                <span style={{ width: `${Math.round(goalP * 100)}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'right' }}>
                达成 {Math.round(goalP * 100)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>
            设置一个目标体重，帮你追踪减重/增重进度。
          </div>
        )}
      </div>

      {/* 外观 */}
      <div className="section-title">外观</div>
      <div className="card">
        <div className="list-row">
          <span className="lr-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mode === 'dark' ? <IconMoon /> : <IconSun />}
            深色模式
          </span>
          <button className={`toggle ${mode === 'dark' ? 'on' : ''}`} onClick={toggle} aria-label="切换主题" />
        </div>
      </div>

      {/* 数据管理 */}
      <DataManagement records={records} onChanged={onDataChanged} />

      <div className="section-title">关于</div>
      <div className="card">
        <div className="kv">
          <span className="k">应用</span>
          <span className="v">体重管理</span>
        </div>
        <div className="kv">
          <span className="k">版本</span>
          <span className="v">2.0.0</span>
        </div>
        <div className="kv">
          <span className="k">数据存储</span>
          <span className="v">本地（设备内）</span>
        </div>
      </div>

      <Modal
        open={targetOpen}
        onClose={() => setTargetOpen(false)}
        title="设置目标体重"
        footer={
          <>
            <Button variant="default" onClick={() => setTargetOpen(false)}>
              取消
            </Button>
            <Button variant="primary" icon={<IconTarget />} onClick={saveTarget}>
              保存
            </Button>
          </>
        }
      >
        <Field label="目标体重 (kg)">
          <input
            className="input tnum"
            type="number"
            step={0.1}
            min={20}
            max={350}
            placeholder="例如 65.0"
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            autoFocus
          />
        </Field>
        {profile.target != null && (
          <Button variant="danger-soft" block onClick={() => { onProfileChange({ target: null }); setTargetOpen(false) }}>
            清除目标
          </Button>
        )}
      </Modal>
    </div>
  )
}
