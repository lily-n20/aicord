import { useState, useRef, KeyboardEvent, useCallback } from 'react'
import { useMessageStore } from '../store/messageStore'
import { useAuthStore } from '../store/authStore'
import { wsClient } from '../lib/ws'
import { api } from '../lib/api'

const MAX_LENGTH = 2000
const WARN_AT = 1800
const SUGGEST_DEBOUNCE_MS = 2000
const SUGGEST_THROTTLE_MS = 3000

export function MessageInput({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [content, setContent] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const { sendMessage } = useMessageStore()
  const { user } = useAuthStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSuggestTimeRef = useRef<number>(0)

  const fetchSuggestion = useCallback(async (draft: string) => {
    const now = Date.now()
    if (now - lastSuggestTimeRef.current < SUGGEST_THROTTLE_MS) return
    lastSuggestTimeRef.current = now

    try {
      const res = await api.post<{ suggestion: string | null }>(
        `/channels/${channelId}/ai/suggest`,
        { content: draft }
      )
      // Only apply if the draft hasn't changed while we were waiting
      setSuggestion(res.suggestion)
    } catch {
      // Suggestion failures are silent
    }
  }, [channelId])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault()
      setContent(suggestion)
      setSuggestion(null)
      // Resize after applying suggestion
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
        }
      })
      return
    }
    if (e.key === 'Escape' && suggestion) {
      setSuggestion(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (value: string) => {
    if (value.length > MAX_LENGTH) return
    setContent(value)
    setSuggestion(null)

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

    // AI suggestion debounce — trigger after 2s of inactivity
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current)
    if (value.trim().length >= 3) {
      suggestDebounceRef.current = setTimeout(() => {
        fetchSuggestion(value.trim())
      }, SUGGEST_DEBOUNCE_MS)
    }
  }

  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed || !user) return
    setSuggestion(null)
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current)
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
      {suggestion && (
        <div className="mt-1.5 px-1 flex items-start gap-2">
          <span className="text-brand text-xs font-semibold flex-shrink-0 mt-0.5">✦ AI</span>
          <p className="text-text-muted text-xs italic flex-1 truncate">{suggestion}</p>
          <span className="text-text-muted text-xs flex-shrink-0">
            <kbd className="bg-bg-modifier px-1 py-0.5 rounded text-xs">Tab</kbd> accept ·{' '}
            <kbd className="bg-bg-modifier px-1 py-0.5 rounded text-xs">Esc</kbd> dismiss
          </span>
        </div>
      )}
      {!suggestion && (
        <p className="text-text-muted text-xs mt-1.5 px-1">
          <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for new line · **bold** · *italic* · `code`
        </p>
      )}
    </div>
  )
}
