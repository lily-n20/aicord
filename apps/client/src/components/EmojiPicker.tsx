import { useState, useRef, useEffect } from 'react'

const COMMON_EMOJI = [
  '👍','👎','❤️','😂','😮','😢','😡','🎉','🔥','✅',
  '👀','🙏','💯','🚀','⭐','💪','🤔','😍','🥳','👏',
  '😅','🤣','😊','😎','🤯','💀','🫡','🙌','✨','💬',
  '📌','🔗','🎯','💡','🛠️','📝','🧵','💻','🤖','🦾',
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const filtered = search
    ? COMMON_EMOJI.filter((e) => e.includes(search))
    : COMMON_EMOJI

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 bg-bg-secondary border border-bg-modifier rounded-lg shadow-xl p-2 w-56"
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search emoji…"
        className="w-full bg-bg-primary text-text-normal text-xs px-2 py-1.5 rounded mb-2 focus:outline-none border border-bg-modifier"
        autoFocus
      />
      <div className="grid grid-cols-8 gap-0.5">
        {filtered.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose() }}
            className="w-7 h-7 flex items-center justify-center hover:bg-bg-modifier rounded text-lg transition-colors"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-8 text-text-muted text-xs text-center py-2">No results</p>
        )}
      </div>
    </div>
  )
}
