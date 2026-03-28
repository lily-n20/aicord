import { create } from 'zustand'

interface WSState {
  connected: boolean
  reconnecting: boolean
  setConnected: (v: boolean) => void
  setReconnecting: (v: boolean) => void
}

export const useWSStore = create<WSState>((set) => ({
  connected: false,
  reconnecting: false,
  setConnected: (v) => set({ connected: v, reconnecting: false }),
  setReconnecting: (v) => set({ reconnecting: v }),
}))
