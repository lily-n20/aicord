import { create } from 'zustand'

export interface ReactionGroup {
  emoji: string
  count: number
  userIds: string[]
}

interface ReactionState {
  reactionsByMessage: Record<string, ReactionGroup[]>
  setReactions: (messageId: string, reactions: ReactionGroup[]) => void
}

export const useReactionStore = create<ReactionState>((set) => ({
  reactionsByMessage: {},
  setReactions: (messageId, reactions) =>
    set((s) => ({ reactionsByMessage: { ...s.reactionsByMessage, [messageId]: reactions } })),
}))
