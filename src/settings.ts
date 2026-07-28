import { useCallback, useState } from 'react'

export type Gender = 'male' | 'female' | ''

export interface Profile {
  height: number | null // cm
  gender: Gender
  age: number | null
  target: number | null // kg
}

const KEY = 'wm_profile_v1'
const LEGACY_TARGET = 'wm_target'

const DEFAULT: Profile = {
  height: null,
  gender: '',
  age: null,
  target: null,
}

function readLegacyTarget(): number | null {
  const v = localStorage.getItem(LEGACY_TARGET)
  return v ? parseFloat(v) : null
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      // migrate legacy target
      const t = readLegacyTarget()
      return t != null ? { ...DEFAULT, target: t } : { ...DEFAULT }
    }
    const parsed = JSON.parse(raw) as Partial<Profile>
    return { ...DEFAULT, ...parsed }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveProfile(p: Profile) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function useProfile(): [Profile, (next: Profile) => void, (patch: Partial<Profile>) => void] {
  const [profile, setProfile] = useState<Profile>(loadProfile)

  const replace = useCallback((next: Profile) => {
    setProfile(next)
    saveProfile(next)
  }, [])

  const patch = useCallback((p: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...p }
      saveProfile(next)
      return next
    })
  }, [])

  return [profile, replace, patch]
}
