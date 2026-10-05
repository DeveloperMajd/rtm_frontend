import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BottomSheet, { SheetAction } from './BottomSheet'

const Harness = ({ onSelect = vi.fn() }: { onSelect?: () => void }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title='New conversation' note='Two ways in'>
        <SheetAction icon='userPlus' label='Add contact' hint='Find someone by name or email' onSelect={onSelect} />
        <SheetAction icon='info' label='Message info' soon />
      </BottomSheet>
    </>
  )
}

describe('BottomSheet', () => {
  it('opens as a labelled dialog with focus inside, and gives focus back when Escape closes it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })

    await user.click(trigger)

    const sheet = screen.getByRole('dialog', { name: 'New conversation' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: /Add contact/ })).toHaveFocus()
    expect(sheet).toHaveTextContent('Two ways in')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on a tap on the dimmed page around it, not on the sheet itself', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const sheet = screen.getByRole('dialog')

    fireEvent.mouseDown(sheet)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.mouseDown(sheet.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps focus inside while open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // The Soon action is disabled, so the only stop is Add contact.
    await user.tab()
    expect(screen.getByRole('button', { name: /Add contact/ })).toHaveFocus()
  })

  it('shows a choice that isn’t available yet as disabled and tagged', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByRole('button', { name: 'Message info Soon' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Add contact/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
