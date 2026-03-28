import type { Channel } from '@aicord/shared'

export function ChannelHeader({ channel }: { channel: Channel }) {
  const channelIcon: Record<string, string> = { text: '#', ai: '✦', digest: '📋' }
  return (
    <div className="h-12 flex items-center px-4 border-b border-black/30 shadow-sm gap-2 flex-shrink-0">
      <span className="text-text-muted font-bold text-lg">{channelIcon[channel.type] ?? '#'}</span>
      <span className="font-semibold text-text-normal">{channel.name}</span>
      {channel.topic && (
        <>
          <div className="w-px h-5 bg-bg-modifier mx-1" />
          <span className="text-text-muted text-sm truncate">{channel.topic}</span>
        </>
      )}
    </div>
  )
}
