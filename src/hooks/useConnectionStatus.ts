import { useEffect, useState } from 'react'
import type { ConnectionStatus } from 'laravel-echo'
import useEcho from './useEcho'

/** Echo/Pusher auto-reconnect on drop; this just surfaces the current state
 * (e.g. to show a "Reconnecting…" banner) rather than doing anything itself. */
const useConnectionStatus = (): ConnectionStatus => {
  const echo = useEcho()
  const [status, setStatus] = useState<ConnectionStatus>(() => echo.connector.connectionStatus())

  useEffect(() => {
    return echo.connector.onConnectionChange(setStatus)
  }, [echo])

  return status
}

export default useConnectionStatus
