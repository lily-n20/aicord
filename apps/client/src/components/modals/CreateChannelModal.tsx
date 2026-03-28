import { useState, FormEvent } from 'react'
import { Modal } from './Modal'
import { api } from '../../lib/api'
import { useServerStore } from '../../store/serverStore'
import type { Channel } from '@aicord/shared'

interface CreateChannelModalProps {
  serverId: string
  onClose: () => void
}

type ChannelType = 'text' | 'ai' | 'digest'

const channelTypes: { value: ChannelType; label: string; icon: string; desc: string }[] = [
  { value: 'text', icon: '#', label: 'Text', desc: 'Standard real-time messaging' },
  { value: 'ai', icon: '✦', label: 'AI', desc: 'AI agent always present' },
  { value: 'digest', icon: '📋', label: 'Digest', desc: 'Auto-curated AI summaries' },
]

export function CreateChannelModal({ serverId, onClose }: CreateChannelModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ChannelType>('text')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { fetchChannels } = useServerStore()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await api.post<{ channel: Channel }>(`/servers/${serverId}/channels`, {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type,
      })
      await fetchChannels(serverId)
      onClose()
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } }
      setError(apiErr?.error?.message ?? 'Failed to create channel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Create Channel" onClose={onClose}>
      {error && <p className="text-danger text-sm mt-2 mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Channel Type
          </label>
          <div className="space-y-2">
            {channelTypes.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => setType(ct.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors text-left ${
                  type === ct.value ? 'border-brand bg-brand/10 text-text-normal' : 'border-bg-modifier bg-bg-primary text-text-muted hover:bg-bg-modifier/50'
                }`}
              >
                <span className="text-lg w-6 text-center">{ct.icon}</span>
                <div>
                  <p className="text-sm font-medium">{ct.label}</p>
                  <p className="text-xs opacity-70">{ct.desc}</p>
                </div>
                {type === ct.value && <span className="ml-auto text-brand">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            Channel Name
          </label>
          <div className="flex items-center gap-2 bg-bg-primary border border-bg-modifier rounded px-3 py-2.5 focus-within:border-brand transition-colors">
            <span className="text-text-muted">#</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              autoFocus
              maxLength={100}
              placeholder="new-channel"
              className="flex-1 bg-transparent text-text-normal placeholder-text-muted focus:outline-none text-sm"
            />
          </div>
          <p className="text-text-muted text-xs mt-1">Lowercase letters, numbers, and hyphens only</p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-normal bg-bg-modifier rounded transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="px-4 py-2 text-sm font-semibold bg-brand hover:bg-brand-hover text-white rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Channel'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
