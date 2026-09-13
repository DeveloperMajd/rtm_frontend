type IconProps = {
  /** Raw SVG path data from `@mdi/js`, e.g. `mdiArrowLeft`. */
  path: string
  size?: number
  className?: string
}

/**
 * Renders one Material Design Icon. `@mdi/js` ships path data only (plain
 * strings, bundled at build time — nothing is fetched at runtime), so this
 * is the thin wrapper every icon goes through. `fill="currentColor"` means
 * it follows the surrounding text/icon color — and therefore the theme
 * tokens — automatically, unlike the emoji glyphs it replaces. Always
 * decorative here: pair it with `aria-label` on the containing button.
 */
const Icon = ({ path, size = 18, className }: IconProps) => (
  <svg
    viewBox='0 0 24 24'
    width={size}
    height={size}
    className={className}
    aria-hidden='true'
    focusable='false'
  >
    <path fill='currentColor' d={path} />
  </svg>
)

export default Icon
