import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { ConversationPreferences } from '../services/api/conversations'
import type { ConversationType, MessageType } from '../utils/baseTypes'
import { conversationTitle, patchConversationInCache } from '../utils/conversations'
import { isViewing } from '../utils/viewing'
import { playMessageTone, showMessageNotification, unlockAudio } from '../utils/alerts'
import { applyPresenceChange, type PresenceChange } from '../utils/presence'
import { currentSettings } from './useSettings'
import { forgetTyping, noteTyping, stopTyping } from './useListTyping'
import useEcho from './useEcho'
import useAuth from './useAuth'

type ConversationsResponse = { data: ConversationType[] }

/**
 * The signed-in person's own channel: every message in any of their
 * conversations, who's typing in them, membership changes, deletions, and
 * their pin, mute and archive from other tabs. Subscribed once, by AppShell.
 *
 * It used to be subscribed by every component that read the conversation
 * list (four of them on a chat screen), and each one's cleanup stopped every
 * listener on the channel and left it — so closing a conversation silently
 * cut the list off from live updates until the next poll. One owner, for
 * as long as the person is signed in.
 *
 * It's where everyone else's presence arrives too: a change (online, away,
 * back, offline) is pushed the moment it happens, so nothing polls for it.
 * Whatever was pushed while the connection was down is asked for once it's
 * back.
 *
 * It's also where a message gets someone's attention (Settings
 * "Notifications"): a tone if they're not looking at that conversation, a
 * desktop notification if they're not looking at RTM at all — never for
 * their own messages, a group event, or a conversation they've muted.
 */
export default function useUserChannel() {
  const echo = useEcho()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  // Read by the listeners below without resubscribing on every navigation.
  const openConversationIdRef = useRef<string | undefined>(undefined)
  const navigateRef = useRef(navigate)
  useEffect(() => {
    openConversationIdRef.current = location.pathname.match(/^\/conversations\/([^/]+)/)?.[1]
    navigateRef.current = navigate
  }, [location.pathname, navigate])

  // Browsers keep a page silent until the person interacts with it; the
  // first click or key press is the earliest a tone can be allowed.
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const alert = (message: MessageType) => {
      if (message.type === 'system' || message.sender?.id === user.id) return
      const settings = currentSettings(queryClient)
      if (!settings.message_sounds && !settings.desktop_notifications) return

      const conversation = queryClient
        .getQueryData<ConversationsResponse>(['conversations'])
        ?.data.find((c) => c.id === message.conversation_id)
      if (conversation?.muted_at) return

      const lookingAtRtm = isViewing()
      if (lookingAtRtm && openConversationIdRef.current === message.conversation_id) return

      if (settings.message_sounds) playMessageTone()
      if (settings.desktop_notifications && !lookingAtRtm) {
        const sender = message.sender?.name ?? 'Someone'
        showMessageNotification({
          title: conversation?.type === 'group' ? `${sender} · ${conversationTitle(conversation)}` : sender,
          body: message.body || 'Sent an attachment',
          conversationId: message.conversation_id,
          onOpen: () => navigateRef.current(`/conversations/${message.conversation_id}`),
        })
      }
    }

    const channel = echo
      .private(`App.Models.User.${user.id}`)
      .listen('MessageSent', (message: MessageType) => {
        alert(message)
        // Whoever was typing it has sent it.
        if (message.sender) stopTyping(message.conversation_id, message.sender.id)

        // The open conversation's own subscription (useMessages) already
        // owns this entry's cache updates, including the read receipt.
        // Refetching here too would race with that and could clobber the
        // just-marked-read unread_count back to a stale non-zero value.
        if (message.conversation_id === openConversationIdRef.current) return

        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .listen('ConversationParticipantsUpdated', () => {
        // Membership changes rarely fire and the payload doesn't carry
        // every field ConversationType needs (last_message_at, unread_count,
        // etc.), so refetching is simpler and safer than patching the cache
        // in place — unlike messages, this isn't latency-sensitive.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .listen('ConversationDeleted', () => {
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .listen('ConversationPreferencesUpdated', (preferences: { conversation_id: string } & ConversationPreferences) => {
        // Pinned, muted or archived in another tab or on another device.
        const { conversation_id, ...rest } = preferences
        patchConversationInCache(queryClient, conversation_id, rest)
      })
      // Someone typing in any of the viewer's conversations, for its row in
      // the chat list (useListTyping). The open room shows it too, from the
      // conversation's own channel.
      .listen('TypingIndicator', ({ conversation_id, user_id, name }: { conversation_id: string; user_id: string; name: string }) => {
        if (user_id !== user.id) noteTyping(conversation_id, user_id, name)
      })
      .listen('PresenceChanged', (change: PresenceChange) => {
        applyPresenceChange(queryClient, change)
        // "Last seen" depends on who's asking (their settings and the
        // viewer's), so the server works it out: asked for, not pushed.
        if (change.presence_status === 'offline') {
          void queryClient.invalidateQueries({ queryKey: ['conversations'] })
          void queryClient.invalidateQueries({ queryKey: ['contacts'] })
        }
      })

    // Nothing reaches a dropped connection, and nothing polls to make up for
    // it: messages, membership, anyone coming or going. So once it's back,
    // ask for the lists again. Not after the first connect of a page load,
    // which they were just fetched for.
    let wasConnected = echo.connector.connectionStatus() === 'connected'
    let missedSome = false
    const stopWatchingConnection = echo.connector.onConnectionChange((status) => {
      if (status !== 'connected') {
        missedSome = wasConnected
        return
      }
      wasConnected = true
      if (!missedSome) return
      missedSome = false
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
    })

    return () => {
      channel.stopListening('MessageSent')
      channel.stopListening('ConversationParticipantsUpdated')
      channel.stopListening('ConversationDeleted')
      channel.stopListening('ConversationPreferencesUpdated')
      channel.stopListening('TypingIndicator')
      channel.stopListening('PresenceChanged')
      stopWatchingConnection()
      echo.leave(`App.Models.User.${user.id}`)
      forgetTyping()
    }
  }, [user, echo, queryClient])
}
