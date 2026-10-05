// Mirrors the case values of App\Enums\MessageReactionType on the backend.
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

// The emoji alone is a poor accessible name (screen readers vary in how they
// announce it), so every reaction control is labelled with one of these —
// the same names the design uses (Study-Reactions).
const REACTION_LABELS: Record<string, string> = {
  '👍': 'Thumbs up',
  '❤️': 'Heart',
  '😂': 'Laugh',
  '😮': 'Surprised',
  '😢': 'Sad',
  '🙏': 'Thanks',
}

export function reactionLabel(reaction: string): string {
  return REACTION_LABELS[reaction] ?? reaction
}
