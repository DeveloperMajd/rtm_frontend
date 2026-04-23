import { format, parseISO } from 'date-fns'

export function formatDate(dateString: string, desiredFormat: string): string {
  const date = parseISO(dateString)
  return format(date, desiredFormat)
}

//Notes for self:
//TODO: 1. Handle edge cases like invalid date strings or unsupported formats.
//TODO: 2. Consider cases where not to show the date, e.g., if the date is very recent (like "just now" or "5 minutes ago").
