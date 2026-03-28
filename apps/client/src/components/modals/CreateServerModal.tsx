import { useState, FormEvent } from 'react'
import { Modal } from './Modal'
import { useServerStore } from '../../store/serverStore'

interface CreateServerModalProps {
  onClose: () => void
  onCreated: (serverId: string) => void
}

export function CreateServerModal({ onClose, onCreated }: CreateServerModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { createServer } = useServerStore()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const server = await createServer(name.trim())
      onCreated(server.id)
      onClose()
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } }
      setError(apiErr?.error?.message ?? 'Failed to create server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Create a Server" onClose={onClose}>
      <p className="text-text-muted text-sm mt-2 mb-4">
        Give your server a name. You can always change it later.
      </p>
      {error && <p className="text-danger text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            Server Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={100}
            placeholder="My Awesome Server"
            className="w-full bg-bg-primary border border-bg-modifier rounded px-3 py-2.5 text-text-normal placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
          />
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
            {loading ? 'Creating…' : 'Create Server'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
