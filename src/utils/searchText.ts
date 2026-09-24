import { format, isThisYear, isToday, isYesterday } from 'date-fns'

export type TextSegment = { text: string; match: boolean }

/** The words worth highlighting: 2+ characters, as the search itself needs. */
export function queryTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((term) => term.length >= 2)
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits `text` into plain and matching runs, for highlighting.
 *
 * Marks where a query word starts a word in the text, case-insensitively.
 * The server matches on stems ("run" also finds "running"), so this is a
 * visual approximation: it marks the literal occurrences it can see and
 * never claims a match that isn't there.
 */
export function highlightSegments(text: string, terms: string[]): TextSegment[] {
  if (terms.length === 0 || !text) return [{ text, match: false }]

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${terms.map(escapeRegExp).join('|')})`,
    'giu',
  )
  const segments: TextSegment[] = []
  let last = 0
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0
    if (start > last) segments.push({ text: text.slice(last, start), match: false })
    segments.push({ text: m[0], match: true })
    last = start + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false })
  return segments.length > 0 ? segments : [{ text, match: false }]
}

const SNIPPET_LEAD = 40
const SNIPPET_THRESHOLD = 90

/**
 * The part of a long message worth showing in a one-line result. The API
 * returns the whole body, not a snippet; when the first match sits well into
 * the text, start a little before it (with an ellipsis) so the match is on
 * screen rather than truncated away.
 */
export function snippetAround(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (terms.length === 0) return flat

  const lower = flat.toLowerCase()
  const first = Math.min(
    ...terms.map((t) => {
      const i = lower.indexOf(t.toLowerCase())
      return i === -1 ? Infinity : i
    }),
  )
  if (!Number.isFinite(first) || first < SNIPPET_THRESHOLD) return flat

  const from = flat.lastIndexOf(' ', first - SNIPPET_LEAD)
  return `…${flat.slice(from === -1 ? first - SNIPPET_LEAD : from + 1)}`
}

/** "Today 10:02", "Yesterday 18:40", "Fri 18 Sep", "3 Mar 2025". */
export function resultTime(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return `Today ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`
  if (isThisYear(d)) return format(d, 'EEE d MMM')
  return format(d, 'd MMM yyyy')
}
