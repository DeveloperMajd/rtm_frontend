import { Link, Outlet, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuth from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Icon from '../components/ui/Icon'
import type { IconName } from '../components/ui/icons'
import { THEME_LABELS, useThemePref } from '../utils/theme'

type Section = {
  to: string
  label: string
  icon: IconName
  /** Its controls are shown but not live yet. */
  soon?: boolean
  isCurrent: (pathname: string, hash: string) => boolean
}

// Appearance, Notifications and Privacy are one page (/settings) with a
// section each, as the design lays them out — the last two link to their
// section on it.
const SECTIONS: Section[] = [
  { to: '/profile', label: 'Profile', icon: 'user', isCurrent: (p) => p === '/profile' },
  {
    to: '/settings',
    label: 'Appearance',
    icon: 'sun',
    isCurrent: (p, h) => p === '/settings' && h !== '#notifications' && h !== '#privacy',
  },
  {
    to: '/settings#notifications',
    label: 'Notifications',
    icon: 'bell',
    soon: true,
    isCurrent: (p, h) => p === '/settings' && h === '#notifications',
  },
  {
    to: '/settings#privacy',
    label: 'Privacy',
    icon: 'lock',
    soon: true,
    isCurrent: (p, h) => p === '/settings' && h === '#privacy',
  },
]

/**
 * Profile-1440 / Settings-1440: the settings list in the list pane's place,
 * with Sign out at its foot, beside whichever page is open.
 *
 * On a phone the list is a screen of its own (Profile-Mobile's Profile tab,
 * at /me): who you are at the top, then the sections, each opening its page
 * full-screen.
 */
function SettingsLayout() {
  const { user, logout } = useAuth()
  const { pathname, hash } = useLocation()
  const theme = useThemePref()

  // Signed out, RequireAuth takes the viewer to sign in.
  const signOut = async () => {
    try {
      await logout()
    } catch {
      toast.error('Couldn’t sign you out. Check your connection and try again.')
    }
  }

  return (
    <>
      <section id='settings-list' tabIndex={-1} className='settings-nav' aria-labelledby='settings-nav-title'>
        <header className='settings-nav__header'>
          <h2 id='settings-nav-title' className='settings-nav__title'>
            Settings
          </h2>
        </header>

        {/* Phone only — from 768px the rail's avatar says who's signed in. */}
        {user && (
          <div className='settings-nav__identity'>
            <Avatar name={user.name} src={user.avatar_url} size='lg' />
            <div className='settings-nav__who'>
              <p className='settings-nav__name'>{user.name}</p>
              <p className='settings-nav__email'>{user.email}</p>
              {user.bio && <p className='settings-nav__bio'>{user.bio}</p>}
            </div>
          </div>
        )}

        <nav aria-label='Settings sections'>
          <ul className='settings-nav__list'>
            {SECTIONS.map((section) => (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className='settings-nav__item'
                  aria-current={section.isCurrent(pathname, hash) ? 'page' : undefined}
                >
                  <Icon name={section.icon} size={18} />
                  <span className='settings-nav__label'>{section.label}</span>
                  {section.soon && (
                    <>
                      {' '}
                      <Badge tone='soon'>Soon</Badge>
                    </>
                  )}
                  {section.to === '/settings' && (
                    <span className='settings-nav__value' aria-hidden='true'>
                      {THEME_LABELS[theme]}
                    </span>
                  )}
                  <Icon name='chevR' size={16} className='settings-nav__chevron' />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <footer className='settings-nav__footer'>
          <button type='button' className='settings-nav__signout' onClick={() => void signOut()}>
            <Icon name='logout' size={18} />
            Sign out
          </button>
        </footer>
      </section>

      <main id='main-content' className='settings-main' tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}

export default SettingsLayout
