import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Menu, { type MenuEntry } from './Menu'

const anchor = () => ({ top: 0, bottom: 20, left: 0, right: 100 })

/** A menu button wired the way callers use Menu: the trigger toggles it,
 * and Menu reports every close through onClose. */
const Harness = ({ entries }: { entries: MenuEntry[] }) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={triggerRef} type='button' onClick={() => setOpen((o) => !o)}>
        More
      </button>
      <button type='button'>Elsewhere</button>
      <Menu
        open={open}
        label='Message actions'
        entries={entries}
        triggerRef={triggerRef}
        getAnchorRect={anchor}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const makeEntries = (handlers: { reply?: () => void; info?: () => void; remove?: () => void } = {}) =>
  [
    {
      kind: 'item',
      id: 'reply',
      label: 'Reply',
      shortcut: 'R',
      matchesKey: (e) => e.key === 'r',
      onSelect: handlers.reply,
    },
    { kind: 'item', id: 'copy', label: 'Copy text' },
    { kind: 'separator', id: 'sep' },
    { kind: 'item', id: 'info', label: 'Message info', tag: 'Soon', onSelect: handlers.info },
    { kind: 'item', id: 'delete', label: 'Delete', tone: 'danger', onSelect: handlers.remove },
  ] satisfies MenuEntry[]

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'More' }))
  return screen.getByRole('menu', { name: 'Message actions' })
}

describe('Menu', () => {
  it('moves focus onto the first item when it opens', async () => {
    const user = userEvent.setup()
    render(<Harness entries={makeEntries()} />)

    await openMenu(user)

    expect(screen.getByRole('menuitem', { name: /Reply/ })).toHaveFocus()
  })

  it('moves between items with the arrow keys, wrapping at both ends, and jumps with Home/End', async () => {
    const user = userEvent.setup()
    render(<Harness entries={makeEntries()} />)
    await openMenu(user)

    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: /Reply/ })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Copy text' })).toHaveFocus()

    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: /Reply/ })).toHaveFocus()
  })

  it('closes on Escape and gives focus back to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness entries={makeEntries()} />)
    await openMenu(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()
  })

  it('closes on Tab and gives focus back to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness entries={makeEntries()} />)
    await openMenu(user)

    await user.keyboard('{Tab}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()
  })

  it('runs the chosen item after closing, so the action can move focus itself', async () => {
    const user = userEvent.setup()
    const remove = vi.fn(() => {
      // e.g. opening a dialog, or focusing the composer
      screen.getByRole('button', { name: 'Elsewhere' }).focus()
    })
    render(<Harness entries={makeEntries({ remove })} />)
    await openMenu(user)

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(remove).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus()
  })

  it('keeps a tagged item visible and focusable, but never runs it', async () => {
    const user = userEvent.setup()
    const info = vi.fn()
    render(<Harness entries={makeEntries({ info })} />)
    await openMenu(user)

    const item = screen.getByRole('menuitem', { name: /Message info/ })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveTextContent('Soon')

    await user.click(item)
    item.focus()
    await user.keyboard('{Enter}')

    expect(info).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('activates an item from its advertised shortcut', async () => {
    const user = userEvent.setup()
    const reply = vi.fn()
    render(<Harness entries={makeEntries({ reply })} />)
    await openMenu(user)

    await user.keyboard('r')

    expect(reply).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes when the pointer goes down outside it, but not on its own trigger', async () => {
    const user = userEvent.setup()
    render(<Harness entries={makeEntries()} />)
    await openMenu(user)

    // The trigger toggles the menu itself; treating it as "outside" too
    // would close and immediately reopen it.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
