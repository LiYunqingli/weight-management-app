import { useState } from 'react'
import dayjs from 'dayjs'
import type { WeightRecord, MealStatus } from '../db'
import { db, getPeriodFromDate } from '../db'
import { periodLabel, round1 } from '../utils'
import { useToast } from '../lib/toast'
import Field from './ui/Field'
import Button from './ui/Button'
import { IconCheck } from './ui/icons'

interface Props {
  onAdded?: () => void
  onDone?: () => void
  initialWeight?: number
}

function toLocalInput(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DDTHH:mm')
}

export default function AddRecordForm({ onAdded, onDone, initialWeight }: Props) {
  const toast = useToast()
  const [weight, setWeight] = useState<string>(
    initialWeight != null ? initialWeight.toFixed(1) : '',
  )
  const [timestamp, setTimestamp] = useState<string>(toLocalInput(Date.now()))
  const [mealStatus, setMealStatus] = useState<MealStatus>('')
  const [bodyFat, setBodyFat] = useState<string>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const tsVal = dayjs(timestamp).valueOf()
  const period = getPeriodFromDate(isFinite(tsVal) ? tsVal : Date.now())

  const adjust = (delta: number) => {
    setWeight((w) => {
      const cur = parseFloat(w)
      const base = isFinite(cur) ? cur : 70
      const next = Math.max(20, Math.min(350, base + delta))
      return round1(next).toFixed(1)
    })
  }

  const submit = async () => {
    const w = parseFloat(weight)
    if (!isFinite(w)) return toast.error('请输入体重')
    if (w < 20 || w > 350) return toast.error('体重应在 20–350 kg 之间')
    const t = dayjs(timestamp).valueOf()
    if (!isFinite(t)) return toast.error('请选择测量时间')

    setSaving(true)
    const fatNum = parseFloat(bodyFat)
    const rec: WeightRecord = {
      weight: round1(w),
      timestamp: t,
      period: getPeriodFromDate(t),
      mealStatus,
      note: note.trim(),
      ...(isFinite(fatNum) ? { bodyFat: round1(fatNum) } : {}),
    }
    try {
      await db.records.add(rec)
      toast.success(`已保存 · 自动归类「${periodLabel(rec.period)}」`)
      setWeight('')
      setBodyFat('')
      setNote('')
      setMealStatus('')
      setTimestamp(toLocalInput(Date.now()))
      onAdded?.()
      onDone?.()
    } catch {
      toast.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Field label="体重 (kg)">
        <div className="stepper">
          <button type="button" className="stepper-btn" onClick={() => adjust(-0.1)} aria-label="减少">
            −
          </button>
          <input
            className="input stepper-input tnum"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={20}
            max={350}
            placeholder="65.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <button type="button" className="stepper-btn" onClick={() => adjust(0.1)} aria-label="增加">
            +
          </button>
        </div>
      </Field>

      <Field label="测量时间">
        <input
          className="input"
          type="datetime-local"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
        />
      </Field>

      <Field label="自动归类时段" hint="系统按测量时间自动判断：05–11 早 / 11–17 中 / 其余 晚">
        <div className="row">
          <span className={`chip ${period}`}>{periodLabel(period)}</span>
        </div>
      </Field>

      <Field label="饭前 / 饭后" hint="可选，默认留空">
        <select
          className="select"
          value={mealStatus}
          onChange={(e) => setMealStatus(e.target.value as MealStatus)}
        >
          <option value="">未选择</option>
          <option value="before">饭前</option>
          <option value="after">饭后</option>
        </select>
      </Field>

      <Field label="体脂率 (%)" hint="可选">
        <input
          className="input tnum"
          type="number"
          inputMode="decimal"
          step={0.1}
          min={3}
          max={60}
          placeholder="例如 20.5"
          value={bodyFat}
          onChange={(e) => setBodyFat(e.target.value)}
        />
      </Field>

      <Field label="备注" hint="可选，最多 100 字">
        <textarea
          className="textarea"
          rows={2}
          maxLength={100}
          placeholder="例如：运动后 / 感冒中"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <Button variant="primary" block loading={saving} onClick={submit} icon={<IconCheck />}>
        保存记录
      </Button>
    </div>
  )
}
