import { useId } from 'react'

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  /** Ids of the visible label (and description) — it always has one. */
  labelledBy: string
  describedBy?: string
}

/**
 * One of a few choices, side by side (DS-Controls "Segmented"). A radio
 * group underneath: Tab reaches the chosen one, the arrow keys move
 * between them, and each option is a real label for its radio.
 */
function Segmented<T extends string>({ value, options, onChange, labelledBy, describedBy }: SegmentedProps<T>) {
  const name = useId()

  return (
    <div className='segmented' role='radiogroup' aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {options.map((option) => (
        <label key={option.value} className={`segmented__option${option.value === value ? ' is-on' : ''}`}>
          <input
            type='radio'
            className='sr-only'
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export default Segmented
