import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReadReceipt from './ReadReceipt'

const reader = (id: string, name: string) => ({ user_id: id, name })

describe('ReadReceipt', () => {
  it('says Sent, or Seen', () => {
    const { rerender } = render(<ReadReceipt receipt={{ kind: 'sent' }} />)
    expect(screen.getByText('Sent')).toBeInTheDocument()

    rerender(<ReadReceipt receipt={{ kind: 'seen' }} />)
    expect(screen.getByText('Seen')).toBeInTheDocument()
  })

  it('in a group, lists who has read it and who hasn’t yet — with no invented times', async () => {
    const user = userEvent.setup()
    render(
      <ReadReceipt
        receipt={{
          kind: 'seen-by',
          seen: [reader('a', 'nitsuj1001'), reader('b', 'test account')],
          notYet: [reader('c', 'Redis Outage Test')],
        }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Seen by 2 of 3 — show who' })
    expect(button).toHaveTextContent('Seen by 2')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)

    const list = screen.getByRole('dialog', { name: 'Seen by' })
    expect(list).toHaveFocus()
    expect(within(list).getByText('Seen by · 2 of 3')).toBeInTheDocument()
    expect(within(list).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      expect.stringMatching(/nitsuj1001\s*Seen$/),
      expect.stringMatching(/test account\s*Seen$/),
      expect.stringMatching(/Redis Outage Test\s*Not yet$/),
    ])
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes with Escape and gives focus back to the button', async () => {
    const user = userEvent.setup()
    render(<ReadReceipt receipt={{ kind: 'seen-by', seen: [reader('a', 'Kal')], notYet: [] }} />)

    await user.click(screen.getByRole('button', { name: 'Seen by 1 of 1 — show who' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Seen by' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seen by 1 of 1 — show who' })).toHaveFocus()
  })

  it('closes on a click anywhere else', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ReadReceipt receipt={{ kind: 'seen-by', seen: [reader('a', 'Kal')], notYet: [] }} />
        <p>Elsewhere</p>
      </>,
    )

    await user.click(screen.getByRole('button', { name: /Seen by 1/ }))
    await user.click(screen.getByText('Elsewhere'))

    expect(screen.queryByRole('dialog', { name: 'Seen by' })).not.toBeInTheDocument()
  })
})
