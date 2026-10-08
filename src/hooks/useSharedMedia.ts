import { useInfiniteQuery } from '@tanstack/react-query'
import { getSharedMedia, type SharedKind } from '../services/api/sharedMedia'

/** Everything shared in one conversation, under one key: a new photo, or a
 * deleted message, refreshes whichever lists of it are open. */
export const sharedMediaKey = (conversationId: string) => ['shared-media', conversationId] as const

/**
 * A conversation's shared photos or files, newest first, `pageSize` at a
 * time — a few for the info panel, more for See all. Read afresh whenever
 * it's shown: the links in it are signed for half an hour.
 */
export function useSharedMedia(conversationId: string, kind: SharedKind, pageSize: number) {
  return useInfiniteQuery({
    queryKey: [...sharedMediaKey(conversationId), kind, pageSize],
    queryFn: ({ pageParam }) => getSharedMedia(conversationId, kind, pageParam, pageSize),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.meta.has_more ? lastPage.meta.next_before_id : undefined),
    staleTime: 0,
  })
}
