import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import SignalBars from './SignalBars'

describe('SignalBars', () => {
  it.each([
    ['connected', 3],
    ['reconnecting', 2],
    ['connecting', 1],
    ['offline', 0],
  ] as const)('lights %s bars for state=%s', (state, litCount) => {
    const { container } = render(<SignalBars state={state} />)
    expect(container.querySelectorAll('i')).toHaveLength(3)
    expect(container.querySelectorAll('i.is-lit')).toHaveLength(litCount)
  })

  it('is purely decorative', () => {
    const { container } = render(<SignalBars state='connected' />)
    expect(container.querySelector('.signal-bars')).toHaveAttribute('aria-hidden', 'true')
  })
})
