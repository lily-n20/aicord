# AICORD — Software Engineering Specification

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-03-28

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Data Models](#3-data-models)
4. [API Design](#4-api-design)
5. [WebSocket Protocol](#5-websocket-protocol)
6. [AI Subsystem](#6-ai-subsystem)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Frontend Specification](#8-frontend-specification)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Out of Scope (v1)](#11-out-of-scope-v1)

---

## 1. System Overview

AICORD is a real-time, multi-user messaging platform with AI agents as first-class participants. The system supports servers, channels, direct messages, and per-channel AI agents powered by a configurable LLM backend.

### 1.1 Core Capabilities

| Capability | Description |
|---|---|
| Multi-user auth | Registration, login, sessions, presence |
| Servers & channels | Persistent community spaces with typed channels |
| Real-time messaging | WebSocket-based low-latency chat |
| AI agents | Per-channel LLM agents with memory and configurable behavior |
| Summarization | On-demand and auto-triggered AI summaries |
| Roles & permissions | Granular access control per server and channel |

### 1.2 System Boundaries

```
[Client (Web/Mobile)] <--HTTPS/WSS--> [API Gateway]
                                            |
                        ┌───────────────────┼───────────────────┐
                        ▼                   ▼                   ▼
                 [Auth Service]     [Messaging Service]   [AI Service]
                        |                   |                   |
                   [User DB]         [Message DB]        [LLM Provider]
                                      [Redis PubSub]      [Vector Store]
```

---

## 2. Architecture

### 2.1 Style

**Service-oriented monorepo.** For v1, services are deployed as a single application with clear internal module boundaries. Services can be extracted into independent deployments in v2.

### 2.2 Services

#### Auth Service
- Handles registration, login, JWT issuance and refresh, session management
- Owns the `users` and `sessions` tables

#### Messaging Service
- Core business logic: servers, channels, messages, reactions, presence
- Publishes and subscribes to events via Redis Pub/Sub
- Owns `servers`, `channels`, `messages`, `memberships`, `reactions` tables

#### AI Service
- Manages AI agent configuration, message processing, and response generation
- Calls external LLM provider (Anthropic Claude by default)
- Maintains per-channel conversation context in a vector store
- Owns `ai_agents`, `ai_contexts` tables

### 2.3 Technology Stack

| Layer | Technology |
|---|---|
| Backend language | TypeScript (Node.js) |
| Web framework | Fastify |
| WebSocket | `ws` library via Fastify plugin |
| Database | PostgreSQL |
| Cache / PubSub | Redis |
| ORM | Drizzle ORM |
| AI provider | Anthropic Claude API (`claude-sonnet-4-6`) |
| Vector store | pgvector (PostgreSQL extension) |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| State management | Zustand |
| Deployment | Docker + Docker Compose (v1) |

---

## 3. Data Models

### 3.1 Users

```sql
users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    VARCHAR(32) UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url  TEXT,
  presence    ENUM('online', 'idle', 'offline', 'ai_assisted') DEFAULT 'offline',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
)
```

### 3.2 Servers

```sql
servers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  icon_url    TEXT,
  owner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

### 3.3 Server Memberships

```sql
memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID REFERENCES servers(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        ENUM('owner', 'admin', 'member', 'guest') DEFAULT 'member',
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(server_id, user_id)
)
```

### 3.4 Channels

```sql
channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID REFERENCES servers(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        ENUM('text', 'ai', 'digest') NOT NULL DEFAULT 'text',
  topic       TEXT,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(server_id, name)
)
```

### 3.5 Messages

```sql
messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  author_type ENUM('user', 'ai') NOT NULL DEFAULT 'user',
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

`metadata` stores structured data: AI citations, suggested links, summary flags, etc.

### 3.6 Reactions

```sql
reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(32) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
)
```

### 3.7 Direct Messages

```sql
dm_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT now()
)

dm_participants (
  dm_channel_id UUID REFERENCES dm_channels(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (dm_channel_id, user_id)
)
```

DM messages reuse the `messages` table with `channel_id` pointing to a DM channel (distinguished by a nullable `server_id`).

### 3.8 AI Agents

```sql
ai_agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID REFERENCES channels(id) ON DELETE CASCADE UNIQUE,
  persona       TEXT,                        -- system prompt / persona description
  model         VARCHAR(100) DEFAULT 'claude-sonnet-4-6',
  behavior      ENUM('passive', 'active') DEFAULT 'passive',
  trigger_count INTEGER DEFAULT 50,          -- messages before auto-summary in active mode
  permissions   ENUM('read_only', 'reply_only', 'full') DEFAULT 'reply_only',
  enabled       BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
)
```

### 3.9 AI Context (Vector Store)

```sql
ai_contexts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT now()
)

CREATE INDEX ON ai_contexts USING ivfflat (embedding vector_cosine_ops);
```

---

## 4. API Design

All endpoints are prefixed with `/api/v1`. Requests and responses use JSON. Authentication uses `Authorization: Bearer <jwt>`.

### 4.1 Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Login and receive JWT + refresh token |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Invalidate session |

**POST /auth/register**
```json
// Request
{ "username": "lily", "email": "lily@example.com", "password": "..." }

// Response 201
{ "user": { "id": "...", "username": "lily", "email": "lily@example.com" } }
```

### 4.2 Users

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me` | Get current user profile |
| `PATCH` | `/users/me` | Update profile (username, avatar) |
| `GET` | `/users/:id` | Get public user profile |
| `PATCH` | `/users/me/presence` | Update presence status |

### 4.3 Servers

| Method | Path | Description |
|---|---|---|
| `GET` | `/servers` | List servers current user belongs to |
| `POST` | `/servers` | Create a new server |
| `GET` | `/servers/:id` | Get server details |
| `PATCH` | `/servers/:id` | Update server (admin+) |
| `DELETE` | `/servers/:id` | Delete server (owner only) |
| `POST` | `/servers/:id/join` | Join a server |
| `DELETE` | `/servers/:id/leave` | Leave a server |
| `GET` | `/servers/:id/members` | List members |
| `PATCH` | `/servers/:id/members/:userId` | Update member role (admin+) |

### 4.4 Channels

| Method | Path | Description |
|---|---|---|
| `GET` | `/servers/:id/channels` | List channels in server |
| `POST` | `/servers/:id/channels` | Create channel (admin+) |
| `PATCH` | `/channels/:id` | Update channel (admin+) |
| `DELETE` | `/channels/:id` | Delete channel (admin+) |

### 4.5 Messages

| Method | Path | Description |
|---|---|---|
| `GET` | `/channels/:id/messages` | Paginated message history (cursor-based) |
| `POST` | `/channels/:id/messages` | Send a message |
| `PATCH` | `/messages/:id` | Edit a message (author only) |
| `DELETE` | `/messages/:id` | Delete a message (author or admin) |
| `POST` | `/messages/:id/reactions` | Add reaction |
| `DELETE` | `/messages/:id/reactions/:emoji` | Remove reaction |

**GET /channels/:id/messages** query params: `before` (cursor), `limit` (default 50, max 100)

### 4.6 Direct Messages

| Method | Path | Description |
|---|---|---|
| `GET` | `/dms` | List DM conversations |
| `POST` | `/dms` | Open or get DM with a user `{ userId }` |
| `GET` | `/dms/:id/messages` | Paginated DM message history |
| `POST` | `/dms/:id/messages` | Send DM |

### 4.7 AI

| Method | Path | Description |
|---|---|---|
| `GET` | `/channels/:id/ai` | Get agent config for channel |
| `PUT` | `/channels/:id/ai` | Create or update agent config (admin+) |
| `POST` | `/channels/:id/ai/summarize` | Request an on-demand summary |

**POST /channels/:id/ai/summarize** response:
```json
{
  "summary": "12 messages since yesterday. Main themes: onboarding friction, mobile bugs, two feature requests.",
  "message_count": 12,
  "generated_at": "2026-03-28T10:00:00Z"
}
```

---

## 5. WebSocket Protocol

### 5.1 Connection

```
wss://api.aicord.app/ws?token=<jwt>
```

On connect, the server authenticates the token and sends a `READY` event.

### 5.2 Event Envelope

```json
{
  "op": "EVENT_NAME",
  "d": { ...payload },
  "t": 1743160000000
}
```

### 5.3 Client → Server Events

| Op | Payload | Description |
|---|---|---|
| `SUBSCRIBE` | `{ channelId }` | Subscribe to channel events |
| `UNSUBSCRIBE` | `{ channelId }` | Unsubscribe from channel |
| `TYPING_START` | `{ channelId }` | Broadcast typing indicator |
| `PRESENCE_UPDATE` | `{ presence }` | Update own presence |
| `HEARTBEAT` | `{}` | Keep-alive ping (every 30s) |

### 5.4 Server → Client Events

| Op | Payload | Description |
|---|---|---|
| `READY` | `{ user, servers[] }` | Initial state on connect |
| `MESSAGE_CREATE` | `{ message }` | New message in subscribed channel |
| `MESSAGE_UPDATE` | `{ message }` | Message edited |
| `MESSAGE_DELETE` | `{ messageId, channelId }` | Message deleted |
| `REACTION_ADD` | `{ reaction }` | Reaction added |
| `REACTION_REMOVE` | `{ reactionId }` | Reaction removed |
| `TYPING_START` | `{ userId, channelId }` | User is typing |
| `PRESENCE_UPDATE` | `{ userId, presence }` | User presence changed |
| `AI_RESPONSE` | `{ message }` | AI agent reply (streamed as `MESSAGE_CREATE`) |
| `AI_SUMMARY` | `{ channelId, summary }` | AI summary ready |
| `HEARTBEAT_ACK` | `{}` | Response to client heartbeat |

### 5.5 AI Streaming

AI responses are streamed token-by-token using a sequence of `MESSAGE_CREATE` events with `metadata.streaming: true`, followed by a final event with `metadata.streaming: false` and the complete content. The client renders incrementally.

---

## 6. AI Subsystem

### 6.1 Agent Lifecycle

1. When a message is created in an AI-enabled channel, the Messaging Service emits a `message.created` internal event.
2. The AI Service receives the event and checks:
   - Is an AI agent enabled for this channel?
   - Does the message contain an `@ai` mention (reply_only/full mode), OR is the agent in `active` mode and the trigger count reached?
3. If yes, the AI Service builds a prompt context and calls the LLM provider.
4. The response is saved as a `messages` row with `author_type = 'ai'` and broadcast via WebSocket.

### 6.2 Context Building

For each AI invocation, the system builds a context window:

1. **System prompt**: agent's configured persona
2. **Recent messages**: last N messages from the channel (N = min(50, token budget))
3. **Semantic search**: top-K similar past messages retrieved via pgvector cosine similarity on the incoming message embedding
4. **User message**: the triggering message

```
system: {persona}

[Retrieved context]
---
{top_k_similar_messages}
---

[Recent conversation]
{last_n_messages}

user: {triggering_message}
```

### 6.3 Summarization

On-demand (`POST /channels/:id/ai/summarize`) and auto-triggered summarization:

1. Fetch messages since last summary (or last 50, whichever is fewer)
2. Pass to LLM with a summarization prompt
3. Return summary as API response and optionally post as a pinned AI message

### 6.4 @ai Mention Parsing

Messages are scanned for `@ai` (case-insensitive) at message creation. If found and agent permissions allow replies, the AI Service is invoked regardless of agent behavior mode.

### 6.5 LLM Provider Interface

The AI Service uses an adapter pattern. The default adapter targets the Anthropic Claude API:

```typescript
interface LLMAdapter {
  complete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<string>
}

interface CompletionOptions {
  model: string
  maxTokens: number
  systemPrompt: string
}
```

This interface allows swapping providers (OpenAI, local models) without changing business logic.

---

## 7. Authentication & Authorization

### 7.1 Auth Flow

- Registration: hash password with `bcrypt` (cost factor 12), store in DB, return JWT
- Login: verify password hash, issue signed JWT (15min expiry) + refresh token (7 days, stored in DB)
- Refresh: validate refresh token, issue new JWT
- Logout: delete refresh token from DB

### 7.2 JWT Payload

```json
{
  "sub": "<user_id>",
  "username": "lily",
  "iat": 1743160000,
  "exp": 1743160900
}
```

### 7.3 Permission Model

Permissions are checked in order: server role → channel overrides.

| Action | Guest | Member | Admin | Owner |
|---|---|---|---|---|
| Read messages | ✓ | ✓ | ✓ | ✓ |
| Send messages | ✓ | ✓ | ✓ | ✓ |
| Edit own messages | ✓ | ✓ | ✓ | ✓ |
| Delete any message | | | ✓ | ✓ |
| Manage channels | | | ✓ | ✓ |
| Configure AI agent | | | ✓ | ✓ |
| Manage members/roles | | | ✓ | ✓ |
| Delete server | | | | ✓ |

### 7.4 AI Agent Permissions

| Mode | Can read | Can reply | Can post unprompted |
|---|---|---|---|
| `read_only` | ✓ | | |
| `reply_only` | ✓ | ✓ (on @ai mention) | |
| `full` | ✓ | ✓ | ✓ (on trigger) |

---

## 8. Frontend Specification

### 8.1 Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `LandingPage` | Marketing / sign-in entry |
| `/login` | `LoginPage` | Login form |
| `/register` | `RegisterPage` | Registration form |
| `/app` | `AppShell` | Authenticated app root |
| `/app/channels/:serverId/:channelId` | `ChannelView` | Main chat view |
| `/app/dms/:dmId` | `DMView` | Direct message view |

### 8.2 Component Hierarchy

```
AppShell
├── ServerSidebar          # server icons list
├── ChannelSidebar         # channels + members for active server
└── MainContent
    ├── ChannelHeader      # channel name, topic, AI status badge
    ├── MessageList        # virtualized message feed
    │   ├── Message        # individual message bubble
    │   │   ├── AuthorTag  # user or AI badge
    │   │   ├── Content    # markdown renderer
    │   │   └── Reactions  # emoji reaction row
    │   └── AIMessage      # AI message with streaming support
    ├── AISummaryBar       # dismissable summary digest at top
    ├── TypingIndicator    # "X is typing..."
    └── MessageInput
        ├── RichTextEditor # markdown-aware input
        └── AISuggestion   # inline AI draft suggestion (ghost text)
```

### 8.3 State Management

Global state via Zustand stores:

- `authStore` — current user, JWT
- `serverStore` — servers list, active server
- `channelStore` — channels for active server, active channel
- `messageStore` — messages per channel (keyed by channelId), optimistic updates
- `presenceStore` — online status map `{ userId: presence }`
- `wsStore` — WebSocket connection state, event dispatch

### 8.4 WebSocket Client

- Singleton `WSClient` initialized on login
- Reconnects with exponential backoff (max 30s)
- Dispatches incoming events to Zustand stores
- Sends `HEARTBEAT` every 30 seconds

### 8.5 AI UX Behaviors

- **Streaming**: AI messages render token-by-token with a blinking cursor
- **AI badge**: AI messages show a distinct visual badge (e.g., "AI" chip next to the author name)
- **Summary bar**: Appears at channel top when a digest is available; dismissable per session
- **Inline suggestion**: Ghost text below the message input when the AI has a suggestion; press `Tab` to accept

---

## 9. Infrastructure & Deployment

### 9.1 v1 Deployment (Docker Compose)

```yaml
services:
  api:       # Node.js app (Auth + Messaging + AI services)
  postgres:  # PostgreSQL with pgvector extension
  redis:     # Redis for Pub/Sub and session caching
  client:    # React app served via Nginx
```

### 9.2 Environment Variables

```
# App
NODE_ENV=production
PORT=3000
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/aicord

# Redis
REDIS_URL=redis://redis:6379

# AI
ANTHROPIC_API_KEY=<key>
AI_DEFAULT_MODEL=claude-sonnet-4-6
AI_MAX_TOKENS=1024
```

### 9.3 Database Migrations

Migrations managed by Drizzle Kit. All schema changes go through versioned migration files. No manual SQL in production.

---

## 10. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Message delivery latency | < 200ms p99 (same region) |
| API response time | < 150ms p95 (non-AI endpoints) |
| AI first-token latency | < 2s p90 |
| WebSocket connections | 10,000 concurrent (v1) |
| Message history | Retained indefinitely (soft delete) |
| Uptime | 99.5% (v1) |
| Auth token security | Passwords hashed with bcrypt cost 12; JWTs RS256 signed |
| Input validation | All inputs validated and sanitized server-side before persistence |
| SQL injection | Parameterized queries enforced via ORM; no raw string interpolation |
| XSS | All user content escaped on render; markdown rendered in sandboxed context |

---

## 11. Out of Scope (v1)

The following are noted from the vision but deferred to v2:

- **Voice channels** with live AI transcription
- **Mobile native apps** (iOS / Android)
- **Custom AI model bring-your-own** (v1 is Anthropic only)
- **Server discovery / public server directory**
- **Message threads / nested replies**
- **File and image uploads** (links only in v1)
- **End-to-end encryption** for DMs
- **Webhooks and external integrations API**
