// use Button.scss for styling
import './Button.scss'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'tertiary'
  label: string
  onClick: () => void
  disabled?: boolean
}

const Button = ({
  variant = 'primary',
  label,
  onClick,
  disabled,
}: ButtonProps) => {
  return (
    <button
      className={`btn ${variant} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export default Button
