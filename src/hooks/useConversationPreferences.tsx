import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  updateConversationPreferences,
  type ConversationPreferences,
} from '../services/api/conversations'
import type { ConversationType } from '../utils/baseTypes'
import { conversationTitle, patchConversationInCache } from '../utils/conversations'
import ActionToast from '../components/ui/ActionToast'

export type PreferenceChanges = { pinned?: boolean; muted?: boolean; archived?: boolean }

/**
 * What the server will make of `changes`, worked out ahead of it so the
 * list can change straight away: switching on keeps an existing time,
 * archiving also unpins, and pinning also unarchives (see
 * ConversationController::updatePreferences).
 */
export function applyPreferences(current: ConversationPreferences, changes: PreferenceChanges): ConversationPreferences {
  const now = new Date().toISOString()
  const next: ConversationPreferences = { ...current }
  if (changes.pinned !== undefined) next.pinned_at = changes.pinned ? (current.pinned_at ?? now) : null
  if (changes.muted !== undefined) next.muted_at = changes.muted ? (current.muted_at ?? now) : null
  if (changes.archived !== undefined) next.archived_at = changes.archived ? (current.archived_at ?? now) : null

  if (next.archived_at && changes.archived) next.pinned_at = null
  else if (next.pinned_at && changes.pinned) next.archived_at = null
  return next
}

const preferencesOf = (c: ConversationType): ConversationPreferences => ({
  pinned_at: c.pinned_at ?? null,
  muted_at: c.muted_at ?? null,
  archived_at: c.archived_at ?? null,
})

const FAILED: Record<keyof PreferenceChanges, [on: string, off: string]> = {
  pinned: ['Couldn’t pin the conversation', 'Couldn’t unpin the conversation'],
  muted: ['Couldn’t mute the conversation', 'Couldn’t unmute the conversation'],
  archived: ['Couldn’t archive the conversation', 'Couldn’t unarchive the conversation'],
}

/**
 * Pin, mute and archive, for the list's row actions and the info panel.
 *
 * The list changes the moment one is chosen and goes back if the server
 * says no. Archiving says so in a toast with Undo: the conversation leaves
 * the list, and that shouldn't be a surprise nobody can take back.
 */
export default function useConversationPreferences() {
  const queryClient = useQueryClient()

  const { mutate } = useMutation({
    mutationFn: ({ conversation, changes }: { conversation: ConversationType; changes: PreferenceChanges }) =>
      updateConversationPreferences(conversation.id, changes),
    onMutate: ({ conversation, changes }) => {
      const before = preferencesOf(conversation)
      patchConversationInCache(queryClient, conversation.id, applyPreferences(before, changes))
      return { before }
    },
    onSuccess: (preferences, { conversation, changes }) => {
      patchConversationInCache(queryClient, conversation.id, preferences)
      if (changes.archived) {
        toast(
          (t) => (
            <ActionToast
              title='Archived'
              body={
                preferences.muted_at
                  ? `${conversationTitle(conversation)} is in Archived now. It’s muted, so it stays there when new messages arrive.`
                  : `${conversationTitle(conversation)} is in Archived now. A new message brings it back.`
              }
              actionLabel='Undo'
              onAction={() => {
                toast.dismiss(t.id)
                mutate({ conversation: { ...conversation, ...preferences }, changes: { archived: false } })
              }}
            />
          ),
          { id: `archived-${conversation.id}` },
        )
      }
    },
    onError: (_error, { conversation, changes }, context) => {
      if (context) patchConversationInCache(queryClient, conversation.id, context.before)
      const [key, value] = Object.entries(changes)[0] as [keyof PreferenceChanges, boolean]
      toast.error(FAILED[key][value ? 0 : 1], { id: `preferences-failed-${conversation.id}` })
    },
  })

  return (conversation: ConversationType, changes: PreferenceChanges) => mutate({ conversation, changes })
}
