import { ICONS, type IconName } from './icons'

type IconProps = {
  size?: number
  className?: string
} & (
  | { path: string; name?: undefined }
  | { name: IconName; path?: undefined }
)

/**
 * Renders one icon, either the legacy `@mdi/js` fill glyph (`path`, raw SVG
 * path data — kept only until every call site has moved to `name` below,
 * see the redesign's Stage 11) or the Signal design system's 24px stroke
 * set (`name` — DS-Icons-Avatars: 1.75px stroke, round caps/joins,
 * currentColor, 81 icons in `./icons`). Both follow the surrounding
 * text/icon color automatically, so they track theme tokens without any
 * color prop. Always decorative here: pair it with `aria-label` on the
 * containing button.
 */
const Icon = ({ size = 18, className, ...rest }: IconProps) => {
  if (rest.name) {
    return (
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
        {ICONS[rest.name]}
      </svg>
    )
  }

  return (
    <svg
      viewBox='0 0 24 24'
      width={size}
      height={size}
      className={className}
      aria-hidden='true'
      focusable='false'
    >
      <path fill='currentColor' d={rest.path} />
    </svg>
  )
}

export default Icon
