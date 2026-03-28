import { create } from 'zustand'
import { api } from '../lib/api'

export interface MessageWithAuthor {
  id: string
  channelId: string
  authorId: string | null
  authorType: 'user' | 'ai'
  content: string
  metadata: Record<string, unknown>
  editedAt: string | null
  createdAt: string
  author: { username: string; avatarUrl: string | null } | null
  // optimistic state
  pending?: boolean
  failed?: boolean
}

interface MessageState {
  messagesByChannel: Record<string, MessageWithAuthor[]>
  cursors: Record<string, string | null>     // nextCursor per channel
  hasMore: Record<string, boolean>

  setMessages: (channelId: string, messages: MessageWithAuthor[], nextCursor: string | null) => void
  prependMessages: (channelId: string, messages: MessageWithAuthor[], nextCursor: string | null) => void
  appendMessage: (msg: MessageWithAuthor) => void
  updateMessage: (msg: MessageWithAuthor) => void
  removeMessage: (channelId: string, messageId: string) => void
  replaceOptimistic: (channelId: string, tempId: string, real: MessageWithAuthor) => void
  markFailed: (channelId: string, tempId: string) => void

  fetchMessages: (channelId: string) => Promise<void>
  fetchMore: (channelId: string) => Promise<void>
  sendMessage: (channelId: string, content: string, userId: string, username: string) => Promise<void>
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByChannel: {},
  cursors: {},
  hasMore: {},

  setMessages: (channelId, messages, nextCursor) =>
    set((s) => ({
      messagesByChannel: { ...s.messagesByChannel, [channelId]: messages },
      cursors: { ...s.cursors, [channelId]: nextCursor },
      hasMore: { ...s.hasMore, [channelId]: nextCursor !== null },
    })),

  prependMessages: (channelId, messages, nextCursor) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...messages, ...(s.messagesByChannel[channelId] ?? [])],
      },
      cursors: { ...s.cursors, [channelId]: nextCursor },
      hasMore: { ...s.hasMore, [channelId]: nextCursor !== null },
    })),

  appendMessage: (msg) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [msg.channelId]: [...(s.messagesByChannel[msg.channelId] ?? []), msg],
      },
    })),

  updateMessage: (msg) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [msg.channelId]: (s.messagesByChannel[msg.channelId] ?? []).map((m) =>
          m.id === msg.id ? msg : m
        ),
      },
    })),

  removeMessage: (channelId, messageId) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
          m.id === messageId ? { ...m, content: '[deleted]', authorId: null } : m
        ),
      },
    })),

  replaceOptimistic: (channelId, tempId, real) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
          m.id === tempId ? real : m
        ),
      },
    })),

  markFailed: (channelId, tempId) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
          m.id === tempId ? { ...m, failed: true, pending: false } : m
        ),
      },
    })),

  fetchMessages: async (channelId) => {
    const res = await api.get<{ messages: MessageWithAuthor[]; nextCursor: string | null }>(
      `/channels/${channelId}/messages`
    )
    get().setMessages(channelId, res.messages, res.nextCursor)
  },

  fetchMore: async (channelId) => {
    const cursor = get().cursors[channelId]
    if (!cursor) return
    const res = await api.get<{ messages: MessageWithAuthor[]; nextCursor: string | null }>(
      `/channels/${channelId}/messages?before=${cursor}`
    )
    get().prependMessages(channelId, res.messages, res.nextCursor)
  },

  sendMessage: async (channelId, content, userId, username) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const optimistic: MessageWithAuthor = {
      id: tempId,
      channelId,
      authorId: userId,
      authorType: 'user',
      content,
      metadata: {},
      editedAt: null,
      createdAt: new Date().toISOString(),
      author: { username, avatarUrl: null },
      pending: true,
    }
    get().appendMessage(optimistic)

    try {
      const res = await api.post<{ message: MessageWithAuthor }>(`/channels/${channelId}/messages`, { content })
      get().replaceOptimistic(channelId, tempId, res.message)
    } catch {
      get().markFailed(channelId, tempId)
    }
  },
}))
