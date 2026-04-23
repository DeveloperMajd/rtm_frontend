import { CircleLoader } from 'react-spinners'

interface SpinnerProps {
  size?: number
  color?: string
  position?: 'left' | 'center' | 'right'
}

const Spinner = ({ size, color, position }: SpinnerProps) => {
  const justifyContent =
    position === 'left'
      ? 'justify-start'
      : position === 'right'
        ? 'justify-end'
        : 'justify-center'

  return (
    <div className={`flex ${justifyContent} items-center`}>
      <CircleLoader
        size={size || 50}
        color={color || '#4A90E2'}
        loading={true}
      />
    </div>
  )
}

export default Spinner
