import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useMessageStore } from '../store/messageStore'
import { MessageItem } from '../components/MessageItem'
import { MessageInput } from '../components/MessageInput'
import { TypingIndicator } from '../components/TypingIndicator'
import { wsClient } from '../lib/ws'

export function DMView() {
  const { dmId } = useParams<{ dmId: string }>()
  const { user } = useAuthStore()
  const { messagesByChannel, fetchMessages } = useMessageStore()
  const messages = dmId ? (messagesByChannel[dmId] ?? []) : []

  useEffect(() => {
    if (!dmId) return
    wsClient.subscribe(dmId)
    fetchMessages(dmId)
    return () => wsClient.unsubscribe(dmId)
  }, [dmId])

  if (!dmId || !user) return null

  return (
    <div className="flex-1 flex flex-col bg-bg-tertiary min-w-0 h-full">
      <div className="h-12 flex items-center px-4 border-b border-black/30 shadow-sm gap-2 flex-shrink-0">
        <span className="text-text-muted font-bold text-lg">@</span>
        <span className="font-semibold text-text-normal">Direct Message</span>
      </div>

      <div className="flex-1 overflow-y-auto px-0 py-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-text-muted text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1]
            const grouped =
              i > 0 &&
              prev.authorId === msg.authorId &&
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 2 * 60 * 1000
            return <MessageItem key={msg.id} message={msg} grouped={grouped} />
          })
        )}
      </div>

      <TypingIndicator channelId={dmId} />
      <MessageInput channelId={dmId} channelName="dm" />
    </div>
  )
}
