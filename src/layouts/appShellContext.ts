import { useOutletContext } from 'react-router-dom'
import type { SignalState } from '../components/ui/SignalBars'

export type ListTab = 'chats' | 'contacts'

/** What the signed-in screens below AppShell share with it. */
export type AppShellContext = {
  /** Which list the Chats screen shows — the rail's Chats/Contacts buttons. */
  activeTab: ListTab
  setActiveTab: (tab: ListTab) => void
  openSearch: () => void
  /** The live connection, for the phone's "Live" tag beside the Chats title
   * (the rail shows it from 768px). */
  signal: SignalState
}

export const useAppShell = () => useOutletContext<AppShellContext>()
