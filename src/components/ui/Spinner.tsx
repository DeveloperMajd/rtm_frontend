import type { CSSProperties } from 'react'

interface SpinnerProps {
  /** ring diameter in px */
  size?: number
  /** overrides the accent colour */
  color?: string
  position?: 'left' | 'center' | 'right'
  /** pad and center as a standalone loading block */
  block?: boolean
  label?: string
}

/** Lightweight CSS ring spinner — replaces react-spinners. */
const Spinner = ({ size = 36, color, position = 'center', block, label = 'Loading' }: SpinnerProps) => {
  const style = {
    '--sp-size': `${size}px`,
    ...(color ? { '--sp-color': color } : {}),
  } as CSSProperties

  return (
    <div
      className={`spinner spinner--${position}${block ? ' spinner--block' : ''}`}
      role='status'
      aria-live='polite'
    >
      <span className='spinner__ring' style={style} />
      <span className='sr-only'>{label}</span>
    </div>
  )
}

export default Spinner
