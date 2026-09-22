import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

describe('Badge', () => {
  it('renders its label and defaults to the neutral tone', () => {
    render(<Badge>Left</Badge>)
    const badge = screen.getByText('Left')
    expect(badge).toHaveClass('badge', 'badge--neutral')
  })

  it.each([
    ['admin', 'badge--admin'],
    ['left', 'badge--left'],
    ['soon', 'badge--soon'],
    ['needs-api', 'badge--needs-api'],
  ] as const)('applies the %s tone class', (tone, expectedClass) => {
    render(<Badge tone={tone}>label</Badge>)
    expect(screen.getByText('label')).toHaveClass(expectedClass)
  })
})
