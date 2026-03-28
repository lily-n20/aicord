import { create } from 'zustand'

export interface SummaryEntry {
  summary: string
  messageCount: number
  generatedAt: string
}

interface SummaryStore {
  summaries: Record<string, SummaryEntry>
  setSummary: (channelId: string, entry: SummaryEntry) => void
}

export const useSummaryStore = create<SummaryStore>((set) => ({
  summaries: {},
  setSummary: (channelId, entry) =>
    set((s) => ({ summaries: { ...s.summaries, [channelId]: entry } })),
}))
