import { useId, useState, type ReactNode } from 'react'
import { PASSWORD_RULES } from '../../utils/passwordRules'
import Icon from './Icon'
import { FieldError, FieldLabel } from './Input'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  /** Show the live rules checklist + strength (register/reset/change; off
   * for a sign-in, current-password or confirm field). */
  showRules?: boolean
  required?: boolean
  error?: string
  /** Opposite the label, e.g. "Forgot password?". */
  labelAside?: ReactNode
  disabled?: boolean
}

type Strength = { label: string; bars: number; tone: 'none' | 'weak' | 'good' | 'strong' }

// Auth-Register-States: the three signal bars fill as more of the real
// rules are met — Weak, Good, then Strong only when every rule is.
function strengthOf(value: string, met: number): Strength {
  if (!value) return { label: 'Enter a password', bars: 0, tone: 'none' }
  if (met === PASSWORD_RULES.length) return { label: 'Strong', bars: 3, tone: 'strong' }
  if (met >= 3) return { label: 'Good', bars: 2, tone: 'good' }
  return { label: 'Weak', bars: 1, tone: 'weak' }
}

/**
 * A password input with a show/hide toggle and, for a new password, the
 * app's own five rules (utils/passwordRules — the backend's) ticking off as
 * they're met, which the input is described by.
 */
const PasswordField = ({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  showRules = true,
  required = true,
  error,
  labelAside,
  disabled,
}: PasswordFieldProps) => {
  const [revealed, setRevealed] = useState(false)
  const rulesId = useId()
  const errorId = useId()
  const met = PASSWORD_RULES.filter((r) => r.test(value)).length
  const strength = strengthOf(value, met)

  return (
    <div className='field'>
      <FieldLabel htmlFor={id} label={label} aside={labelAside} />
      <div className={`input-shell${disabled ? ' is-disabled' : ''}`}>
        <input
          id={id}
          className='input-shell__input'
          type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, showRules ? rulesId : null].filter(Boolean).join(' ') || undefined}
        />
        <button
          type='button'
          className='input-shell__action'
          aria-label='Show password'
          aria-pressed={revealed}
          aria-controls={id}
          disabled={disabled}
          onClick={() => setRevealed((r) => !r)}
        >
          <Icon name={revealed ? 'eyeOff' : 'eye'} size={16} />
        </button>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {showRules && (
        <div className='pw-meter' id={rulesId}>
          <p className={`pw-meter__strength is-${strength.tone}`}>
            <span className='pw-meter__bars' aria-hidden='true'>
              {[1, 2, 3].map((bar) => (
                <i key={bar} className={bar <= strength.bars ? 'is-lit' : undefined} />
              ))}
            </span>
            {strength.label}
          </p>
          <ul className='pw-meter__rules'>
            {PASSWORD_RULES.map((rule) => {
              const isMet = rule.test(value)
              return (
                <li key={rule.key} className={`pw-meter__rule${isMet ? ' is-met' : ''}`}>
                  <span className='pw-meter__mark' aria-hidden='true'>
                    {isMet && <Icon name='check' size={11} />}
                  </span>
                  <span>
                    {rule.label}
                    <span className='sr-only'>{isMet ? ' — met' : ' — not met yet'}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default PasswordField
