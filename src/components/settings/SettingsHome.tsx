import BrandMark from '../ui/BrandMark'

/**
 * /me — the settings list with no section open. It's a phone's Profile tab,
 * where the list fills the screen and this stays hidden; from 768px, where
 * the list sits beside it, this is the space waiting for a choice.
 */
const SettingsHome = () => (
  <div className='settings-main__empty'>
    <BrandMark size={44} withWordmark={false} />
    <p>Choose a section to see its settings.</p>
  </div>
)

export default SettingsHome
