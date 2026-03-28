import { useState } from 'react'
import { useReactionStore, ReactionGroup } from '../store/reactionStore'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { EmojiPicker } from './EmojiPicker'

interface ReactionBarProps {
  messageId: string
  channelId: string
}

export function ReactionBar({ messageId, channelId }: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false)
  const reactions = useReactionStore((s) => s.reactionsByMessage[messageId] ?? [])
  const setReactions = useReactionStore((s) => s.setReactions)
  const userId = useAuthStore((s) => s.user?.id)

  const handleReact = async (emoji: string) => {
    if (!userId) return
    const existing = reactions.find((r) => r.emoji === emoji)
    const alreadyReacted = existing?.userIds.includes(userId)

    // Optimistic update
    let optimistic: ReactionGroup[]
    if (alreadyReacted) {
      optimistic = reactions
        .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, userIds: r.userIds.filter((id) => id !== userId) } : r)
        .filter((r) => r.count > 0)
    } else {
      const found = reactions.find((r) => r.emoji === emoji)
      if (found) {
        optimistic = reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, userIds: [...r.userIds, userId] } : r)
      } else {
        optimistic = [...reactions, { emoji, count: 1, userIds: [userId] }]
      }
    }
    setReactions(messageId, optimistic)

    try {
      if (alreadyReacted) {
        const res = await api.delete<{ reactions: ReactionGroup[] }>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`)
        setReactions(messageId, res.reactions)
      } else {
        const res = await api.post<{ reactions: ReactionGroup[] }>(`/messages/${messageId}/reactions`, { emoji })
        setReactions(messageId, res.reactions)
      }
    } catch {
      // revert on failure
      setReactions(messageId, reactions)
    }
  }

  if (reactions.length === 0 && !showPicker) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1 ml-12 relative">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleReact(r.emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            userId && r.userIds.includes(userId)
              ? 'bg-brand/20 border-brand/40 text-brand'
              : 'bg-bg-modifier border-bg-modifier hover:border-text-muted text-text-muted'
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-bg-modifier text-text-muted hover:border-text-muted hover:text-text-normal transition-colors"
        >
          +
        </button>
        {showPicker && (
          <EmojiPicker onSelect={handleReact} onClose={() => setShowPicker(false)} />
        )}
      </div>
    </div>
  )
}
