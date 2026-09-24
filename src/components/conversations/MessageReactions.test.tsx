import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessageReactions from './MessageReactions'
import type { ReactionType } from '../../utils/baseTypes'

const reaction = (emoji: string, userId: string, name: string): ReactionType => ({
  id: `${emoji}-${userId}`,
  reaction: emoji,
  user: { id: userId, name },
})

const groups = (reactions: ReactionType[]) => {
  const grouped: Record<string, ReactionType[]> = {}
  for (const r of reactions) (grouped[r.reaction] ??= []).push(r)
  return grouped
}

const renderReactions = (
  reactions: ReactionType[],
  { readOnly = false, onToggle = vi.fn() }: { readOnly?: boolean; onToggle?: (r: string, reacted: boolean) => void } = {},
) =>
  render(
    <MessageReactions
      grouped={groups(reactions)}
      viewerId='me'
      readOnly={readOnly}
      onToggle={onToggle}
      onAdd={vi.fn()}
      addButtonRef={createRef()}
      isAdding={false}
    />,
  )

describe('MessageReactions', () => {
  it('renders nothing when there are no reactions', () => {
    const { container } = renderReactions([])
    expect(container).toBeEmptyDOMElement()
  })

  it('marks your own reaction as pressed, and toggles it off when tapped again', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderReactions([reaction('👍', 'me', 'Me'), reaction('👍', 'x', 'Sam'), reaction('🙏', 'x', 'Sam')], {
      onToggle,
    })

    const thumbs = screen.getByRole('button', { name: 'Thumbs up, 2' })
    expect(thumbs).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Thanks, 1' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(thumbs)
    expect(onToggle).toHaveBeenCalledWith('👍', true)
  })

  it('lists who reacted, with you as "You"', () => {
    renderReactions([reaction('👍', 'x', 'Sam'), reaction('👍', 'me', 'Me')])

    expect(screen.getByRole('button', { name: 'Thumbs up, 2' })).toHaveAccessibleDescription('Sam, You')
  })

  it('shows reactions in a read-only group without letting them be changed', () => {
    renderReactions([reaction('👍', 'x', 'Sam')], { readOnly: true })

    expect(screen.getByRole('img', { name: 'Thumbs up, 1: Sam' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pops in only reactions added after the message first rendered', () => {
    const { rerender } = renderReactions([reaction('👍', 'x', 'Sam')])

    rerender(
      <MessageReactions
        grouped={groups([reaction('👍', 'x', 'Sam'), reaction('❤️', 'y', 'Ana')])}
        viewerId='me'
        readOnly={false}
        onToggle={vi.fn()}
        onAdd={vi.fn()}
        addButtonRef={createRef()}
        isAdding={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'Thumbs up, 1' })).not.toHaveClass('is-new')
    expect(screen.getByRole('button', { name: 'Heart, 1' })).toHaveClass('is-new')
  })
})
