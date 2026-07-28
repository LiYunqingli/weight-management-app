import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { WeightRecord, MealStatus, Period } from '../db'
import { db } from '../db'
import { round1 } from '../utils'
import { useToast } from '../lib/toast'
import RecordItem from './RecordItem'
import Empty from './ui/Empty'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Field from './ui/Field'
import { IconList } from './ui/icons'

type Filter = 'all' | Period

interface Props {
  records: WeightRecord[]
  onChange?: () => void
}

function toLocalInput(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DDTHH:mm')
}

export default function RecordsList({ records, onChange }: Props) {
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<WeightRecord | null>(null)
  const [deleting, setDeleting] = useState<WeightRecord | null>(null)

  const filtered = useMemo(() => {
    const list = filter === 'all' ? records : records.filter((r) => r.period === filter)
    return [...list].sort((a, b) => b.timestamp - a.timestamp)
  }, [records, filter])

  const counts = useMemo(() => {
    return {
      all: records.length,
      morning: records.filter((r) => r.period === 'morning').length,
      noon: records.filter((r) => r.period === 'noon').length,
      evening: records.filter((r) => r.period === 'evening').length,
    }
  }, [records])

  // ---- edit state ----
  const [eWeight, setEWeight] = useState('')
  const [eTs, setETs] = useState('')
  const [eMeal, setEMeal] = useState<MealStatus>('')
  const [eFat, setEFat] = useState('')
  const [eNote, setENote] = useState('')

  const openEdit = (r: WeightRecord) => {
    setEditing(r)
    setEWeight(r.weight.toFixed(1))
    setETs(toLocalInput(r.timestamp))
    setEMeal(r.mealStatus)
    setEFat(r.bodyFat != null ? String(r.bodyFat) : '')
    setENote(r.note ?? '')
  }

  const saveEdit = async () => {
    if (!editing?.id) return
    const w = parseFloat(eWeight)
    if (!isFinite(w) || w < 20 || w > 350) return toast.error('体重应在 20–350 kg 之间')
    const t = dayjs(eTs).valueOf()
    if (!isFinite(t)) return toast.error('请选择测量时间')
    const h = dayjs(t).hour()
    const period: Period = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'noon' : 'evening'
    const fatNum = parseFloat(eFat)
    await db.records.update(editing.id, {
      weight: round1(w),
      timestamp: t,
      period,
      mealStatus: eMeal,
      note: eNote.trim(),
      ...(isFinite(fatNum) ? { bodyFat: round1(fatNum) } : { bodyFat: undefined as unknown as number }),
    })
    toast.success('已更新记录')
    setEditing(null)
    onChange?.()
  }

  const confirmDelete = async () => {
    if (!deleting?.id) return
    await db.records.delete(deleting.id)
    toast.success('已删除')
    setDeleting(null)
    onChange?.()
  }

  if (!records.length) {
    return (
      <Empty
        icon={<IconList />}
        text="还没有记录，点击右下角 + 添加第一条吧"
      />
    )
  }

  return (
    <div>
      <div className="card">
        <div className="segmented">
          {([
            { label: `全部 ${counts.all}`, value: 'all' as const },
            { label: `早 ${counts.morning}`, value: 'morning' as const },
            { label: `中 ${counts.noon}`, value: 'noon' as const },
            { label: `晚 ${counts.evening}`, value: 'evening' as const },
          ] as { label: string; value: Filter }[]).map((o) => (
            <button
              key={o.value}
              className={`seg-item ${filter === o.value ? 'active' : ''}`}
              onClick={() => setFilter(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card flush">
        <div style={{ padding: '4px 16px' }}>
          {filtered.length ? (
            filtered.map((r) => (
              <RecordItem
                key={r.id}
                record={r}
                onEdit={openEdit}
                onDelete={(rec) => setDeleting(rec)}
              />
            ))
          ) : (
            <Empty icon={<IconList />} text="该时段暂无记录" />
          )}
        </div>
      </div>

      {/* 编辑弹层 */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="编辑记录"
        footer={
          <>
            <Button variant="default" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button variant="primary" onClick={saveEdit}>
              保存
            </Button>
          </>
        }
      >
        <Field label="体重 (kg)">
          <input
            className="input tnum"
            type="number"
            step={0.1}
            value={eWeight}
            onChange={(e) => setEWeight(e.target.value)}
          />
        </Field>
        <Field label="测量时间">
          <input
            className="input"
            type="datetime-local"
            value={eTs}
            onChange={(e) => setETs(e.target.value)}
          />
        </Field>
        <Field label="饭前 / 饭后">
          <select className="select" value={eMeal} onChange={(e) => setEMeal(e.target.value as MealStatus)}>
            <option value="">未选择</option>
            <option value="before">饭前</option>
            <option value="after">饭后</option>
          </select>
        </Field>
        <Field label="体脂率 (%)">
          <input
            className="input tnum"
            type="number"
            step={0.1}
            value={eFat}
            onChange={(e) => setEFat(e.target.value)}
          />
        </Field>
        <Field label="备注">
          <textarea className="textarea" rows={2} value={eNote} onChange={(e) => setENote(e.target.value)} />
        </Field>
      </Modal>

      {/* 删除确认 */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="删除记录"
        variant="center"
        grabber={false}
        footer={
          <>
            <Button variant="default" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              删除
            </Button>
          </>
        }
      >
        <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
          确认删除这条 {deleting?.weight.toFixed(1)} kg 的记录吗？此操作不可恢复。
        </p>
      </Modal>
    </div>
  )
}
