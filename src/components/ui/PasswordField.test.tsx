import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PasswordField from './PasswordField'

const Controlled = (props: { showRules?: boolean; error?: string }) => {
  const [value, setValue] = useState('')
  return <PasswordField id='pw' label='Password' value={value} onChange={setValue} {...props} />
}

const rules = () => within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent)

describe('PasswordField', () => {
  it('lists the app’s five real rules up front, none met yet', () => {
    render(<Controlled />)

    expect(screen.getByText('Enter a password')).toBeInTheDocument()
    expect(rules()).toEqual([
      'At least 8 characters — not met yet',
      'An uppercase letter — not met yet',
      'A lowercase letter — not met yet',
      'A number — not met yet',
      'A symbol (!@#$…) — not met yet',
    ])
  })

  it('ticks rules off as they’re met, from Weak to Good to Strong', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const input = screen.getByLabelText('Password')

    await user.type(input, 'ab')
    expect(screen.getByText('Weak')).toBeInTheDocument()
    expect(rules()).toContain('A lowercase letter — met')

    await user.type(input, 'CD12')
    expect(screen.getByText('Good')).toBeInTheDocument()

    await user.type(input, '!x')
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(rules().every((rule) => rule?.endsWith('— met'))).toBe(true)
  })

  it('is described by the rules, so they’re read out with the field', () => {
    render(<Controlled />)
    const input = screen.getByLabelText('Password')
    const describedBy = input.getAttribute('aria-describedby')!

    expect(document.getElementById(describedBy)).toContainElement(screen.getByRole('list'))
  })

  it('shows and hides what’s typed', async () => {
    const user = userEvent.setup()
    render(<Controlled showRules={false} />)
    const input = screen.getByLabelText('Password')
    const toggle = screen.getByRole('button', { name: 'Show password' })

    expect(input).toHaveAttribute('type', 'password')
    await user.click(toggle)
    expect(input).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(input).toHaveAttribute('type', 'password')
  })

  it('leaves the rules out where they don’t apply, and shows an error on the field', () => {
    render(<Controlled showRules={false} error='Passwords don’t match.' />)

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Passwords don’t match.')
  })
})
