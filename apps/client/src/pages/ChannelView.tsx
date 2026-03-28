import { useParams } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import { ChannelHeader } from '../components/ChannelHeader'
import { MessageList } from '../components/MessageList'
import { MessageInput } from '../components/MessageInput'

export function ChannelView() {
  const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>()
  const channels = useServerStore((s) => s.channels)
  const serverChannels = serverId ? (channels[serverId] ?? []) : []
  const channel = serverChannels.find((c) => c.id === channelId)

  if (!channel || !channelId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-tertiary">
        <p className="text-text-muted">Channel not found</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-tertiary min-w-0 h-full">
      <ChannelHeader channel={channel} />
      <MessageList channelId={channelId} />
      <MessageInput channelId={channelId} channelName={channel.name} />
    </div>
  )
}
