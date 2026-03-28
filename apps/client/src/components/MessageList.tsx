import { useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMessageStore, MessageWithAuthor } from '../store/messageStore'
import { MessageItem, DateSeparator } from './MessageItem'
import { TypingIndicator } from './TypingIndicator'
import { wsClient } from '../lib/ws'

type ListItem =
  | { type: 'message'; message: MessageWithAuthor }
  | { type: 'separator'; date: string }

function buildItems(messages: MessageWithAuthor[]): ListItem[] {
  const items: ListItem[] = []
  let lastDate = ''
  for (const msg of messages) {
    const date = msg.createdAt.slice(0, 10)
    if (date !== lastDate) {
      items.push({ type: 'separator', date })
      lastDate = date
    }
    items.push({ type: 'message', message: msg })
  }
  return items
}

function shouldGroup(messages: MessageWithAuthor[], index: number): boolean {
  if (index === 0) return false
  const prev = messages[index - 1]
  const curr = messages[index]
  if (prev.authorId !== curr.authorId) return false
  if (prev.authorType !== curr.authorType) return false
  const diff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()
  return diff < 2 * 60 * 1000
}

export function MessageList({ channelId }: { channelId: string }) {
  const { messagesByChannel, hasMore, fetchMessages, fetchMore } = useMessageStore()
  const messages = messagesByChannel[channelId] ?? []
  const parentRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  useEffect(() => {
    wsClient.subscribe(channelId)
    fetchMessages(channelId)
    return () => wsClient.unsubscribe(channelId)
  }, [channelId])

  const items = buildItems(messages)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (items[i].type === 'separator' ? 40 : 48),
    overscan: 10,
  })

  // Auto-scroll to bottom on new messages if already at bottom
  useEffect(() => {
    if (atBottomRef.current && virtualizer.range) {
      virtualizer.scrollToIndex(items.length - 1, { align: 'end' })
    }
  }, [messages.length])

  // Infinite scroll upward
  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    if (el.scrollTop < 200 && hasMore[channelId]) {
      fetchMore(channelId)
    }
  }, [channelId, hasMore])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">#</p>
          <p className="text-text-normal font-bold text-xl mb-1">Welcome to this channel!</p>
          <p className="text-text-muted text-sm">This is the beginning of the conversation.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={parentRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const item = items[vItem.index]
            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vItem.start}px)` }}
              >
                {item.type === 'separator' ? (
                  <DateSeparator date={item.date} />
                ) : (
                  <MessageItem
                    message={item.message}
                    grouped={shouldGroup(
                      messages,
                      messages.findIndex((m) => m.id === item.message.id)
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <TypingIndicator channelId={channelId} />
    </div>
  )
}
