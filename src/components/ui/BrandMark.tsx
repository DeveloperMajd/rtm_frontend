interface BrandMarkProps {
  /** icon size in px */
  size?: number
  /** show the "RTM" wordmark next to the glyph */
  withWordmark?: boolean
  className?: string
}

/** RTM logo: a rounded speech-bubble glyph, optionally with the wordmark. */
const BrandMark = ({ size = 40, withWordmark = true, className = '' }: BrandMarkProps) => (
  <span
    className={`brand ${className}`.trim()}
    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}
  >
    <svg
      width={size}
      height={size}
      viewBox='0 0 40 40'
      role='img'
      aria-label='RTM'
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      <rect width='40' height='40' rx='11' fill='var(--c-primary)' />
      <path
        d='M11 14.5A3.5 3.5 0 0 1 14.5 11h11a3.5 3.5 0 0 1 3.5 3.5v7a3.5 3.5 0 0 1-3.5 3.5H18l-5 4.2V25h-1.5A.5.5 0 0 1 11 24.5v-10Z'
        fill='var(--c-on-primary)'
      />
      <circle cx='16.5' cy='18' r='1.6' fill='var(--c-primary)' />
      <circle cx='20' cy='18' r='1.6' fill='var(--c-primary)' />
      <circle cx='23.5' cy='18' r='1.6' fill='var(--c-primary)' />
    </svg>
    {withWordmark && (
      <span
        style={{
          fontWeight: 750,
          fontSize: size * 0.5,
          letterSpacing: '0.02em',
          color: 'var(--c-fg)',
        }}
      >
        RTM
      </span>
    )}
  </span>
)

export default BrandMark
