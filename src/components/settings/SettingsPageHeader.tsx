import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'

/** A settings page's title bar. On a phone, where the page has the screen
 * to itself, it leads back to the settings list (Profile-Mobile). */
const SettingsPageHeader = ({ title }: { title: string }) => (
  <header className='settings-page__header'>
    <Link to='/me' className='settings-page__back' aria-label='Back to settings'>
      <Icon name='arrowLeft' />
    </Link>
    <h1 className='settings-page__title'>{title}</h1>
  </header>
)

export default SettingsPageHeader
