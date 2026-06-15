import './Button.scss'

interface ButtonProps {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'tertiary'
  label: string
  onClick?: () => void
  disabled?: boolean
}

const Button = ({
  type = 'button',
  variant = 'primary',
  label,
  onClick,
  disabled,
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={`btn ${variant} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export default Button
