import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useServerStore } from '../store/serverStore'
import { useWSEvents } from '../hooks/useWSEvents'
import { useWSStore } from '../store/wsStore'
import { ServerSidebar } from '../components/ServerSidebar'
import { ChannelSidebar } from '../components/ChannelSidebar'
import { ChannelView } from './ChannelView'

function NoChannelSelected() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg-tertiary">
      <div className="text-center">
        <p className="text-5xl mb-4">✦</p>
        <p className="text-text-normal font-bold text-xl mb-2">No channel selected</p>
        <p className="text-text-muted text-sm">Select a channel from the sidebar to get started.</p>
      </div>
    </div>
  )
}

function NoServerSelected() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg-tertiary">
      <div className="text-center">
        <p className="text-5xl mb-4">🌐</p>
        <p className="text-text-normal font-bold text-xl mb-2">Welcome to AICORD</p>
        <p className="text-text-muted text-sm">Select or create a server to get started.</p>
      </div>
    </div>
  )
}

export function AppShell() {
  const { user } = useAuthStore()
  const { fetchServers } = useServerStore()
  const { reconnecting } = useWSStore()
  useWSEvents()

  useEffect(() => {
    fetchServers()
  }, [])

  if (!user) return null

  return (
    <div className="h-full flex bg-bg-primary">
      {reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-black text-xs text-center py-1 font-semibold">
          Reconnecting…
        </div>
      )}

      <ServerSidebar />

      <Routes>
        <Route path="/" element={<NoServerSelected />} />
        <Route
          path="/servers/:serverId"
          element={
            <div className="flex flex-1 min-w-0">
              <ChannelSidebar />
              <NoChannelSelected />
            </div>
          }
        />
        <Route
          path="/servers/:serverId/channels/:channelId"
          element={
            <div className="flex flex-1 min-w-0">
              <ChannelSidebar />
              <ChannelView />
            </div>
          }
        />
      </Routes>
    </div>
  )
}
