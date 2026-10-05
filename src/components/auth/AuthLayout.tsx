import type { ReactNode } from 'react'
import Avatar from '../ui/Avatar'
import BrandMark from '../ui/BrandMark'
import Icon from '../ui/Icon'
import SignalBars from '../ui/SignalBars'
import type { IconName } from '../ui/icons'

// The brand panel's picture of the app: three list rows, drawn rather than
// real — it's hidden from assistive tech, and nothing in it can be used.
const PREVIEW: { name: string; kind?: 'group'; time: string; line: string; typing?: boolean }[] = [
  { name: 'Weekend hike', kind: 'group', time: '10:06', line: 'Lena is typing…', typing: true },
  { name: 'Sam Okafor', time: '09:41', line: 'Pushed the fix, can you take a look?' },
  { name: 'Maya Chen', time: '09:38', line: 'Sounds good — see you at six.' },
]

/**
 * Auth-Login-1440 / -768 / -Mobile: from 1024px, a brand panel on the left
 * and the form card on the right; below that, the brand above the card; on
 * a phone, the card's chrome falls away and the form fills the screen.
 */
const AuthLayout = ({ children }: { children: ReactNode }) => (
  <div className='auth'>
    <aside className='auth__brand' aria-label='About RTM'>
      <BrandMark size={34} className='auth__logo' />
      <div className='auth__pitch'>
        <ul className='auth__preview' aria-hidden='true'>
          {PREVIEW.map((row) => (
            <li key={row.name} className='auth__preview-row'>
              <Avatar name={row.name} kind={row.kind} online={row.kind ? undefined : true} size='md' />
              <span className='auth__preview-text'>
                <span className='auth__preview-top'>
                  <span className='auth__preview-name'>{row.name}</span>
                  <time>{row.time}</time>
                </span>
                <span className={`auth__preview-line${row.typing ? ' is-typing' : ''}`}>
                  {row.typing && (
                    <span className='typing-bars'>
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {row.line}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div>
          <p className='auth__headline'>Conversations, as they happen.</p>
          <p className='auth__tagline'>Live presence, typing and unread counts for every chat and group.</p>
        </div>
        <ul className='auth__features'>
          <li>
            <SignalBars state='connected' />
            Realtime
          </li>
          <li>Groups &amp; roles</li>
          <li>Files &amp; images</li>
        </ul>
      </div>
    </aside>

    <main id='main-content' className='auth__main'>
      <BrandMark size={30} className='auth__compact-logo' />
      <div className='auth__card'>{children}</div>
    </main>
  </div>
)

type AuthHeaderProps = {
  title: string
  subtitle?: ReactNode
  /** Auth-Recovery-Flow's tile above the title. */
  icon?: IconName
  tone?: 'accent' | 'warn' | 'success'
}

export const AuthHeader = ({ title, subtitle, icon, tone = 'accent' }: AuthHeaderProps) => (
  <header className='auth__header'>
    {icon && (
      <span className={`auth__icon is-${tone}`} aria-hidden='true'>
        <Icon name={icon} size={18} />
      </span>
    )}
    <h1 className='auth__title'>{title}</h1>
    {subtitle && <p className='auth__subtitle'>{subtitle}</p>}
  </header>
)

type AuthBannerProps = { tone?: 'danger' | 'warn'; title: string; children?: ReactNode }

/** A problem with the whole form, not one field (wrong credentials, too
 * many attempts), above the fields. */
export const AuthBanner = ({ tone = 'danger', title, children }: AuthBannerProps) => (
  <div className={`auth__banner is-${tone}`} role='alert'>
    <Icon name={tone === 'warn' ? 'clock' : 'alertCircle'} size={16} />
    <div>
      <p className='auth__banner-title'>{title}</p>
      {children && <p className='auth__banner-body'>{children}</p>}
    </div>
  </div>
)

export const AuthDivider = () => (
  <div className='auth__divider' role='separator'>
    <span>or</span>
  </div>
)

/** Google sign-in: a plain link to the backend's OAuth redirect. */
export const GoogleButton = ({ href }: { href: string }) => (
  <a href={href} className='btn secondary block auth__oauth'>
    <span className='auth__oauth-mark' aria-hidden='true'>
      G
    </span>
    Continue with Google
  </a>
)

export default AuthLayout
