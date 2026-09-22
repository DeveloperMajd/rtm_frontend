import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Icon from './Icon'

describe('Icon', () => {
  it('renders a legacy MDI path icon as a filled glyph', () => {
    const { container } = render(<Icon path='M4 4h16v16H4z' />)
    const svg = container.querySelector('svg')
    const path = container.querySelector('path')

    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).not.toHaveAttribute('stroke')
    expect(path).toHaveAttribute('fill', 'currentColor')
    expect(path).toHaveAttribute('d', 'M4 4h16v16H4z')
  })

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
