import { create } from 'zustand'
import type { Presence } from '@aicord/shared'

interface PresenceState {
  presence: Record<string, Presence>
  setPresence: (userId: string, presence: Presence) => void
  setMany: (entries: Record<string, Presence>) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  presence: {},
  setPresence: (userId, presence) => set((s) => ({ presence: { ...s.presence, [userId]: presence } })),
  setMany: (entries) => set((s) => ({ presence: { ...s.presence, ...entries } })),
}))
