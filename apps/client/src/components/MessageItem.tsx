import { MessageWithAuthor } from '../store/messageStore'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

export function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-4">
      <div className="flex-1 h-px bg-bg-modifier" />
      <span className="text-xs text-text-muted font-semibold">{formatDate(date)}</span>
      <div className="flex-1 h-px bg-bg-modifier" />
    </div>
  )
}

export function MessageItem({
  message,
  grouped,
}: {
  message: MessageWithAuthor
  grouped: boolean
}) {
  const isAI = message.authorType === 'ai'

  if (grouped) {
    return (
      <div className={`px-4 py-0.5 group hover:bg-white/[0.02] ${message.pending ? 'opacity-60' : ''} ${message.failed ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-2 ml-10">
          <p className={`text-text-normal text-sm leading-relaxed whitespace-pre-wrap break-words ${isAI ? 'bg-brand/10 px-3 py-2 rounded-lg text-text-normal' : ''}`}>
            {message.content}
            {message.editedAt && <span className="text-text-muted text-xs ml-1">(edited)</span>}
          </p>
          {message.failed && <span className="text-danger text-xs ml-2 self-center">Failed to send</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={`px-4 py-1 group hover:bg-white/[0.02] flex gap-3 ${message.pending ? 'opacity-60' : ''} ${message.failed ? 'opacity-40' : ''}`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${isAI ? 'bg-brand' : 'bg-bg-modifier'} text-white`}>
        {isAI ? 'AI' : (message.author?.username[0].toUpperCase() ?? '?')}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`font-semibold text-sm ${isAI ? 'text-brand' : 'text-text-normal'}`}>
            {isAI ? 'AICORD AI' : message.author?.username ?? 'Unknown'}
          </span>
          {isAI && (
            <span className="bg-brand/20 text-brand text-xs px-1.5 py-0.5 rounded font-semibold">AI</span>
          )}
          <span className="text-text-muted text-xs">{formatTime(message.createdAt)}</span>
        </div>
        <p className={`text-text-normal text-sm leading-relaxed whitespace-pre-wrap break-words ${isAI ? 'bg-brand/10 px-3 py-2 rounded-lg' : ''}`}>
          {message.content}
          {message.editedAt && <span className="text-text-muted text-xs ml-1">(edited)</span>}
        </p>
        {message.failed && <p className="text-danger text-xs mt-1">Failed to send — <button className="underline">retry</button></p>}
      </div>
    </div>
  )
}
