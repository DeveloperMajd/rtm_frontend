import api from './axios'

/** Who may see when you were last online. */
export type LastSeenVisibility = 'everyone' | 'contacts' | 'nobody'

/** The viewer's notification and privacy settings (Settings-1440). */
export type UserSettings = {
  read_receipts: boolean
  last_seen_visibility: LastSeenVisibility
  typing_indicators: boolean
  message_sounds: boolean
  desktop_notifications: boolean
}

const getSettings = async (): Promise<UserSettings> => {
  const response = await api.get<{ data: UserSettings }>('/settings')
  return response.data.data
}

/** Changes some of them; resolves with all of them as they now stand. */
const updateSettings = async (changes: Partial<UserSettings>): Promise<UserSettings> => {
  const response = await api.patch<{ data: UserSettings }>('/settings', changes)
  return response.data.data
}

export { getSettings, updateSettings }
