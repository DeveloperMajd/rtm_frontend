const STORAGE_KEY = 'rtm.recentSearches'
const MAX_RECENT = 5

/**
 * The last few searches that led somewhere (a result was opened), newest
 * first, for the palette's "Recent searches". Kept in this browser only — a
 * convenience, so every read and write tolerates storage being unavailable
 * (private windows, blocked site data) and simply comes back empty.
 */
export function loadRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((q): q is string => typeof q === 'string').slice(0, MAX_RECENT)
      : []
  } catch {
    return []
  }
}

/** Moves `query` to the front (case-insensitively de-duplicated) and
 * returns the updated list. */
export function rememberSearch(query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return loadRecentSearches()

  const next = [
    trimmed,
    ...loadRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_RECENT)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: still correct for this session's palette.
  }
  return next
}
