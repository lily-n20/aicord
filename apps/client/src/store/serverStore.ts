import { create } from 'zustand'
import type { Server, Channel } from '@aicord/shared'
import { api } from '../lib/api'

interface ServerState {
  servers: Server[]
  activeServerId: string | null
  channels: Record<string, Channel[]>   // keyed by serverId
  setServers: (servers: Server[]) => void
  setActiveServer: (id: string) => void
  addServer: (server: Server) => void
  removeServer: (id: string) => void
  setChannels: (serverId: string, channels: Channel[]) => void
  fetchChannels: (serverId: string) => Promise<void>
  fetchServers: () => Promise<void>
  createServer: (name: string) => Promise<Server>
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServerId: null,
  channels: {},

  setServers: (servers) => set({ servers }),
  setActiveServer: (id) => set({ activeServerId: id }),
  addServer: (server) => set((s) => ({ servers: [...s.servers, server] })),
  removeServer: (id) => set((s) => ({ servers: s.servers.filter((sv) => sv.id !== id) })),
  setChannels: (serverId, channels) => set((s) => ({ channels: { ...s.channels, [serverId]: channels } })),

  fetchServers: async () => {
    const res = await api.get<{ servers: Server[] }>('/servers')
    set({ servers: res.servers })
  },

  fetchChannels: async (serverId) => {
    const res = await api.get<{ channels: Channel[] }>(`/servers/${serverId}/channels`)
    set((s) => ({ channels: { ...s.channels, [serverId]: res.channels } }))
  },

  createServer: async (name) => {
    const res = await api.post<{ server: Server }>('/servers', { name })
    set((s) => ({ servers: [...s.servers, res.server] }))
    return res.server
  },
}))
