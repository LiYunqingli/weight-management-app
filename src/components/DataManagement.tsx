import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { WeightRecord } from '../db'
import { db, generateSampleRecords, generateSampleWater } from '../db'
import { exportToCSV, exportToJSON, parseCSV } from '../utils'
import { useToast } from '../lib/toast'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { IconDownload, IconUpload, IconTrash, IconDroplet } from './ui/icons'

interface Props {
  records: WeightRecord[]
  onChanged: () => void
}

export default function DataManagement({ records, onChanged }: Props) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  // 饮水记录数（实时），用于「示例与维护」的关联统计
  const waterCount = useLiveQuery(() => db.waters.count(), []) ?? 0

  const handleExportCSV = () => {
    if (!records.length) return toast.warning('当前没有可导出的数据')
    exportToCSV(records)
    toast.success('CSV 已导出')
  }

  const handleExportJSON = () => {
    if (!records.length) return toast.warning('当前没有可导出的数据')
    exportToJSON(records)
    toast.success('JSON 已导出')
  }

  const handleSample = async () => {
    const samples = generateSampleRecords(14)
    const waterSamples = generateSampleWater(14)
    await db.transaction('rw', db.records, db.waters, async () => {
      await db.records.bulkAdd(samples)
      await db.waters.bulkAdd(waterSamples)
    })
    toast.success(`已生成 ${samples.length} 条体重 + ${waterSamples.length} 条饮水示例`)
    onChanged()
  }

  const handleClear = async () => {
    await db.transaction('rw', db.records, db.waters, async () => {
      await db.records.clear()
      await db.waters.clear()
    })
    toast.success('已清空全部数据（体重 + 饮水）')
    setClearing(false)
    onChanged()
  }

  const handleFile = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const existing = await db.records.toArray()
      const { toAdd, skipped } = parseCSV(text, existing)
      if (!toAdd.length) {
        toast.info(skipped ? `没有新记录，跳过 ${skipped} 条重复` : '未能解析出有效记录')
        return
      }
      await db.records.bulkAdd(toAdd)
      toast.success(`导入 ${toAdd.length} 条${skipped ? `，跳过 ${skipped} 条重复` : ''}`)
      onChanged()
    } catch (e) {
      toast.error('导入失败：' + (e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      <div className="section-title">导出</div>
      <div className="card">
        <div className="stack">
          <Button variant="soft" block icon={<IconDownload />} onClick={handleExportCSV}>
            导出 CSV（Excel 兼容）
          </Button>
          <Button variant="default" block icon={<IconDownload />} onClick={handleExportJSON}>
            导出 JSON
          </Button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
          CSV 带 BOM 头，Excel 打开中文不乱码；JSON 便于跨设备迁移或程序处理。
        </p>
      </div>

      <div className="section-title">导入</div>
      <div className="card">
        <Button
          variant="default"
          block
          loading={importing}
          icon={<IconUpload />}
          onClick={() => fileRef.current?.click()}
        >
          导入 CSV
        </Button>
        <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
          仅支持本应用导出的 CSV 格式，相同「时间 + 体重」自动去重。
        </p>
      </div>

      <div className="section-title">示例与维护</div>
      <div className="card">
        <div className="stack">
          <Button variant="default" block onClick={handleSample}>
            生成 14 天示例数据
          </Button>
          <Button variant="danger-soft" block icon={<IconTrash />} onClick={() => setClearing(true)}>
            清空全部数据
          </Button>
        </div>
        <hr className="divider" />
        <div className="kv">
          <span className="k">体重记录</span>
          <span className="v tnum">{records.length} 条</span>
        </div>
        <div className="kv">
          <span className="k">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconDroplet style={{ width: 14, height: 14, color: 'var(--water)' }} />
              饮水记录
            </span>
          </span>
          <span className="v tnum">{waterCount} 条</span>
        </div>
      </div>

      <Modal
        open={clearing}
        onClose={() => setClearing(false)}
        title="清空全部数据"
        variant="center"
        grabber={false}
        footer={
          <>
            <Button variant="default" onClick={() => setClearing(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleClear}>
              确认清空
            </Button>
          </>
        }
      >
        <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
          此操作将删除全部 {records.length} 条体重记录与 {waterCount} 条饮水记录，且不可恢复。建议先导出备份。
        </p>
      </Modal>
    </div>
  )
}
