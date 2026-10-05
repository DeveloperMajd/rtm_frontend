import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Input, { Textarea } from './Input'

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input label='Email' />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('wires aria-describedby to the hint when there is no error', () => {
    render(<Input label='Bio' hint='Up to 500 characters' />)
    const input = screen.getByLabelText('Bio')
    const hint = screen.getByText('Up to 500 characters')
    expect(input).toHaveAttribute('aria-describedby', hint.id)
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('marks the field invalid and describes it by the error, not the hint', () => {
    render(<Input label='Email' hint='We never share it' error='That email is already registered.' />)
    const input = screen.getByLabelText('Email')
    const error = screen.getByText('That email is already registered.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', error.id)
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument()
  })

  it('forwards a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input label='Name' ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})

describe('Textarea', () => {
  it('associates the label with the textarea', () => {
    render(<Textarea label='Bio' />)
    expect(screen.getByLabelText('Bio').tagName).toBe('TEXTAREA')
  })
})
