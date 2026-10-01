import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import Switch from '../components/ui/Switch'
import Segmented from '../components/ui/Segmented'
import { setTheme, useThemePref, type ThemePref } from '../utils/theme'
import SettingsPageHeader from '../components/settings/SettingsPageHeader'
import { DEFAULT_SETTINGS, useSettings, useUpdateSettings } from '../hooks/useSettings'
import type { LastSeenVisibility } from '../services/api/settings'
import { notificationPermission, playMessageTone, unlockAudio } from '../utils/alerts'

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

/** One setting: what it's called and what it does, and its control —
 * given the ids that label and describe it. */
const SettingRow = ({
  title,
  description,
  note,
  control,
}: {
  title: string
  description: string
  /** Something to know about this setting right now (a browser's refusal). */
  note?: ReactNode
  control: (ids: { labelledBy: string; describedBy: string }) => ReactNode
}) => {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <li className='setting-row'>
      <div className='setting-row__text'>
        <span className='setting-row__title' id={titleId}>
          {title}
        </span>
        <span className='setting-row__description' id={descriptionId}>
          {description}
        </span>
        {note && <span className='setting-row__note'>{note}</span>}
      </div>
      {control({ labelledBy: titleId, describedBy: descriptionId })}
    </li>
  )
}

const LAST_SEEN: { value: LastSeenVisibility; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My contacts' },
  { value: 'nobody', label: 'Nobody' },
]

/**
 * Desktop notifications need this browser's permission as well as the
 * setting, which follows the person between devices. It's only ever asked
 * for here, from turning the switch on — never out of the blue. Refused, the
 * switch stays off and says where to change the browser's mind; set on
 * another device but not allowed in this browser yet, it offers to ask.
 */
const DesktopNotificationsRow = ({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) => {
  const [permission, setPermission] = useState(notificationPermission)

  const ask = async (): Promise<NotificationPermission> => {
    const answer = await Notification.requestPermission()
    setPermission(answer)
    return answer
  }

  const toggle = async (next: boolean) => {
    if (!next) return onChange(false)
    if (permission === 'unsupported' || permission === 'denied') return
    if ((permission === 'granted' ? 'granted' : await ask()) === 'granted') onChange(true)
  }

  let note: ReactNode = null
  if (permission === 'unsupported') {
    note = 'This browser doesn’t offer desktop notifications.'
  } else if (permission === 'denied') {
    note = 'Blocked in this browser. Allow notifications for this site in the browser’s settings, then turn this on.'
  } else if (on && permission === 'default') {
    note = (
      <>
        Not allowed in this browser yet.{' '}
        <button type='button' className='setting-row__action' onClick={() => void ask()}>
          Allow
        </button>
      </>
    )
  }

  return (
    <SettingRow
      title='Desktop notifications'
      description='Show an alert, with who wrote and what they said, when RTM is in the background.'
      note={note}
      control={(ids) => (
        <Switch
          checked={on && permission !== 'denied' && permission !== 'unsupported'}
          disabled={permission === 'unsupported'}
          onChange={(next) => void toggle(next)}
          {...ids}
        />
      )}
    />
  )
}

/**
 * Settings-1440: Appearance, then Notifications and Privacy. The privacy
 * settings are enforced by the server, wherever what they hide would leave
 * it; the notification ones follow the person between devices, and this
 * browser acts on them (see useUserChannel).
 */
function SettingsPage() {
  const { hash } = useLocation()
  const notificationsRef = useRef<HTMLHeadingElement>(null)
  const privacyRef = useRef<HTMLHeadingElement>(null)
  const { data: settings = DEFAULT_SETTINGS } = useSettings()
  const update = useUpdateSettings()

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
      <SettingsPageHeader title='Appearance' />

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
          <p className='settings-section__hint'>
            For messages in chats you’re not looking at. To quiet one chat, mute it from its info panel or its row
            in the list.
          </p>
          <ul className='setting-rows'>
            <SettingRow
              title='Message sounds'
              description='Play a soft tone when a message arrives.'
              control={(ids) => (
                <Switch
                  checked={settings.message_sounds}
                  onChange={(on) => {
                    // Turned on by a click, which is what lets a page make
                    // sound at all — so play it once, to hear what it is.
                    if (on) {
                      unlockAudio()
                      playMessageTone()
                    }
                    update({ message_sounds: on })
                  }}
                  {...ids}
                />
              )}
            />
            <DesktopNotificationsRow
              on={settings.desktop_notifications}
              onChange={(on) => update({ desktop_notifications: on })}
            />
          </ul>
        </section>

        <section className='settings-section' aria-labelledby='privacy'>
          <h2 id='privacy' ref={privacyRef} tabIndex={-1} className='settings-section__title'>
            Privacy
          </h2>
          <p className='settings-section__hint'>Control what people can see about you.</p>
          <ul className='setting-rows'>
            <SettingRow
              title='Read receipts'
              description='Let people see when you’ve read their messages. Turn it off and you won’t see when they’ve read yours either.'
              control={(ids) => (
                <Switch checked={settings.read_receipts} onChange={(on) => update({ read_receipts: on })} {...ids} />
              )}
            />
            <SettingRow
              title='Show last seen'
              description='Choose who can see when you were last online. Whether you’re online right now still shows.'
              control={(ids) => (
                <Segmented
                  value={settings.last_seen_visibility}
                  options={LAST_SEEN}
                  onChange={(value) => update({ last_seen_visibility: value })}
                  {...ids}
                />
              )}
            />
            <SettingRow
              title='Typing indicators'
              description='Let people see when you’re typing. You’ll still see when they are.'
              control={(ids) => (
                <Switch checked={settings.typing_indicators} onChange={(on) => update({ typing_indicators: on })} {...ids} />
              )}
            />
          </ul>
        </section>
      </div>
    </div>
  )
}

export default SettingsPage
