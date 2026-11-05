import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'auto' | 'light' | 'dark'

const THEME_KEY = 'cochef.theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const saved = (): ThemePreference => {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
}

interface ThemeContextValue {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(saved)
  const [systemDark, setSystemDark] = useState<boolean>(() => media().matches)

  useEffect(() => {
    const mq = media()
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved = preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [resolved])

  const setPreference = useCallback((p: ThemePreference) => {
    localStorage.setItem(THEME_KEY, p)
    setPreferenceState(p)
  }, [])

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export interface Settings {
  defaultBuffer: number
  defaultTax: number
  vatReportCycle: 'monthly' | 'bimonthly'
  annualReviewMonth: number
  chefName: string
  businessName: string
}
const SETTINGS_KEY = 'cochef.settings'

export function loadSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return { defaultBuffer: v.defaultBuffer ?? 0, defaultTax: v.defaultTax ?? 18, vatReportCycle: v.vatReportCycle === 'monthly' ? 'monthly' : 'bimonthly', annualReviewMonth: Number(v.annualReviewMonth) || 12, chefName: v.chefName ?? '', businessName: v.businessName ?? '' }
  } catch {
    return { defaultBuffer: 0, defaultTax: 18, vatReportCycle: 'bimonthly', annualReviewMonth: 12, chefName: '', businessName: '' }
  }
}

export function saveSettings(s: Partial<Settings>) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...s }))
}
