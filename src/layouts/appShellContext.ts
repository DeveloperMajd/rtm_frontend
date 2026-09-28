import { useOutletContext } from 'react-router-dom'

export type ListTab = 'chats' | 'contacts'

/** What the signed-in screens below AppShell share with it. */
export type AppShellContext = {
  /** Which list the Chats screen shows — the rail's Chats/Contacts buttons. */
  activeTab: ListTab
  setActiveTab: (tab: ListTab) => void
  openSearch: () => void
}

export const useAppShell = () => useOutletContext<AppShellContext>()
