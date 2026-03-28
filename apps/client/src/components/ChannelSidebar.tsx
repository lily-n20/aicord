import { useState } from 'react'
import { useNavigate, useParams, NavLink } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import { useAuthStore } from '../store/authStore'
import { useChannelStore } from '../store/channelStore'
import { api } from '../lib/api'
import { CreateChannelModal } from './modals/CreateChannelModal'
import { ConfirmModal } from './modals/ConfirmModal'
import type { Channel } from '@aicord/shared'

const channelIcon: Record<string, string> = {
  text: '#',
  ai: '✦',
  digest: '📋',
}

export function ChannelSidebar() {
  const { serverId } = useParams<{ serverId: string }>()
  const { servers, channels, fetchChannels } = useServerStore()
  const { setActiveChannel, activeChannelId } = useChannelStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null)

  const server = servers.find((s) => s.id === serverId)
  const serverChannels: Channel[] = serverId ? (channels[serverId] ?? []) : []

  // Admins are determined by checking if the current user is the server owner
  const isAdmin = server ? server.ownerId === user?.id : false

  const handleChannelClick = (channelId: string) => {
    setActiveChannel(channelId)
    navigate(`/app/servers/${serverId}/channels/${channelId}`)
  }

  const handleDeleteChannel = async (ch: Channel) => {
    await api.delete(`/channels/${ch.id}`)
    if (serverId) await fetchChannels(serverId)
  }

  return (
    <div className="w-60 bg-bg-secondary flex flex-col flex-shrink-0">
      {/* Server header */}
      <div className="h-12 flex items-center px-4 border-b border-black/30 shadow-sm font-semibold text-text-normal hover:bg-bg-modifier transition-colors cursor-pointer">
        {server?.name ?? 'AICORD'}
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Direct Messages section */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Direct Messages</span>
          </div>
          <NavLink
            to="/app/dms"
            className={({ isActive }) =>
              `w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-bg-modifier text-text-normal'
                  : 'text-text-muted hover:bg-bg-modifier/60 hover:text-text-normal'
              }`
            }
          >
            <span className="text-text-muted text-base w-4 text-center flex-shrink-0">@</span>
            <span className="truncate">Messages</span>
          </NavLink>
        </div>

        {/* Server channels section */}
        {serverId && (
          <>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Channels</span>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="text-text-muted hover:text-text-normal transition-colors text-lg leading-none"
                title="Create channel"
              >
                +
              </button>
            </div>

            {serverChannels.map((ch) => (
              <div key={ch.id} className="group/ch flex items-center">
                <button
                  onClick={() => handleChannelClick(ch.id)}
                  className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors ${
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
                {isAdmin && (
                  <button
                    onClick={() => setChannelToDelete(ch)}
                    className="opacity-0 group-hover/ch:opacity-100 p-1 mr-1 text-text-muted hover:text-danger transition-colors rounded text-xs"
                    title="Delete channel"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}

            {serverChannels.length === 0 && (
              <p className="text-text-muted text-xs px-2 mt-2">No channels yet. Create one above.</p>
            )}
          </>
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

      {/* Modals */}
      {showCreateChannel && serverId && (
        <CreateChannelModal
          serverId={serverId}
          onClose={() => setShowCreateChannel(false)}
        />
      )}

      {channelToDelete && serverId && (
        <ConfirmModal
          title="Delete Channel"
          description={`Are you sure you want to delete #${channelToDelete.name}? All messages will be permanently lost.`}
          confirmText="Delete Channel"
          matchText={channelToDelete.name}
          danger
          onConfirm={() => handleDeleteChannel(channelToDelete)}
          onClose={() => setChannelToDelete(null)}
        />
      )}
    </div>
  )
}
