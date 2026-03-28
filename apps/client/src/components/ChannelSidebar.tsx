import { useNavigate, useParams } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import { useAuthStore } from '../store/authStore'
import { useChannelStore } from '../store/channelStore'
import { api } from '../lib/api'
import type { Channel } from '@aicord/shared'

const channelIcon: Record<string, string> = {
  text: '#',
  ai: '✦',
  digest: '📋',
}

export function ChannelSidebar() {
  const { serverId } = useParams<{ serverId: string }>()
  const { servers, channels, fetchChannels } = useServerStore()
  const { setActiveChannel } = useChannelStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const server = servers.find((s) => s.id === serverId)
  const serverChannels: Channel[] = serverId ? (channels[serverId] ?? []) : []

  const handleChannelClick = (channelId: string) => {
    setActiveChannel(channelId)
    navigate(`/app/servers/${serverId}/channels/${channelId}`)
  }

  const handleCreateChannel = async () => {
    if (!serverId) return
    const name = window.prompt('Channel name (lowercase, hyphens only):')
    if (!name?.trim()) return
    await api.post(`/servers/${serverId}/channels`, { name: name.trim().toLowerCase().replace(/\s+/g, '-') })
    await fetchChannels(serverId)
  }

  const { activeChannelId } = useChannelStore()

  return (
    <div className="w-60 bg-bg-secondary flex flex-col flex-shrink-0">
      {/* Server header */}
      <div className="h-12 flex items-center px-4 border-b border-black/30 shadow-sm font-semibold text-text-normal hover:bg-bg-modifier transition-colors cursor-pointer">
        {server?.name ?? 'AICORD'}
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Channels</span>
          <button
            onClick={handleCreateChannel}
            className="text-text-muted hover:text-text-normal transition-colors text-lg leading-none"
            title="Create channel"
          >
            +
          </button>
        </div>

        {serverChannels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => handleChannelClick(ch.id)}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors ${
              ch.id === activeChannelId
                ? 'bg-bg-modifier text-text-normal'
                : 'text-text-muted hover:bg-bg-modifier/60 hover:text-text-normal'
            }`}
          >
            <span className="text-text-muted text-base w-4 text-center flex-shrink-0">
              {channelIcon[ch.type] ?? '#'}
            </span>
            <span className="truncate">{ch.name}</span>
          </button>
        ))}

        {serverChannels.length === 0 && (
          <p className="text-text-muted text-xs px-2 mt-2">No channels yet. Create one above.</p>
        )}
      </div>

      {/* User bar */}
      <div className="h-14 bg-bg-primary flex items-center px-2 gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {user?.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-normal text-sm font-medium truncate">{user?.username}</p>
          <p className="text-text-muted text-xs">Online</p>
        </div>
        <button
          onClick={logout}
          className="text-text-muted hover:text-text-normal transition-colors p-1 rounded"
          title="Sign out"
        >
          ⏻
        </button>
      </div>
    </div>
  )
}
