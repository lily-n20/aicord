// User types
export type Presence = 'online' | 'idle' | 'offline' | 'ai_assisted'
export type UserRole = 'owner' | 'admin' | 'member' | 'guest'

export interface User {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  presence: Presence
  createdAt: string
}

export interface PublicUser {
  id: string
  username: string
  avatarUrl: string | null
  presence: Presence
}

// Server types
export interface Server {
  id: string
  name: string
  slug: string
  iconUrl: string | null
  ownerId: string
  createdAt: string
}

// Channel types
export type ChannelType = 'text' | 'ai' | 'digest'

export interface Channel {
  id: string
  serverId: string
  name: string
  type: ChannelType
  topic: string | null
  position: number
  createdAt: string
}

// Message types
export type AuthorType = 'user' | 'ai'

export interface Message {
  id: string
  channelId: string
  authorId: string | null
  authorType: AuthorType
  content: string
  metadata: Record<string, unknown>
  editedAt: string | null
  createdAt: string
}

// Membership
export interface Membership {
  id: string
  serverId: string
  userId: string
  role: UserRole
  joinedAt: string
}

// WebSocket event types
export type WSEventOp =
  | 'READY'
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | 'TYPING_START'
  | 'PRESENCE_UPDATE'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'MESSAGE_CREATE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE'
  | 'REACTION_ADD'
  | 'REACTION_REMOVE'
  | 'AI_RESPONSE'
  | 'AI_SUMMARY'

export interface WSEvent<T = unknown> {
  op: WSEventOp
  d: T
  t: number
}

export interface ReadyPayload {
  user: User
  servers: Server[]
}

// API response types
export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

// Auth types
export interface AuthResponse {
  user: User
  accessToken: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}
