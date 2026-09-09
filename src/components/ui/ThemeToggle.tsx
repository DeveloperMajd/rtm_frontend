import { useState } from 'react'
import { getStoredTheme, setTheme, type ThemePref } from '../../utils/theme'

const ORDER: ThemePref[] = ['light', 'dark', 'system']
const META: Record<ThemePref, { icon: string; label: string }> = {
  light: { icon: '☀', label: 'Light' },
  dark: { icon: '☾', label: 'Dark' },
  system: { icon: '⌗', label: 'System' },
}

interface ThemeToggleProps {
  /** single cycling icon button instead of the segmented control */
  compact?: boolean
}

/** Light / dark / system theme control. Persists to localStorage. */
const ThemeToggle = ({ compact = false }: ThemeToggleProps) => {
  const [pref, setPref] = useState<ThemePref>(getStoredTheme)

  const choose = (value: ThemePref) => {
    setPref(value)
    setTheme(value)
  }

  if (compact) {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]
    return (
      <button
        type='button'
        className='btn ghost icon'
        onClick={() => choose(next)}
        aria-label={`Theme: ${META[pref].label}. Switch to ${META[next].label}`}
        title={`Theme: ${META[pref].label}`}
      >
        <span aria-hidden='true'>{META[pref].icon}</span>
      </button>
    )
  }

  return (
    <div className='theme-toggle' role='group' aria-label='Colour theme'>
      {ORDER.map((value) => (
        <button
          key={value}
          type='button'
          className='theme-toggle__opt'
          aria-pressed={pref === value}
          onClick={() => choose(value)}
        >
          <span aria-hidden='true'>{META[value].icon}</span>
          {META[value].label}
        </button>
      ))}
    </div>
  )
}

export default ThemeToggle
