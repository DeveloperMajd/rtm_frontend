import { setTheme, THEME_LABELS, useThemePref, type ThemePref } from '../../utils/theme'
import Icon from './Icon'
import type { IconName } from './icons'

const ORDER: ThemePref[] = ['light', 'dark', 'system']
const META: Record<ThemePref, { icon: IconName; label: string }> = {
  light: { icon: 'sun', label: THEME_LABELS.light },
  dark: { icon: 'moon', label: THEME_LABELS.dark },
  system: { icon: 'monitor', label: THEME_LABELS.system },
}

/** The rail's one-button theme switch: cycles Light → Dark → System. The
 * full choice lives in Settings → Appearance. Persists to localStorage. */
const ThemeToggle = () => {
  const pref = useThemePref()
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]

  return (
    <button
      type='button'
      className='btn ghost icon'
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${META[pref].label}. Switch to ${META[next].label}`}
      title={`Theme: ${META[pref].label}`}
    >
      <Icon name={META[pref].icon} />
    </button>
  )
}

export default ThemeToggle
