import { Link, Outlet, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuth from '../hooks/useAuth'
import Badge from '../components/ui/Badge'
import Icon from '../components/ui/Icon'
import type { IconName } from '../components/ui/icons'

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
 */
function SettingsLayout() {
  const { logout } = useAuth()
  const { pathname, hash } = useLocation()

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
      <section className='settings-nav' aria-labelledby='settings-nav-title'>
        <header className='settings-nav__header'>
          {/* Below 1024px there's no rail to go back to Chats with. */}
          <Link to='/conversations' className='settings-nav__back' aria-label='Back to chats'>
            <Icon name='arrowLeft' />
          </Link>
          <h2 id='settings-nav-title' className='settings-nav__title'>
            Settings
          </h2>
        </header>

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
