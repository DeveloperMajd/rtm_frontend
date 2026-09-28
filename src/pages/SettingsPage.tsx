import { useEffect, useId, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Icon from '../components/ui/Icon'
import Switch from '../components/ui/Switch'
import { setTheme, useThemePref, type ThemePref } from '../utils/theme'

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
]

/** Settings-1440 "Theme": one card per theme, a small picture of the app in
 * it. A radio group underneath, so arrow keys move between them. */
const ThemePicker = () => {
  const pref = useThemePref()

  return (
    <div className='theme-picker' role='radiogroup' aria-labelledby='theme-heading' aria-describedby='theme-hint'>
      {THEMES.map(({ value, label }) => (
        <label key={value} className={`theme-card is-${value}`}>
          <input
            type='radio'
            name='theme'
            className='sr-only'
            value={value}
            checked={pref === value}
            onChange={() => setTheme(value)}
          />
          <span className='theme-card__preview' aria-hidden='true'>
            <span className='theme-card__rail' />
            <span className='theme-card__stage'>
              <span className='theme-card__line' />
              <span className='theme-card__bubble' />
            </span>
          </span>
          <span className='theme-card__label'>
            {pref === value && <Icon name='check' size={14} />}
            {label}
          </span>
        </label>
      ))}
    </div>
  )
}

type SoonRowProps = {
  title: string
  tag: 'Soon' | 'Needs API'
  description: string
  /** What's true today, which the disabled switch shows. */
  on: boolean
}

const SoonRow = ({ title, tag, description, on }: SoonRowProps) => {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <li className='setting-row is-soon'>
      <div className='setting-row__text'>
        <span className='setting-row__title' id={titleId}>
          {title}{' '}
          <Badge tone={tag === 'Soon' ? 'soon' : 'needs-api'}>{tag}</Badge>
        </span>
        <span className='setting-row__description' id={descriptionId}>
          {description}
        </span>
      </div>
      <Switch checked={on} disabled labelledBy={titleId} describedBy={descriptionId} />
    </li>
  )
}

/**
 * Settings-1440: Appearance (live), then Notifications and Privacy, which
 * are laid out in full but not wired up yet — each row disabled, tagged,
 * and its switch showing how the app behaves today (nothing plays a sound;
 * last seen and typing are visible to others; read receipts aren't).
 */
function SettingsPage() {
  const { hash } = useLocation()
  const notificationsRef = useRef<HTMLHeadingElement>(null)
  const privacyRef = useRef<HTMLHeadingElement>(null)

  // The Notifications / Privacy links in the settings list land here with a
  // hash: bring that section into view and move focus to its heading.
  useEffect(() => {
    const target =
      hash === '#notifications' ? notificationsRef.current : hash === '#privacy' ? privacyRef.current : null
    if (!target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView?.({ block: 'start' })
  }, [hash])

  return (
    <div className='settings-page'>
      <header className='settings-page__header'>
        <h1 className='settings-page__title'>Appearance</h1>
      </header>

      <div className='settings-page__body'>
        <section className='settings-section' aria-labelledby='theme-heading'>
          <h2 id='theme-heading' className='settings-section__title'>
            Theme
          </h2>
          <p id='theme-hint' className='settings-section__hint'>
            Applies on this device. System, the default, follows your device’s setting.
          </p>
          <ThemePicker />
        </section>

        <section className='settings-section' aria-labelledby='motion-heading'>
          <h2 id='motion-heading' className='settings-section__title'>
            Motion
          </h2>
          <p className='settings-section__hint'>
            RTM follows your device’s reduced-motion setting: animations become instant changes.
          </p>
          <div className='motion-note'>
            <Icon name='zap' size={18} />
            <span className='motion-note__label'>Reduce motion</span>
            <span className='motion-note__value'>Follows system</span>
          </div>
        </section>

        <section className='settings-section' aria-labelledby='notifications'>
          <h2 id='notifications' ref={notificationsRef} tabIndex={-1} className='settings-section__title'>
            Notifications
          </h2>
          <p className='settings-section__hint'>Sounds and desktop alerts. Designed, not wired up yet.</p>
          <ul className='setting-rows'>
            <SoonRow
              title='Message sounds'
              tag='Soon'
              description='Play a soft tone for new messages in open chats.'
              on={false}
            />
            <SoonRow
              title='Desktop notifications'
              tag='Soon'
              description='Show an alert when RTM is in the background.'
              on={false}
            />
            <SoonRow
              title='Mute a conversation'
              tag='Soon'
              description='Silence one chat without leaving it, from its info panel.'
              on={false}
            />
          </ul>
        </section>

        <section className='settings-section' aria-labelledby='privacy'>
          <h2 id='privacy' ref={privacyRef} tabIndex={-1} className='settings-section__title'>
            Privacy
          </h2>
          <p className='settings-section__hint'>What people can see about you. These can’t be changed yet.</p>
          <ul className='setting-rows'>
            <SoonRow
              title='Read receipts'
              tag='Needs API'
              description='Let people see when you’ve read their messages. The server records read positions; exposing them needs a new endpoint.'
              on={false}
            />
            <SoonRow
              title='Show last seen'
              tag='Soon'
              description='Choose who can see when you were last online. Today, everyone you chat with can.'
              on
            />
            <SoonRow
              title='Typing indicators'
              tag='Soon'
              description='Let people see when you’re typing. Today, they always can.'
              on
            />
          </ul>
        </section>
      </div>
    </div>
  )
}

export default SettingsPage
