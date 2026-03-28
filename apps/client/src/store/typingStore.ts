import { create } from 'zustand'

interface TypingState {
  typers: Record<string, Record<string, number>> // channelId -> userId -> timestamp
  setTyping: (channelId: string, userId: string) => void
  clearExpired: () => void
}

export const useTypingStore = create<TypingState>((set, get) => ({
  typers: {},
  setTyping: (channelId, userId) =>
    set((s) => ({
      typers: {
        ...s.typers,
        [channelId]: { ...(s.typers[channelId] ?? {}), [userId]: Date.now() },
      },
    })),
  clearExpired: () => {
    const now = Date.now()
    const { typers } = get()
    const updated: typeof typers = {}
    for (const [ch, users] of Object.entries(typers)) {
      const fresh: Record<string, number> = {}
      for (const [uid, ts] of Object.entries(users)) {
        if (now - ts < 5000) fresh[uid] = ts
      }
      if (Object.keys(fresh).length > 0) updated[ch] = fresh
    }
    set({ typers: updated })
  },
}))
