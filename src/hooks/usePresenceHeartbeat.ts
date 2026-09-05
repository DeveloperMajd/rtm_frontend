import { useEffect } from 'react'
import * as presenceApi from '../services/api/presence'

const HEARTBEAT_INTERVAL_MS = 15000

const usePresenceHeartbeat = (enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return

    void presenceApi.heartbeat()
    const interval = setInterval(() => void presenceApi.heartbeat(), HEARTBEAT_INTERVAL_MS)

    const handlePageHide = () => presenceApi.leaveViaBeacon()
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      clearInterval(interval)
      window.removeEventListener('pagehide', handlePageHide)
      presenceApi.leaveViaBeacon()
    }
  }, [enabled])
}

export default usePresenceHeartbeat
