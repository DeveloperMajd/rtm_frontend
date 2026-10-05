import { ICONS, type IconName } from './icons'

type IconProps = {
  name: IconName
  size?: number
  className?: string
}

/**
 * One icon from the Signal design system's 24px stroke set
 * (DS-Icons-Avatars: 1.75px stroke, round caps/joins, `./icons`). It takes
 * the surrounding text colour, so it follows the theme without a colour
 * prop. Always decorative: pair it with `aria-label` on the containing
 * button.
 */
const Icon = ({ name, size = 18, className }: IconProps) => (
  <svg
    viewBox='0 0 24 24'
    width={size}
    height={size}
    fill='none'
    stroke='currentColor'
    strokeWidth={1.75}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    aria-hidden='true'
    focusable='false'
  >
    {ICONS[name]}
  </svg>
)

export default Icon
