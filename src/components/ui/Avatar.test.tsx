import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar', () => {
  it('renders no presence dot when neither online nor status is given', () => {
    const { container } = render(<Avatar name='Jordan' />)
    expect(container.querySelector('.avatar__status')).not.toBeInTheDocument()
  })

  it.each([
    [true, 'is-online'],
    [false, 'is-offline'],
  ] as const)('maps the legacy online=%s prop to %s', (online, expectedClass) => {
    const { container } = render(<Avatar name='Jordan' online={online} />)
    expect(container.querySelector('.avatar__status')).toHaveClass(expectedClass)
  })

  it.each(['online', 'offline', 'away', 'connecting'] as const)(
    'renders the %s presence shape from the status prop',
    (status) => {
      const { container } = render(<Avatar name='Jordan' status={status} />)
      expect(container.querySelector('.avatar__status')).toHaveClass(`is-${status}`)
    },
  )

  it('prefers status over the legacy online prop when both are given', () => {
    const { container } = render(<Avatar name='Jordan' online={true} status='away' />)
    expect(container.querySelector('.avatar__status')).toHaveClass('is-away')
  })

  it('falls back to initials when there is no image', () => {
    const { getByText } = render(<Avatar name='Jordan Lee' />)
    expect(getByText('JL')).toBeInTheDocument()
  })
})
