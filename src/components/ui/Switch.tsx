interface SwitchProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  /** Ids of the visible label (and description) — a switch always has one. */
  labelledBy: string
  describedBy?: string
}

/**
 * An on/off setting (DS-Controls "Switch"): a button with role="switch", so
 * it's reached by Tab and toggled with Space or Enter. A disabled switch
 * still shows the true current state — Settings uses that for rows whose
 * control isn't live yet.
 */
const Switch = ({ checked, onChange, disabled, labelledBy, describedBy }: SwitchProps) => (
  <button
    type='button'
    role='switch'
    className='switch'
    aria-checked={checked}
    aria-labelledby={labelledBy}
    aria-describedby={describedBy}
    disabled={disabled}
    onClick={() => onChange?.(!checked)}
  >
    <span className='switch__thumb' aria-hidden='true' />
  </button>
)

export default Switch
