import type { WeightRecord } from '../db'
import { PERIOD_LABELS } from '../db'
import { relativeDay, formatTime, mealLabel } from '../utils'
import { IconEdit, IconTrash } from './ui/icons'

interface Props {
  record: WeightRecord
  onEdit?: (r: WeightRecord) => void
  onDelete?: (r: WeightRecord) => void
  compact?: boolean
}

export default function RecordItem({ record, onEdit, onDelete, compact }: Props) {
  return (
    <div className="record">
      <div className={`record-dot ${record.period}`}>{PERIOD_LABELS[record.period]}</div>
      <div className="record-main">
        <div className="record-weight tnum">
          {record.weight.toFixed(1)}
          <span className="suf">kg</span>
          {record.bodyFat != null && !compact && (
            <span className="chip" style={{ marginLeft: 8 }}>
              脂 {record.bodyFat.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="record-meta">
          <span>{relativeDay(record.timestamp)} · {formatTime(record.timestamp)}</span>
          {record.mealStatus && <span className={`chip ${record.period}`}>{mealLabel(record.mealStatus)}</span>}
          {record.note && <span className="record-note">· {record.note}</span>}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="record-actions">
          {onEdit && (
            <button className="act" onClick={() => onEdit(record)} aria-label="编辑">
              <IconEdit />
            </button>
          )}
          {onDelete && (
            <button className="act danger" onClick={() => onDelete(record)} aria-label="删除">
              <IconTrash />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
