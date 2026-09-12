import { useId } from 'react'
import { PASSWORD_RULES } from '../../utils/passwordRules'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  /** Show the live rules checklist + strength bar (register/reset; off for a plain login/current-password field). */
  showRules?: boolean
  required?: boolean
  invalid?: boolean
}

const PasswordField = ({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  showRules = true,
  required = true,
  invalid = false,
}: PasswordFieldProps) => {
  const rulesId = useId()
  const metCount = PASSWORD_RULES.filter((r) => r.test(value)).length
  const level = metCount <= 2 ? 1 : metCount === 3 ? 2 : metCount === 4 ? 3 : 4
  const showMeter = showRules && value.length > 0

  return (
    <div className='field'>
      <label className='field__label' htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className='input'
        type='password'
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={showMeter ? rulesId : undefined}
      />
      {showMeter && (
        <div className='pw-meter' id={rulesId}>
          <div className='pw-meter__bar'>
            <div className={`pw-meter__fill is-${level}`} />
          </div>
          <ul className='pw-meter__rules'>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(value)
              return (
                <li key={rule.key} className={`pw-meter__rule${met ? ' is-met' : ''}`}>
                  <span aria-hidden='true'>{met ? '✓' : '○'}</span> {rule.label}
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
