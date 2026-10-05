import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Icon from './Icon'

describe('Icon', () => {
  it('renders a Signal stroke icon by name', () => {
    const { container } = render(<Icon name='reply' />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('stroke-width', '1.75')
    // 'reply' is a two-path glyph in the extracted set.
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('is decorative and sized via width/height, never focusable', () => {
    const { container } = render(<Icon name='check' size={24} />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('height', '24')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  })
})
