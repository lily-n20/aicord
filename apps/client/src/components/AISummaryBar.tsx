import { useState } from 'react'
import { useSummaryStore } from '../store/summaryStore'
import { api } from '../lib/api'

// Session-level dismissed set — cleared on page reload
const dismissedChannels = new Set<string>()

interface Props {
  channelId: string
  hasAgent: boolean
}

export function AISummaryBar({ channelId, hasAgent }: Props) {
  const { summaries, setSummary } = useSummaryStore()
  const [dismissed, setDismissed] = useState(() => dismissedChannels.has(channelId))
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const entry = summaries[channelId]

  if (!hasAgent || !entry || dismissed) return null

  const handleDismiss = () => {
    dismissedChannels.add(channelId)
    setDismissed(true)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await api.post<{ summary: string; message_count: number; generated_at: string }>(
        `/channels/${channelId}/ai/summarize`
      )
      setSummary(channelId, {
        summary: res.summary,
        messageCount: res.message_count,
        generatedAt: res.generated_at,
      })
    } catch {
      // Silently ignore — user can retry
    } finally {
      setRefreshing(false)
    }
  }

  const lines = entry.summary.split('\n').filter(Boolean)
  const preview = lines.slice(0, 3).join(' ')
  const isLong = lines.length > 3 || entry.summary.length > 240

  return (
    <div className="mx-4 mt-3 mb-1 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm flex-shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-brand font-semibold text-xs uppercase tracking-wider">✦ AI Summary</span>
            {entry.messageCount > 0 && (
              <span className="text-text-muted text-xs">
                {entry.messageCount} message{entry.messageCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-text-normal leading-relaxed">
            {expanded ? entry.summary : preview}
            {!expanded && isLong && (
              <>
                {'… '}
                <button
                  onClick={() => setExpanded(true)}
                  className="text-brand hover:underline text-xs"
                >
                  Read more
                </button>
              </>
            )}
            {expanded && isLong && (
              <>
                {' '}
                <button
                  onClick={() => setExpanded(false)}
                  className="text-brand hover:underline text-xs"
                >
                  Show less
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh summary"
            className="text-text-muted hover:text-brand disabled:opacity-50 transition-colors p-1 rounded"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? 'animate-spin' : ''}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <button
            onClick={handleDismiss}
            title="Dismiss"
            className="text-text-muted hover:text-text-normal transition-colors p-1 rounded"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
