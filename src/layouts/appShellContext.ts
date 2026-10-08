import { useOutletContext } from 'react-router-dom'
import type { SignalState } from '../components/ui/SignalBars'
import type { LiveState } from '../utils/connection'

export type ListTab = 'chats' | 'contacts' | 'saved'

/** What the signed-in screens below AppShell share with it. */
export type AppShellContext = {
  /** Which list the Chats screen shows — the rail's Chats, Contacts and
   * Saved buttons. */
  activeTab: ListTab
  setActiveTab: (tab: ListTab) => void
  openSearch: () => void
  /** The live connection, for the phone's "Live" tag beside the Chats title
   * (the rail shows it from 768px). */
  signal: SignalState
  connection: LiveState
  /** The link just came back — "Back online" shows for a few seconds. */
  recovered: boolean
}

export const useAppShell = () => useOutletContext<AppShellContext>()
