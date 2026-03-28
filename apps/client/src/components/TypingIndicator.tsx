import { useEffect } from 'react'
import { useTypingStore } from '../store/typingStore'
import { useAuthStore } from '../store/authStore'

export function TypingIndicator({ channelId }: { channelId: string }) {
  const typers = useTypingStore((s) => s.typers[channelId] ?? {})
  const clearExpired = useTypingStore((s) => s.clearExpired)
  const currentUserId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    const interval = setInterval(clearExpired, 1000)
    return () => clearInterval(interval)
  }, [clearExpired])

  const activeTypers = Object.keys(typers).filter((uid) => uid !== currentUserId)

  if (activeTypers.length === 0) return <div className="h-6" />

  let text: string
  if (activeTypers.length === 1) {
    text = 'Someone is typing…'
  } else if (activeTypers.length === 2) {
    text = 'Two people are typing…'
  } else {
    text = 'Several people are typing…'
  }

  return (
    <div className="px-4 h-6 flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="text-text-muted text-xs">{text}</span>
    </div>
  )
}
