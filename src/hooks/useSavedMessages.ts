import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getSavedMessageIds,
  getSavedMessages,
  saveMessage,
  unsaveMessage,
  type SavedMessagesPage,
} from '../services/api/savedMessages'

/** Everything about the viewer's saved messages, under one key. */
export const savedMessagesKey = ['saved-messages'] as const
export const savedIdsKey = [...savedMessagesKey, 'ids'] as const
export const savedListKey = [...savedMessagesKey, 'list'] as const

const NONE: ReadonlySet<string> = new Set()
// Outside the hook, so React Query keeps the same Set until the ids change.
const toSet = (ids: string[]): ReadonlySet<string> => new Set(ids)

/**
 * Which messages the viewer has saved, for the message menus. Asked once,
 * then kept current by the saves made here (useToggleSaved). Nothing about
 * saving is broadcast, so another tab's saves show after a reload; saving
 * the same message again there does no harm.
 */
export function useSavedMessageIds(): ReadonlySet<string> {
  const { data } = useQuery({ queryKey: savedIdsKey, queryFn: getSavedMessageIds, staleTime: Infinity, select: toSet })
  return data ?? NONE
}

/**
 * The Saved list, most recently saved first, a page at a time. Read afresh
 * whenever it's opened: while it's closed, messages are edited or deleted,
 * and conversations left.
 */
export function useSavedMessages() {
  return useInfiniteQuery({
    queryKey: savedListKey,
    queryFn: ({ pageParam }) => getSavedMessages(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.meta.has_more ? lastPage.meta.next_before_id : undefined),
    staleTime: 0,
  })
}

/** Takes a message out of whatever pages of the Saved list are loaded. */
const dropFromList = (queryClient: QueryClient, messageId: string) => {
  queryClient.setQueryData<InfiniteData<SavedMessagesPage>>(savedListKey, (old) =>
    old && {
      ...old,
      pages: old.pages.map((page) => ({ ...page, data: page.data.filter((saved) => saved.message.id !== messageId) })),
    },
  )
}

/**
 * Save a message, or take it off the Saved list. The menus and the list
 * change at once, go back if the server says no, and a toast says which
 * happened.
 */
export function useToggleSaved() {
  const queryClient = useQueryClient()

  const { mutate } = useMutation({
    mutationFn: ({ messageId, save }: { messageId: string; save: boolean }) =>
      save ? saveMessage(messageId) : unsaveMessage(messageId),
    onMutate: async ({ messageId, save }) => {
      // An answer to an earlier ask for the ids would land on top of this.
      await queryClient.cancelQueries({ queryKey: savedIdsKey })
      const before = queryClient.getQueryData<string[]>(savedIdsKey)
      // Only ids already fetched: a list made up here would pass for the
      // full one, and never be asked for again.
      queryClient.setQueryData<string[]>(
        savedIdsKey,
        (ids) => ids && (save ? [...ids.filter((id) => id !== messageId), messageId] : ids.filter((id) => id !== messageId)),
      )
      if (!save) dropFromList(queryClient, messageId)
      return { before }
    },
    onSuccess: (_data, { messageId, save }) => {
      toast.success(save ? 'Message saved' : 'Removed from saved', { id: `saved-${messageId}` })
    },
    onError: (_error, { messageId, save }, context) => {
      if (context?.before) queryClient.setQueryData(savedIdsKey, context.before)
      toast.error(save ? 'Couldn’t save the message. Please try again.' : 'Couldn’t remove it from saved. Please try again.', {
        id: `saved-${messageId}`,
      })
    },
    // The list puts a new save in its place, and a failed removal back.
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedListKey }),
  })

  return (messageId: string, save: boolean) => mutate({ messageId, save })
}
