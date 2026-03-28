import { useEffect } from 'react'
import { wsClient } from '../lib/ws'
import { useServerStore } from '../store/serverStore'
import { useMessageStore, MessageWithAuthor } from '../store/messageStore'
import { usePresenceStore } from '../store/presenceStore'
import { useWSStore } from '../store/wsStore'
import { useReactionStore, ReactionGroup } from '../store/reactionStore'
import { useTypingStore } from '../store/typingStore'
import { useSummaryStore, SummaryEntry } from '../store/summaryStore'
import type { ReadyPayload, Presence } from '@aicord/shared'

export function useWSEvents() {
  const setServers = useServerStore((s) => s.setServers)
  const appendMessage = useMessageStore((s) => s.appendMessage)
  const updateMessage = useMessageStore((s) => s.updateMessage)
  const removeMessage = useMessageStore((s) => s.removeMessage)
  const setPresence = usePresenceStore((s) => s.setPresence)
  const setConnected = useWSStore((s) => s.setConnected)
  const setReconnecting = useWSStore((s) => s.setReconnecting)

  useEffect(() => {
    const offs = [
      wsClient.on<ReadyPayload>('READY', (payload) => {
        setServers(payload.servers)
        setConnected(true)
      }),
      wsClient.on('CONNECTED', () => setConnected(true)),
      wsClient.on('DISCONNECTED', () => setReconnecting(true)),
      wsClient.on<MessageWithAuthor>('MESSAGE_CREATE', (msg) => {
        // Don't append if it's already in the store (sent by this client optimistically)
        const existing = useMessageStore.getState().messagesByChannel[msg.channelId]
        const alreadyExists = existing?.some((m) => m.id === msg.id)
        if (!alreadyExists) appendMessage(msg)
      }),
      wsClient.on<MessageWithAuthor>('MESSAGE_UPDATE', (msg) => updateMessage(msg)),
      wsClient.on<{ messageId: string; channelId: string }>('MESSAGE_DELETE', ({ messageId, channelId }) =>
        removeMessage(channelId, messageId)
      ),
      wsClient.on<{ userId: string; presence: Presence }>('PRESENCE_UPDATE', ({ userId, presence }) =>
        setPresence(userId, presence)
      ),
      wsClient.on<{ messageId: string; channelId: string; reactions: ReactionGroup[] }>('REACTION_ADD', ({ messageId, reactions }) => {
        useReactionStore.getState().setReactions(messageId, reactions)
      }),
      wsClient.on<{ messageId: string; channelId: string; reactions: ReactionGroup[] }>('REACTION_REMOVE', ({ messageId, reactions }) => {
        useReactionStore.getState().setReactions(messageId, reactions)
      }),
      wsClient.on<{ userId: string; channelId: string }>('TYPING_START', ({ userId, channelId }) => {
        useTypingStore.getState().setTyping(channelId, userId)
      }),
      wsClient.on<{ channelId: string; summary: string; messageCount: number; generatedAt: string }>(
        'AI_SUMMARY',
        ({ channelId, summary, messageCount, generatedAt }) => {
          useSummaryStore.getState().setSummary(channelId, { summary, messageCount, generatedAt })
        }
      ),
    ]
    return () => offs.forEach((off) => off())
  }, [])
}
