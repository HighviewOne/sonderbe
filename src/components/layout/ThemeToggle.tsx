import { useState } from 'react'

type Theme = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'sonderbe-theme'
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<Theme, string> = { system: 'Theme: device', light: 'Theme: light', dark: 'Theme: dark' }
const ICON: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' }

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

// Cycles device → light → dark. index.html applies the saved choice before first paint.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  const cycle = () => {
    const next = NEXT[theme]
    setTheme(next)
    if (next === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', next)
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // private mode / blocked storage: the choice just won't be remembered
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={cycle} aria-label={`${LABEL[theme]}. Click to change.`} title={LABEL[theme]}>
      <span aria-hidden="true">{ICON[theme]}</span>
    </button>
  )
}
