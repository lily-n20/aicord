import { useState } from 'react'
import { MessageWithAuthor } from '../store/messageStore'
import { ReactionBar } from './ReactionBar'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { useMessageStore } from '../store/messageStore'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

export function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-4">
      <div className="flex-1 h-px bg-bg-modifier" />
      <span className="text-xs text-text-muted font-semibold">{formatDate(date)}</span>
      <div className="flex-1 h-px bg-bg-modifier" />
    </div>
  )
}

export function MessageItem({ message, grouped }: { message: MessageWithAuthor; grouped: boolean }) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [saving, setSaving] = useState(false)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const { updateMessage, removeMessage } = useMessageStore()
  const isOwn = message.authorId === currentUserId
  const isAI = message.authorType === 'ai'
  const isDeleted = message.content === '[deleted]'

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === message.content) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await api.patch<{ message: MessageWithAuthor }>(`/messages/${message.id}`, { content: editContent })
      updateMessage(res.message)
      setEditing(false)
    } catch {
      // leave editing open on error
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this message?')) return
    await api.delete(`/messages/${message.id}`)
    removeMessage(message.channelId, message.id)
  }

  const content = (
    <>
      {editing ? (
        <div className="mt-1">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
              if (e.key === 'Escape') setEditing(false)
            }}
            disabled={saving}
            rows={2}
            className="w-full bg-bg-modifier text-text-normal text-sm rounded px-3 py-2 focus:outline-none resize-none border border-brand disabled:opacity-60"
            autoFocus
          />
          <p className="text-xs text-text-muted mt-1">
            <strong>Enter</strong> to save · <strong>Esc</strong> to cancel
          </p>
        </div>
      ) : (
        <p className={`text-text-normal text-sm leading-relaxed whitespace-pre-wrap break-words ${isDeleted ? 'italic text-text-muted' : ''} ${isAI ? 'bg-brand/10 px-3 py-2 rounded-lg' : ''}`}>
          {message.content}
          {message.editedAt && !isDeleted && <span className="text-text-muted text-xs ml-1">(edited)</span>}
        </p>
      )}
      {!isDeleted && !editing && (
        <ReactionBar messageId={message.id} channelId={message.channelId} />
      )}
      {message.failed && <p className="text-danger text-xs mt-1">Failed to send</p>}
    </>
  )

  const actions = !isDeleted && !isAI && (
    <div className="absolute right-4 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1 bg-bg-secondary border border-bg-modifier rounded shadow-md p-0.5 transition-opacity">
      {isOwn && (
        <button
          onClick={() => { setEditing(true); setEditContent(message.content) }}
          className="p-1.5 rounded text-text-muted hover:text-text-normal hover:bg-bg-modifier text-xs transition-colors"
          title="Edit"
        >
          ✏️
        </button>
      )}
      <button
        onClick={handleDelete}
        className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-bg-modifier text-xs transition-colors"
        title="Delete"
      >
        🗑️
      </button>
    </div>
  )

  if (grouped) {
    return (
      <div className={`px-4 py-0.5 group hover:bg-white/[0.02] relative ${message.pending ? 'opacity-60' : ''}`}>
        {actions}
        <div className="ml-12">{content}</div>
      </div>
    )
  }

  return (
    <div className={`px-4 py-2 group hover:bg-white/[0.02] flex gap-3 relative ${message.pending ? 'opacity-60' : ''}`}>
      {actions}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${isAI ? 'bg-brand' : 'bg-bg-modifier'} text-white`}>
        {isAI ? 'AI' : (message.author?.username[0].toUpperCase() ?? '?')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`font-semibold text-sm ${isAI ? 'text-brand' : 'text-text-normal'}`}>
            {isAI ? 'AICORD AI' : (message.author?.username ?? 'Unknown')}
          </span>
          {isAI && <span className="bg-brand/20 text-brand text-xs px-1.5 py-0.5 rounded font-semibold">AI</span>}
          <span className="text-text-muted text-xs">{formatTime(message.createdAt)}</span>
        </div>
        {content}
      </div>
    </div>
  )
}
