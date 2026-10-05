import type { ConnectionStatus } from 'laravel-echo'
import type { SignalState } from '../components/ui/SignalBars'

/**
 * How live the app is (States-Connection): the link to Reverb as Echo
 * reports it, except that a browser with no network at all is simply
 * offline — whatever Echo is still trying.
 */
export type LiveState = 'connected' | 'connecting' | 'reconnecting' | 'offline' | 'failed'

export function liveStateOf(echo: ConnectionStatus, browserOnline: boolean): LiveState {
  if (!browserOnline) return 'offline'
  switch (echo) {
    case 'connected':
      return 'connected'
    case 'connecting':
      return 'connecting'
    case 'reconnecting':
    case 'disconnected':
      return 'reconnecting'
    case 'failed':
      return 'failed'
  }
}

/** The signal-bars glyph (DS-Signal-Motion) for each state. */
export const SIGNAL_OF: Record<LiveState, SignalState> = {
  connected: 'connected',
  connecting: 'connecting',
  reconnecting: 'reconnecting',
  offline: 'offline',
  failed: 'offline',
}

/** A word or two, for the phone's Live tag and the rail's tooltip. */
export const LIVE_LABEL: Record<LiveState, string> = {
  connected: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
  failed: 'Connection lost',
}

/** The sentence a conversation shows, and a screen reader hears. */
export const LIVE_MESSAGE: Record<LiveState, string> = {
  connected: '',
  connecting: 'Connecting to RTM…',
  reconnecting: 'Reconnecting… messages will appear as soon as we’re back.',
  offline: 'You’re offline. Your draft is kept here.',
  failed: 'Can’t reach RTM right now. Still trying…',
}
