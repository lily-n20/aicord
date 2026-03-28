import { create } from 'zustand'

interface ChannelState {
  activeChannelId: string | null
  setActiveChannel: (id: string | null) => void
}

export const useChannelStore = create<ChannelState>((set) => ({
  activeChannelId: null,
  setActiveChannel: (id) => set({ activeChannelId: id }),
}))
