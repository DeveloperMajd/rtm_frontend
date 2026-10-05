import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tooltip from './Tooltip'

describe('Tooltip', () => {
  it('wires aria-describedby on the trigger to the tooltip bubble', () => {
    render(
      <Tooltip label='Reply'>
        <button type='button'>Reply</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Reply' })
    const bubble = screen.getByRole('tooltip')

    expect(bubble).toHaveTextContent('Reply')
    expect(trigger).toHaveAttribute('aria-describedby', bubble.id)
  })

  it('preserves the trigger element and its own props', () => {
    render(
      <Tooltip label='Delete'>
        <button type='button' disabled>
          Delete
        </button>
      </Tooltip>,
    )

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })
})
