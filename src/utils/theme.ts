import { useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'

export const THEME_LABELS: Record<ThemePref, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const KEY = 'rtm.theme'

// The rail's quick toggle and the Settings page's picker can both be on
// screen at once, so a change made in one has to reach the other.
const listeners = new Set<() => void>()

export function getStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* private mode / disabled storage */
  }
  return 'system'
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  if (pref === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', pref)
  }
}

export function setTheme(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* ignore */
  }
  applyTheme(pref)
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The stored theme preference, kept current across every control that
 * changes it. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getStoredTheme)
}
