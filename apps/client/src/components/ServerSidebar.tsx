import { useNavigate } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import type { Server } from '@aicord/shared'

function ServerIcon({ server, active, onClick }: { server: Server; active: boolean; onClick: () => void }) {
  const initials = server.name.slice(0, 2).toUpperCase()
  return (
    <button
      onClick={onClick}
      title={server.name}
      className={`relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 group
        ${active ? 'bg-brand text-white rounded-2xl' : 'bg-bg-secondary text-text-muted hover:bg-brand hover:text-white hover:rounded-2xl'}`}
    >
      {server.iconUrl ? (
        <img src={server.iconUrl} alt={server.name} className="w-full h-full rounded-[inherit] object-cover" />
      ) : (
        initials
      )}
      <span className="absolute left-full ml-3 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">
        {server.name}
      </span>
    </button>
  )
}

export function ServerSidebar() {
  const { servers, activeServerId, setActiveServer, fetchChannels } = useServerStore()
  const navigate = useNavigate()

  const handleSelectServer = async (serverId: string) => {
    setActiveServer(serverId)
    await fetchChannels(serverId)
    navigate(`/app/servers/${serverId}`)
  }

  return (
    <div className="w-[72px] bg-bg-primary flex flex-col items-center py-3 gap-2 flex-shrink-0 overflow-y-auto">
      {/* Home button */}
      <button
        onClick={() => navigate('/app')}
        className="w-12 h-12 bg-bg-secondary hover:bg-brand text-text-muted hover:text-white rounded-full hover:rounded-2xl flex items-center justify-center transition-all duration-200 font-bold text-lg"
        title="Home"
      >
        AC
      </button>

      <div className="w-8 h-px bg-bg-modifier my-1" />

      {servers.map((server) => (
        <ServerIcon
          key={server.id}
          server={server}
          active={server.id === activeServerId}
          onClick={() => handleSelectServer(server.id)}
        />
      ))}

      {/* Add server */}
      <button
        className="w-12 h-12 bg-bg-secondary hover:bg-success text-success hover:text-white rounded-full hover:rounded-2xl flex items-center justify-center transition-all duration-200 text-2xl font-light mt-1"
        title="Add a Server"
        onClick={() => {
          const name = window.prompt('Server name:')
          if (name?.trim()) {
            useServerStore.getState().createServer(name.trim()).then((s) => handleSelectServer(s.id))
          }
        }}
      >
        +
      </button>
    </div>
  )
}
