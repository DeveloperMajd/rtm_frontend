import { useOutletContext } from 'react-router-dom'
import Icon from '../ui/Icon'
import SignalBars from '../ui/SignalBars'
import type { AppShellContext } from '../../layouts/appShellContext'
import { LIVE_MESSAGE, SIGNAL_OF } from '../../utils/connection'

/**
 * States-Connection's "strip in the conversation": under the header while
 * the app isn't live, then "Back online" for a moment once it is again.
 * Not a live region — AppShell announces the same change wherever the
 * viewer is; this is the version that stays on screen.
 */
const ConnectionStrip = () => {
  // Absent outside the app shell (a room rendered on its own in a test).
  const shell = useOutletContext<AppShellContext | undefined>()
  if (!shell) return null
  const { connection, recovered } = shell

  if (recovered) {
    return (
      <div className='conn-strip is-back'>
        <Icon name='check' size={14} />
        Back online
      </div>
    )
  }
  if (connection === 'connected') return null

  return (
    <div className={`conn-strip is-${connection}`}>
      {connection === 'offline' ? <Icon name='wifiOff' size={14} /> : <SignalBars state={SIGNAL_OF[connection]} />}
      {LIVE_MESSAGE[connection]}
    </div>
  )
}

export default ConnectionStrip
