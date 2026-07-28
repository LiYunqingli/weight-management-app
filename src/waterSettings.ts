import { useCallback, useState } from 'react'

export interface WaterSettings {
  /** 水杯容量（毫升） */
  cupMl: number
  /** 每日饮水目标（毫升），null 表示未设置 */
  goalMl: number | null
}

const KEY = 'wm_water_v1'

const DEFAULT: WaterSettings = {
  cupMl: 250,
  goalMl: 2000,
}

function sanitize(raw: Partial<WaterSettings> | null): WaterSettings {
  const cup =
    typeof raw?.cupMl === 'number' && isFinite(raw.cupMl)
      ? Math.max(50, Math.min(1000, Math.round(raw.cupMl)))
      : DEFAULT.cupMl
  const goal =
    raw?.goalMl != null && isFinite(raw.goalMl)
      ? Math.max(500, Math.min(6000, Math.round(raw.goalMl)))
      : null
  return { cupMl: cup, goalMl: goal }
}

export function loadWaterSettings(): WaterSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    return sanitize(JSON.parse(raw) as Partial<WaterSettings>)
  } catch {
    return { ...DEFAULT }
  }
}

export function saveWaterSettings(s: WaterSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function useWaterSettings(): [WaterSettings, (patch: Partial<WaterSettings>) => void] {
  const [settings, setSettings] = useState<WaterSettings>(loadWaterSettings)

  const patch = useCallback((p: Partial<WaterSettings>) => {
    setSettings((prev) => {
      const next = sanitize({ ...prev, ...p })
      saveWaterSettings(next)
      return next
    })
  }, [])

  return [settings, patch]
}
