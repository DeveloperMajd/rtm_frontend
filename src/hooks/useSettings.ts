import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getSettings, updateSettings, type UserSettings } from '../services/api/settings'

export const settingsKey = ['settings'] as const

/** What the server starts everyone with — what the app has always done. */
export const DEFAULT_SETTINGS: UserSettings = {
  read_receipts: true,
  last_seen_visibility: 'everyone',
  typing_indicators: true,
  message_sounds: false,
  desktop_notifications: false,
}

/** The settings as last known, for code outside React's render (Echo
 * handlers, the composer's typing ping): the defaults until loaded. */
export function currentSettings(queryClient: QueryClient): UserSettings {
  return queryClient.getQueryData<UserSettings>(settingsKey) ?? DEFAULT_SETTINGS
}

/**
 * The viewer's notification and privacy settings. Loaded once per session
 * by the signed-in shell (they're only ever changed from here, so nothing
 * else makes them stale) and read wherever they decide something.
 */
export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: getSettings, staleTime: Infinity })
}

/** Changes settings at once, going back with a toast if the server
 * refuses. */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  const { mutate } = useMutation({
    mutationFn: (changes: Partial<UserSettings>) => updateSettings(changes),
    onMutate: (changes) => {
      const before = currentSettings(queryClient)
      queryClient.setQueryData<UserSettings>(settingsKey, { ...before, ...changes })
      return { before }
    },
    onSuccess: (settings, _changes, context) => {
      queryClient.setQueryData(settingsKey, settings)
      // Switching read receipts changes what the viewer may see of everyone's
      // reading from now on: the server has just noted where each pointer
      // stands. What's cached (readPointersKey, messageInfoKey) is asked for
      // again rather than worked out here.
      if (context && context.before.read_receipts !== settings.read_receipts) {
        void queryClient.invalidateQueries({ queryKey: ['reads'] })
        void queryClient.invalidateQueries({ queryKey: ['message-info'] })
      }
    },
    onError: (_error, _changes, context) => {
      if (context) queryClient.setQueryData(settingsKey, context.before)
      toast.error('Couldn’t save that setting. Please try again.', { id: 'settings-failed' })
    },
  })

  return mutate
}
