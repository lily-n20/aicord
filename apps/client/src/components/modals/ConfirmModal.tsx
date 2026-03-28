import { useState } from 'react'
import { Modal } from './Modal'

interface ConfirmModalProps {
  title: string
  description: string
  confirmText: string
  matchText?: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

export function ConfirmModal({ title, description, confirmText, matchText, danger, onConfirm, onClose }: ConfirmModalProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const canConfirm = matchText ? input === matchText : true

  const handleConfirm = async () => {
    if (!canConfirm) return
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-text-muted text-sm mt-2 mb-4">{description}</p>
      {matchText && (
        <div className="mb-4">
          <p className="text-xs text-text-muted mb-1">
            Type <strong className="text-text-normal">{matchText}</strong> to confirm:
          </p>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-bg-primary border border-bg-modifier rounded px-3 py-2 text-text-normal text-sm focus:outline-none focus:border-danger"
          />
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-text-muted hover:text-text-normal bg-bg-modifier hover:bg-bg-modifier/80 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || loading}
          className={`px-4 py-2 text-sm font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            danger ? 'bg-danger hover:bg-danger/80 text-white' : 'bg-brand hover:bg-brand-hover text-white'
          }`}
        >
          {loading ? 'Working…' : confirmText}
        </button>
      </div>
    </Modal>
  )
}
