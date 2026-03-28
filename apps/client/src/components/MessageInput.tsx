import { useState, useRef, KeyboardEvent } from 'react'
import { useMessageStore } from '../store/messageStore'
import { useAuthStore } from '../store/authStore'
import { wsClient } from '../lib/ws'

const MAX_LENGTH = 2000
const WARN_AT = 1800

export function MessageInput({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [content, setContent] = useState('')
  const { sendMessage } = useMessageStore()
  const { user } = useAuthStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (value: string) => {
    if (value.length > MAX_LENGTH) return
    setContent(value)

    // Typing indicator debounce
    if (!typingRef.current) {
      wsClient.send('TYPING_START', { channelId })
    }
    if (typingRef.current) clearTimeout(typingRef.current)
    typingRef.current = setTimeout(() => {
      typingRef.current = null
    }, 5000)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed || !user) return
    setContent('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendMessage(channelId, trimmed, user.id, user.username)
  }

  const remaining = MAX_LENGTH - content.length
  const showCounter = content.length >= WARN_AT

  return (
    <div className="px-4 pb-6 pt-2 flex-shrink-0">
      <div className={`flex items-end gap-2 bg-bg-modifier rounded-lg px-4 py-3 ${content.length >= MAX_LENGTH ? 'ring-1 ring-danger' : ''}`}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="flex-1 bg-transparent text-text-normal placeholder-text-muted resize-none focus:outline-none text-sm leading-relaxed max-h-48"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {showCounter && (
            <span className={`text-xs tabular-nums ${remaining <= 0 ? 'text-danger' : remaining < 100 ? 'text-warning' : 'text-text-muted'}`}>
              {remaining}
            </span>
          )}
          <button
            onClick={handleSend}
            disabled={!content.trim()}
            className="text-brand hover:text-white disabled:text-text-muted disabled:cursor-not-allowed transition-colors p-1"
            title="Send message (Enter)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
      <p className="text-text-muted text-xs mt-1.5 px-1">
        <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for new line · **bold** · *italic* · `code`
      </p>
    </div>
  )
}
