import { useState } from 'react'
import { getStoredTheme, setTheme, type ThemePref } from '../../utils/theme'

const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
]

/** Segmented light / dark / system control. Persists to localStorage. */
const ThemeToggle = () => {
  const [pref, setPref] = useState<ThemePref>(getStoredTheme)

  const choose = (value: ThemePref) => {
    setPref(value)
    setTheme(value)
  }

  return (
    <div
      className='tabs'
      role='group'
      aria-label='Colour theme'
      style={{ padding: 0, gap: '0.15rem' }}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type='button'
          className='tabs__tab'
          aria-pressed={pref === o.value}
          aria-selected={pref === o.value}
          onClick={() => choose(o.value)}
        >
          <span aria-hidden='true'>{o.icon}</span> {o.label}
        </button>
      ))}
    </div>
  )
}

export default ThemeToggle
