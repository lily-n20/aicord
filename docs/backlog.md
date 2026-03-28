# AICORD — Epics, User Stories & Sprint Backlog

**Version:** 1.0
**Team Size:** 5–8 Senior Engineers
**Sprint Duration:** 2 weeks
**Velocity Assumption:** ~60–80 story points per sprint (senior team)
**Total Sprints:** 6 (12 weeks to v1 launch)

> Story point scale: 1 (trivial) · 2 (small) · 3 (medium) · 5 (large) · 8 (complex) · 13 (spike/unknown — must be broken down before dev starts)

---

## Team Structure

| Role | Count | Focus |
|---|---|---|
| Tech Lead / Architect | 1 | Cross-cutting concerns, architecture decisions, unblocking |
| Backend Engineers | 2–3 | Auth, Messaging, AI services, API, WebSocket |
| Frontend Engineers | 2 | React app, Zustand stores, WebSocket client, AI UX |
| Full-stack / DevOps | 1 | Infrastructure, CI/CD, migrations, deployment |
| AI/Integration Engineer | 1 | AI subsystem, LLM adapter, vector store, context pipeline |

---

## Epics

| ID | Epic | Description |
|---|---|---|
| E1 | Foundation & Infrastructure | Repo setup, CI/CD, Docker Compose, DB migrations, shared types |
| E2 | Authentication & User Management | Registration, login, JWT, sessions, presence, profiles |
| E3 | Servers & Channels | CRUD for servers and channels, memberships, roles, permissions |
| E4 | Real-Time Messaging | WebSocket server, message CRUD, reactions, typing indicators |
| E5 | Direct Messages | DM channel creation, messaging, real-time updates |
| E6 | AI Agent Core | Agent config, @ai mention handling, LLM adapter, streaming |
| E7 | AI Context & Memory | pgvector embeddings, semantic search, context window builder |
| E8 | AI Summarization | On-demand and auto-triggered summarization, digest channels |
| E9 | Frontend Shell & Navigation | AppShell, routing, server/channel sidebars, auth pages |
| E10 | Frontend Messaging UI | MessageList, MessageInput, reactions, markdown, optimistic UI |
| E11 | Frontend AI UX | Streaming AI messages, AI badge, summary bar, inline suggestions |
| E12 | Hardening & Launch Readiness | NFRs, security audit, load testing, observability, final QA |

---

## User Stories

---

### E1 — Foundation & Infrastructure

---

**US-101** · Monorepo scaffold
> As a developer, I want a monorepo with `apps/api` and `apps/client` packages so the team can work independently on backend and frontend with shared TypeScript types.

**Acceptance Criteria:**
- [ ] Monorepo uses a workspace tool (npm workspaces or pnpm)
- [ ] `packages/shared` exports common types (User, Message, Channel, etc.)
- [ ] `apps/api` runs with `npm run dev` and hot-reloads
- [ ] `apps/client` runs with `npm run dev` via Vite
- [ ] Shared types imported cleanly in both apps with no type errors

**Points:** 3

---

**US-102** · Docker Compose dev environment
> As a developer, I want a single `docker-compose up` command to spin up Postgres (with pgvector), Redis, the API, and the client so that local dev is zero-config.

**Acceptance Criteria:**
- [ ] `docker-compose up` starts all 4 services
- [ ] Postgres has pgvector extension enabled on first run
- [ ] Redis is reachable by the API
- [ ] API connects to Postgres and logs a ready message
- [ ] Client proxies API requests in dev (no CORS issues)
- [ ] Health check endpoints respond at `/health` on API

**Points:** 3

---

**US-103** · Database migrations pipeline
> As a developer, I want versioned Drizzle migrations so schema changes are applied consistently across all environments with no manual SQL.

**Acceptance Criteria:**
- [ ] `drizzle-kit generate` creates migration files
- [ ] `drizzle-kit migrate` applies pending migrations in order
- [ ] Migration runs automatically on API startup in dev
- [ ] CI runs migrations before test suite
- [ ] Rolling back a migration is documented in the runbook

**Points:** 2

---

**US-104** · CI pipeline
> As a developer, I want a CI pipeline that runs on every PR so that type errors, lint failures, and broken tests are caught before merge.

**Acceptance Criteria:**
- [ ] CI runs: `tsc --noEmit`, `eslint`, `prettier --check`, unit tests
- [ ] CI runs migrations against a test Postgres instance
- [ ] PR cannot be merged if CI is red
- [ ] CI completes in under 3 minutes on a warm cache
- [ ] Test coverage report is posted as a PR comment

**Points:** 3

---

**US-105** · Shared error handling and logging
> As a developer, I want a consistent error response format and structured JSON logging so that debugging in all environments is predictable.

**Acceptance Criteria:**
- [ ] All API errors return `{ error: { code, message, details? } }`
- [ ] HTTP 400/401/403/404/500 are mapped to specific error codes
- [ ] Fastify uses `pino` for structured JSON logging
- [ ] Log level is configurable via `LOG_LEVEL` env var
- [ ] Unhandled rejections and uncaught exceptions are logged before process exit

**Points:** 2

---

### E2 — Authentication & User Management

---

**US-201** · User registration
> As a new user, I want to register with a username, email, and password so I can access AICORD.

**Acceptance Criteria:**
- [ ] `POST /auth/register` creates a user and returns 201
- [ ] Password is hashed with bcrypt cost factor 12 — plaintext is never stored or logged
- [ ] Duplicate email returns 409 with `EMAIL_TAKEN` error code
- [ ] Duplicate username returns 409 with `USERNAME_TAKEN` error code
- [ ] Username: 3–32 chars, alphanumeric + underscores only
- [ ] Email: valid RFC 5321 format
- [ ] Password: minimum 8 chars
- [ ] Response does not include `password_hash`

**Points:** 3

---

**US-202** · User login and JWT issuance
> As a registered user, I want to log in with email and password and receive a JWT so I can access protected endpoints.

**Acceptance Criteria:**
- [ ] `POST /auth/login` returns a signed JWT (15min expiry) and a refresh token (7-day expiry)
- [ ] Refresh token is stored in the `sessions` table
- [ ] Invalid credentials return 401 with `INVALID_CREDENTIALS` — no indication of which field is wrong
- [ ] Response time on failed login is not measurably faster than success (timing-safe comparison)
- [ ] JWT payload contains `sub`, `username`, `iat`, `exp`

**Points:** 3

---

**US-203** · Token refresh
> As a logged-in user, I want my session to auto-renew so I'm not logged out while actively using the app.

**Acceptance Criteria:**
- [ ] `POST /auth/refresh` accepts a valid refresh token and returns a new JWT
- [ ] Expired or invalid refresh tokens return 401
- [ ] Refresh token rotation: issuing a new refresh token invalidates the old one
- [ ] Client auto-retries failed requests with a refreshed token (401 interceptor)

**Points:** 3

---

**US-204** · Logout
> As a user, I want to log out so my session is invalidated server-side.

**Acceptance Criteria:**
- [ ] `POST /auth/logout` deletes the session from the DB
- [ ] Subsequent calls with the old refresh token return 401
- [ ] JWT is short-lived enough (15min) that client-side deletion is sufficient for the access token

**Points:** 1

---

**US-205** · User profile
> As a user, I want to view and update my profile (username, avatar URL) so others can identify me.

**Acceptance Criteria:**
- [ ] `GET /users/me` returns current user (no `password_hash`)
- [ ] `PATCH /users/me` updates `username` and/or `avatar_url`
- [ ] `GET /users/:id` returns public profile (id, username, avatar_url, presence)
- [ ] Updating to a taken username returns 409

**Points:** 2

---

**US-206** · Presence management
> As a user, I want my presence status to reflect my actual state so others know if I'm available.

**Acceptance Criteria:**
- [ ] `PATCH /users/me/presence` accepts `online | idle | offline | ai_assisted`
- [ ] Presence changes are broadcast via `PRESENCE_UPDATE` WebSocket event to all servers the user shares with others
- [ ] Presence is set to `offline` when the WebSocket connection closes
- [ ] Presence is set to `online` when the WebSocket connection opens

**Points:** 3

---

### E3 — Servers & Channels

---

**US-301** · Create and manage servers
> As a user, I want to create a server with a name so I can build a community space.

**Acceptance Criteria:**
- [ ] `POST /servers` creates a server; creator is assigned `owner` role
- [ ] Server `slug` is auto-generated from `name` (lowercase, hyphens, unique)
- [ ] `GET /servers` returns only servers the user is a member of
- [ ] `PATCH /servers/:id` updates name/icon (admin+); slug does not change
- [ ] `DELETE /servers/:id` is restricted to owner; cascades to channels and messages

**Points:** 3

---

**US-302** · Join and leave servers
> As a user, I want to join existing servers and leave ones I no longer want to be in.

**Acceptance Criteria:**
- [ ] `POST /servers/:id/join` adds user as `member`
- [ ] `DELETE /servers/:id/leave` removes user; owner cannot leave (must transfer or delete)
- [ ] Joining an already-joined server returns 409
- [ ] Server member list updates in real-time for connected users (WebSocket event)

**Points:** 2

---

**US-303** · Member role management
> As a server admin, I want to assign roles (admin, member, guest) to members so I can control what they can do.

**Acceptance Criteria:**
- [ ] `GET /servers/:id/members` returns members with roles
- [ ] `PATCH /servers/:id/members/:userId` updates role (admin+)
- [ ] Owner role cannot be changed via this endpoint
- [ ] Demoting yourself as the only admin returns 400 with `LAST_ADMIN` error
- [ ] Permission checks in all protected endpoints respect the role matrix from spec §7.3

**Points:** 3

---

**US-304** · Channel CRUD
> As an admin, I want to create, rename, and delete channels within a server so I can organize community spaces.

**Acceptance Criteria:**
- [ ] `POST /servers/:id/channels` creates a channel with type `text | ai | digest`
- [ ] Channel names are unique per server; duplicates return 409
- [ ] `PATCH /channels/:id` updates name, topic, position (admin+)
- [ ] `DELETE /channels/:id` deletes the channel and all messages (admin+)
- [ ] `GET /servers/:id/channels` returns channels sorted by `position`

**Points:** 3

---

### E4 — Real-Time Messaging

---

**US-401** · WebSocket server and connection lifecycle
> As a connected client, I want a persistent WebSocket connection so I can receive real-time events without polling.

**Acceptance Criteria:**
- [ ] `wss://.../ws?token=<jwt>` authenticates on connect; invalid token closes with 4001
- [ ] Server sends `READY` event with `{ user, servers[] }` on successful auth
- [ ] Server responds to `HEARTBEAT` with `HEARTBEAT_ACK` within 5s
- [ ] Connection closes with 4000 if no heartbeat received within 90s
- [ ] Reconnect with exponential backoff is handled on the client (1s, 2s, 4s... max 30s)

**Points:** 5

---

**US-402** · Channel subscription
> As a user, I want to subscribe and unsubscribe from channels so I only receive events for channels I'm viewing.

**Acceptance Criteria:**
- [ ] `SUBSCRIBE { channelId }` registers the connection for that channel's events in Redis PubSub
- [ ] `UNSUBSCRIBE { channelId }` removes the registration
- [ ] Events for unsubscribed channels are not delivered to the client
- [ ] User must be a member of the channel's server to subscribe; violation closes with 4003

**Points:** 3

---

**US-403** · Send and receive messages
> As a user, I want to send messages to a channel and see others' messages in real-time so we can have live conversations.

**Acceptance Criteria:**
- [ ] `POST /channels/:id/messages` saves message and publishes `MESSAGE_CREATE` via Redis PubSub
- [ ] All subscribers receive `MESSAGE_CREATE` within 200ms p99 (same region)
- [ ] Message content max: 2000 characters; exceeding returns 400
- [ ] Empty/whitespace-only messages return 400
- [ ] Message response includes full `message` object (id, author, content, created_at, metadata)
- [ ] Messages are persisted even if no clients are connected

**Points:** 5

---

**US-404** · Message history (pagination)
> As a user, I want to scroll back through message history so I can catch up on past conversations.

**Acceptance Criteria:**
- [ ] `GET /channels/:id/messages?limit=50&before=<cursor>` returns messages in reverse-chronological order
- [ ] `before` cursor is a message ID (keyset pagination — no offset)
- [ ] Default limit 50; max 100; out-of-range returns 400
- [ ] Response includes `{ messages[], nextCursor }` where `nextCursor` is null when no more pages exist
- [ ] Query executes in < 50ms with an index on `(channel_id, created_at DESC)`

**Points:** 3

---

**US-405** · Edit and delete messages
> As a user, I want to edit my sent messages and delete them so I can correct mistakes.

**Acceptance Criteria:**
- [ ] `PATCH /messages/:id` updates content; sets `edited_at`; author only
- [ ] `DELETE /messages/:id` soft-deletes (sets content to `[deleted]`, nulls author); author or admin
- [ ] `MESSAGE_UPDATE` / `MESSAGE_DELETE` events broadcast to channel subscribers
- [ ] Editing someone else's message returns 403
- [ ] Edited messages show an "edited" indicator in the UI

**Points:** 3

---

**US-406** · Reactions
> As a user, I want to react to messages with emoji so I can express quick responses without text.

**Acceptance Criteria:**
- [ ] `POST /messages/:id/reactions` adds a reaction `{ emoji }`; unique per user per emoji
- [ ] `DELETE /messages/:id/reactions/:emoji` removes own reaction
- [ ] `REACTION_ADD` / `REACTION_REMOVE` events broadcast to channel subscribers
- [ ] Reacting twice with the same emoji is idempotent (200, not 409)
- [ ] Each message supports up to 20 distinct emoji types

**Points:** 3

---

**US-407** · Typing indicators
> As a user, I want to see when others are typing so the conversation feels live.

**Acceptance Criteria:**
- [ ] Client sends `TYPING_START { channelId }` when user begins typing
- [ ] Server broadcasts `TYPING_START { userId, channelId }` to other channel subscribers
- [ ] Typing indicator disappears after 5s with no new `TYPING_START` from that user
- [ ] Typing indicator does not appear for AI agent activity

**Points:** 2

---

### E5 — Direct Messages

---

**US-501** · Open a DM conversation
> As a user, I want to open a direct message conversation with another user so I can communicate privately.

**Acceptance Criteria:**
- [ ] `POST /dms { userId }` creates a `dm_channel` + 2 `dm_participants` rows, or returns the existing one
- [ ] `GET /dms` lists all DM conversations for the current user, sorted by last message time
- [ ] A user cannot open a DM with themselves (400)
- [ ] DM conversations appear in a dedicated section of the sidebar

**Points:** 3

---

**US-502** · DM messaging
> As a user, I want to send and receive DMs in real-time with the same experience as channel messages.

**Acceptance Criteria:**
- [ ] `POST /dms/:id/messages` sends a message in a DM channel
- [ ] `GET /dms/:id/messages` returns paginated history (same cursor pattern as channel messages)
- [ ] Participant must be in `dm_participants` to read or send; otherwise 403
- [ ] `MESSAGE_CREATE` event delivered via WebSocket to both participants
- [ ] DM messages support editing and deletion under the same rules as channel messages

**Points:** 3

---

### E6 — AI Agent Core

---

**US-601** · AI agent configuration
> As a server admin, I want to configure an AI agent for a channel — setting its persona, behavior mode, and permissions — so the AI behaves appropriately for that channel's purpose.

**Acceptance Criteria:**
- [ ] `PUT /channels/:id/ai` creates or updates the agent config (admin+)
- [ ] `GET /channels/:id/ai` returns current config
- [ ] Fields: `persona` (text), `model` (string), `behavior` (passive/active), `trigger_count` (int), `permissions` (read_only/reply_only/full), `enabled` (bool)
- [ ] Disabling agent (`enabled: false`) stops all AI activity in that channel immediately
- [ ] Only `ai` and `digest` channel types can have an agent; applying to `text` channel returns 400

**Points:** 3

---

**US-602** · @ai mention detection and response
> As a user, I want to type `@ai` in a message to ask the AI a question inline so I get answers without leaving the conversation.

**Acceptance Criteria:**
- [ ] `@ai` (case-insensitive) in message content triggers AI service regardless of behavior mode
- [ ] Agent must have `reply_only` or `full` permissions; otherwise mention is silently ignored
- [ ] Agent must be `enabled`; otherwise ignored
- [ ] AI response appears as a new message with `author_type = 'ai'`
- [ ] AI response is streamed via `MESSAGE_CREATE` events with `metadata.streaming: true/false`
- [ ] If LLM provider is unavailable, error is logged and a fallback message is posted: "I'm having trouble responding right now."

**Points:** 5

---

**US-603** · LLM adapter interface
> As an AI engineer, I want a clean LLM adapter interface so that swapping providers (Anthropic → OpenAI → local) requires no changes to business logic.

**Acceptance Criteria:**
- [ ] `LLMAdapter` interface implemented as per spec §6.5
- [ ] `AnthropicAdapter` is the default, using `claude-sonnet-4-6`
- [ ] Adapter returns `AsyncIterable<string>` for streaming
- [ ] Adapter is injected via dependency injection into `AIService`
- [ ] A `MockAdapter` exists for unit testing with configurable canned responses
- [ ] Integration test verifies the Anthropic adapter returns a non-empty response

**Points:** 3

---

**US-604** · AI response streaming via WebSocket
> As a user, I want to see the AI's response appear word-by-word so the interaction feels fast and alive.

**Acceptance Criteria:**
- [ ] AI tokens are streamed from LLM → AI Service → Redis PubSub → WebSocket → client
- [ ] Each chunk emits `MESSAGE_CREATE` with `metadata.streaming: true` and incremental `content`
- [ ] Final chunk emits with `metadata.streaming: false` and full `content`; message is persisted at this point
- [ ] Client renders incrementally with a blinking cursor while streaming
- [ ] If stream is interrupted mid-response, the partial message is saved with `metadata.interrupted: true`

**Points:** 5

---

**US-605** · Active mode auto-trigger
> As a server admin, I want the AI to proactively post summaries in active channels once a message threshold is reached so the channel stays organized without manual intervention.

**Acceptance Criteria:**
- [ ] When `behavior = active` and message count since last AI post reaches `trigger_count`, AI service is auto-invoked
- [ ] Auto-trigger generates a digest/summary of recent messages
- [ ] Auto-trigger respects `permissions = full`; read_only and reply_only agents cannot auto-post
- [ ] `trigger_count` is configurable per agent (default 50; min 10; max 500)
- [ ] Auto-triggered messages are marked with `metadata.auto_triggered: true`

**Points:** 3

---

### E7 — AI Context & Memory

---

**US-701** · Message embedding pipeline
> As an AI engineer, I want each new message to be embedded and stored in pgvector so the AI can retrieve semantically relevant past messages.

**Acceptance Criteria:**
- [ ] On `message.created` event, AI service generates a 1536-dim embedding via Anthropic or OpenAI embeddings API
- [ ] Embedding stored in `ai_contexts` with `channel_id` and `message_id`
- [ ] Embedding generation is async and non-blocking (does not delay message delivery)
- [ ] Embedding failures are retried up to 3 times with exponential backoff; logged on final failure
- [ ] `ivfflat` index exists on `ai_contexts.embedding` for fast similarity search

**Points:** 5

---

**US-702** · Semantic context retrieval
> As an AI engineer, I want to retrieve the top-K most semantically similar past messages for a given query so the AI has relevant historical context.

**Acceptance Criteria:**
- [ ] Given an input message, cosine similarity search returns top-5 most similar messages from the same channel
- [ ] Results exclude the input message itself
- [ ] Retrieval completes in < 100ms for channels with up to 100,000 messages
- [ ] Retrieved messages are included in the LLM context window (see spec §6.2)
- [ ] If pgvector search fails, AI service falls back to recent-messages-only context with a warning log

**Points:** 5

---

**US-703** · Context window builder
> As an AI engineer, I want a context window builder that assembles the system prompt, retrieved context, and recent messages within a token budget so we never exceed the LLM's context limit.

**Acceptance Criteria:**
- [ ] Builder accepts: persona, top-K semantic results, last-N messages, triggering message
- [ ] Builder enforces a configurable max token budget (default: model's context limit minus `AI_MAX_TOKENS` response budget)
- [ ] When over budget: first truncate semantic results, then oldest recent messages
- [ ] Builder is unit-tested with cases for: under budget, at budget, over budget on semantic results, over budget on recent messages
- [ ] Output format matches spec §6.2 exactly

**Points:** 3

---

### E8 — AI Summarization

---

**US-801** · On-demand channel summarization
> As a user, I want to click "Summarize" in a channel to get an instant AI summary of recent activity so I can catch up quickly.

**Acceptance Criteria:**
- [ ] `POST /channels/:id/ai/summarize` triggers summarization and returns `{ summary, message_count, generated_at }`
- [ ] Summary covers messages since the last summary, or last 50 messages if no prior summary
- [ ] Response time < 5s end-to-end (AI call included)
- [ ] Summary is posted as a pinned AI message in the channel
- [ ] `AI_SUMMARY { channelId, summary }` WebSocket event notifies connected clients
- [ ] Channel must have an enabled AI agent; otherwise returns 400 with `NO_AI_AGENT`

**Points:** 5

---

**US-802** · Digest channel
> As a user, I want a `#digest` channel that automatically surfaces AI-curated summaries from all other channels in the server so I have a single place to catch up.

**Acceptance Criteria:**
- [ ] `digest` channel type is created per server; only one allowed per server
- [ ] Digest runs on a schedule (every 6 hours by default, configurable by admin)
- [ ] Digest covers all channels in the server since the last digest run
- [ ] Digest message lists per-channel summary sections with channel reference links
- [ ] Digest can also be triggered manually via `POST /channels/:id/ai/summarize`
- [ ] Digest messages are marked with `metadata.digest: true`

**Points:** 5

---

### E9 — Frontend Shell & Navigation

---

**US-901** · Auth pages (register, login)
> As a new or returning user, I want clean register and login pages so I can access AICORD from a browser.

**Acceptance Criteria:**
- [ ] `/register` validates username, email, password in real-time; shows field-level errors
- [ ] `/login` shows error banner on invalid credentials
- [ ] On success, JWT is stored in memory (not localStorage); refresh token in an `HttpOnly` cookie
- [ ] Protected routes redirect unauthenticated users to `/login`
- [ ] Auth pages redirect authenticated users to `/app`

**Points:** 3

---

**US-902** · App shell and layout
> As a user, I want a consistent three-panel layout (server sidebar, channel sidebar, main content) so navigation is intuitive and familiar.

**Acceptance Criteria:**
- [ ] `AppShell` renders `ServerSidebar`, `ChannelSidebar`, and `MainContent` as per spec §8.2
- [ ] Clicking a server in `ServerSidebar` loads its channels in `ChannelSidebar`
- [ ] Clicking a channel navigates to `/app/channels/:serverId/:channelId`
- [ ] Active server and channel are highlighted visually
- [ ] Layout is responsive down to 1024px width; below that a hamburger menu collapses sidebars

**Points:** 5

---

**US-903** · Server and channel management UI
> As a server admin, I want UI flows for creating servers, creating channels, and managing members so I don't have to use the raw API.

**Acceptance Criteria:**
- [ ] "Create Server" modal accessible from `ServerSidebar`
- [ ] "Create Channel" button visible to admins in `ChannelSidebar`
- [ ] Channel type selector (text / ai / digest) shown on creation
- [ ] Member management panel accessible from server settings
- [ ] Role change dropdown visible on member rows for admins
- [ ] Destructive actions (delete server, delete channel) require a confirmation dialog with name-match input

**Points:** 5

---

**US-904** · WebSocket client initialization
> As a user, I want the app to establish a WebSocket connection on login and keep it alive so real-time features work seamlessly.

**Acceptance Criteria:**
- [ ] `WSClient` singleton initialized on login; torn down on logout
- [ ] `READY` event populates `authStore`, `serverStore`
- [ ] Incoming events dispatch to the correct Zustand store (see spec §8.3)
- [ ] Reconnects with exponential backoff (1s, 2s, 4s... max 30s); shows "Reconnecting…" banner
- [ ] `HEARTBEAT` sent every 30s; app shows "Connection lost" if `HEARTBEAT_ACK` not received within 10s

**Points:** 5

---

### E10 — Frontend Messaging UI

---

**US-1001** · Message list with virtualization
> As a user, I want the message feed to be smooth and performant even in channels with thousands of messages.

**Acceptance Criteria:**
- [ ] `MessageList` uses a virtualized list (e.g., `@tanstack/virtual`) — DOM nodes are recycled
- [ ] Initial render shows the latest 50 messages; scrolling up loads more (infinite scroll upward)
- [ ] Scroll-to-bottom button appears when the user is not at the bottom
- [ ] New messages auto-scroll only if the user is already at the bottom
- [ ] Time separators displayed between messages more than 5 minutes apart
- [ ] Grouped messages: consecutive messages from the same author within 2 minutes are visually grouped

**Points:** 5

---

**US-1002** · Message input with markdown support
> As a user, I want a rich text input that supports markdown so I can format my messages clearly.

**Acceptance Criteria:**
- [ ] `RichTextEditor` supports: **bold**, *italic*, `code`, ```code blocks```, links
- [ ] `Enter` sends the message; `Shift+Enter` inserts a newline
- [ ] Input clears after send; optimistic message appears immediately in the list
- [ ] If the API call fails, the optimistic message shows an error state with a "retry" button
- [ ] Character counter appears at 1800/2000 characters; input disabled at 2001

**Points:** 5

---

**US-1003** · Reactions UI
> As a user, I want to add and remove emoji reactions from messages with a picker so I can react quickly.

**Acceptance Criteria:**
- [ ] Hovering a message reveals a reaction button ("+")
- [ ] Clicking opens an emoji picker (top 100 common emoji + search)
- [ ] Selected emoji increments the reaction count immediately (optimistic)
- [ ] Clicking an emoji the user already reacted with removes it
- [ ] Reactions update in real-time via `REACTION_ADD` / `REACTION_REMOVE` events

**Points:** 3

---

**US-1004** · Typing indicators UI
> As a user, I want to see "[Name] is typing…" below the message list so I know to wait for a response.

**Acceptance Criteria:**
- [ ] `TypingIndicator` shows names of users currently typing
- [ ] Handles multiple typers: "Alice and Bob are typing…"; 3+ becomes "Several people are typing…"
- [ ] Indicator disappears 5s after the last `TYPING_START` from that user
- [ ] Client sends `TYPING_START` on first keystroke in a 5s debounce window
- [ ] AI agent typing is never shown as a typing indicator

**Points:** 2

---

### E11 — Frontend AI UX

---

**US-1101** · Streaming AI message rendering
> As a user, I want AI responses to appear token-by-token with a blinking cursor so the experience feels immediate.

**Acceptance Criteria:**
- [ ] `AIMessage` component handles `metadata.streaming: true` by appending new tokens to content
- [ ] Blinking cursor (CSS animation) appears at the end of streaming content
- [ ] Cursor disappears when `metadata.streaming: false` is received
- [ ] If stream is interrupted (`metadata.interrupted: true`), a subtle "(response interrupted)" note is appended
- [ ] Streaming messages are not editable or reactable until streaming completes

**Points:** 3

---

**US-1102** · AI message visual distinction
> As a user, I want AI messages to look visually distinct from human messages so I always know the source.

**Acceptance Criteria:**
- [ ] AI messages show an "AI" chip badge next to the author name
- [ ] AI message bubble has a distinct background color (not user message color)
- [ ] AI messages do not show an edit button
- [ ] Hovering the "AI" badge shows a tooltip: "Generated by AICORD AI"
- [ ] AI author name shows the configured agent persona name, falling back to "AICORD AI"

**Points:** 2

---

**US-1103** · Channel summary bar
> As a user, I want a dismissable summary bar at the top of a channel showing the latest AI digest so I can catch up at a glance.

**Acceptance Criteria:**
- [ ] `AISummaryBar` appears when a channel has a summary newer than the user's last visit
- [ ] Shows summary text truncated to 3 lines with "Read more" expansion
- [ ] "Dismiss" button hides the bar for that session (not persisted)
- [ ] "Refresh" button triggers `POST /channels/:id/ai/summarize` and updates the bar
- [ ] Bar is not shown for channels with no AI agent

**Points:** 3

---

**US-1104** · Inline AI suggestions (ghost text)
> As a user, I want the AI to suggest a reply draft below my message input so I can accept it with Tab and save time.

**Acceptance Criteria:**
- [ ] After 2s of inactivity in the message input (with content), AI suggestion is requested
- [ ] Suggestion appears as ghost text below the input with "Tab to accept" hint
- [ ] Pressing `Tab` copies the suggestion into the input (user can still edit before sending)
- [ ] Pressing `Escape` dismisses the suggestion
- [ ] Suggestions are debounced — max 1 request per 3s per user
- [ ] If no suggestion is available within 3s, ghost text silently disappears

**Points:** 5

---

### E12 — Hardening & Launch Readiness

---

**US-1201** · Input validation and sanitization audit
> As a security-conscious team, we want all API inputs validated and sanitized so no injection, XSS, or unexpected data reaches the database or clients.

**Acceptance Criteria:**
- [ ] All endpoints validated with Fastify schema validation (JSON Schema)
- [ ] User-generated content is sanitized server-side before persistence
- [ ] Markdown is rendered in a sandboxed context on the client (no `dangerouslySetInnerHTML` without sanitization)
- [ ] `Content-Security-Policy` header set on all responses
- [ ] OWASP Top 10 checklist reviewed and signed off

**Points:** 5

---

**US-1202** · Load testing
> As an engineer, I want load tests that verify our p99 latency and WebSocket concurrency targets so we know the system meets NFRs before launch.

**Acceptance Criteria:**
- [ ] Load test simulates 10,000 concurrent WebSocket connections
- [ ] Message delivery p99 < 200ms under 10k connections
- [ ] API p95 < 150ms under 500 concurrent HTTP requests
- [ ] AI first-token p90 < 2s (mocked LLM for scale testing)
- [ ] Results documented in a performance report artifact

**Points:** 5

---

**US-1203** · Observability
> As an on-call engineer, I want structured logs, request tracing, and error alerting so I can diagnose production issues quickly.

**Acceptance Criteria:**
- [ ] All API requests logged with: method, path, status, duration, userId (if authed)
- [ ] AI service logs: channelId, model, token count, latency per invocation
- [ ] WebSocket connections/disconnections logged with userId and reason
- [ ] Unhandled errors reported to an error tracking service (e.g., Sentry)
- [ ] Dashboard shows: active WS connections, message rate, AI invocation rate, error rate

**Points:** 5

---

**US-1204** · End-to-end test suite
> As a QA-minded team, we want an E2E test suite covering critical user flows so regressions are caught before deployment.

**Acceptance Criteria:**
- [ ] E2E tests cover: register → login → create server → create channel → send message → receive message in second browser tab
- [ ] E2E covers: @ai mention → AI response appears
- [ ] E2E covers: summarize channel → summary bar appears
- [ ] E2E uses Playwright; runs in CI on every PR
- [ ] Tests pass against a real local stack (Docker Compose)

**Points:** 8

---

## Sprint Backlog

> Sprints are 2 weeks. Capacity assumes 5–8 senior engineers × ~10–13 SP each = 60–80 SP/sprint.
> Stories are prioritized to deliver a walking skeleton by Sprint 2, AI features by Sprint 4, and a shippable v1 by Sprint 6.

---

### Sprint 1 — Foundation & Auth (Weeks 1–2)

**Goal:** Working dev environment, CI, and a registered/authenticated user can connect via WebSocket.

| Story | Title | Points | Owner |
|---|---|---|---|
| US-101 | Monorepo scaffold | 3 | Tech Lead |
| US-102 | Docker Compose dev environment | 3 | DevOps |
| US-103 | Database migrations pipeline | 2 | DevOps |
| US-104 | CI pipeline | 3 | DevOps |
| US-105 | Shared error handling and logging | 2 | Backend |
| US-201 | User registration | 3 | Backend |
| US-202 | User login and JWT issuance | 3 | Backend |
| US-203 | Token refresh | 3 | Backend |
| US-204 | Logout | 1 | Backend |
| US-205 | User profile | 2 | Backend |
| US-401 | WebSocket server and connection lifecycle | 5 | Backend |
| US-901 | Auth pages (register, login) | 3 | Frontend |

**Sprint Total:** 33 SP
**Notes:** Small sprint intentionally — foundation work involves high coordination. Teams should pair on US-101/102 to get unblocked fast.

---

### Sprint 2 — Core Messaging Walking Skeleton (Weeks 3–4)

**Goal:** Users can create servers, join channels, and exchange real-time messages end-to-end.

| Story | Title | Points | Owner |
|---|---|---|---|
| US-206 | Presence management | 3 | Backend |
| US-301 | Create and manage servers | 3 | Backend |
| US-302 | Join and leave servers | 2 | Backend |
| US-303 | Member role management | 3 | Backend |
| US-304 | Channel CRUD | 3 | Backend |
| US-402 | Channel subscription | 3 | Backend |
| US-403 | Send and receive messages | 5 | Backend |
| US-404 | Message history (pagination) | 3 | Backend |
| US-902 | App shell and layout | 5 | Frontend |
| US-904 | WebSocket client initialization | 5 | Frontend |
| US-1001 | Message list with virtualization | 5 | Frontend |
| US-1002 | Message input with markdown support | 5 | Frontend |

**Sprint Total:** 45 SP
**Notes:** By end of Sprint 2, a user can log in, create a server, join a channel, and chat in real-time. This is the demo-able milestone.

---

### Sprint 3 — Messaging Polish & DMs (Weeks 5–6)

**Goal:** Complete messaging feature set: edit, delete, reactions, typing, DMs. Frontend fully usable.

| Story | Title | Points | Owner |
|---|---|---|---|
| US-405 | Edit and delete messages | 3 | Backend |
| US-406 | Reactions | 3 | Backend |
| US-407 | Typing indicators | 2 | Backend |
| US-501 | Open a DM conversation | 3 | Backend |
| US-502 | DM messaging | 3 | Backend |
| US-903 | Server and channel management UI | 5 | Frontend |
| US-1003 | Reactions UI | 3 | Frontend |
| US-1004 | Typing indicators UI | 2 | Frontend |

**Sprint Total:** 24 SP
**Notes:** Lower point load intentionally — teams use remaining capacity for refactoring debt from Sprint 2 and writing unit tests. Tech Lead runs architecture review.

---

### Sprint 4 — AI Core (Weeks 7–8)

**Goal:** AI agents are live. Users can @ai, see streaming responses, and configure agents per channel.

| Story | Title | Points | Owner |
|---|---|---|---|
| US-601 | AI agent configuration | 3 | AI Eng |
| US-602 | @ai mention detection and response | 5 | AI Eng |
| US-603 | LLM adapter interface | 3 | AI Eng |
| US-604 | AI response streaming via WebSocket | 5 | AI Eng + Backend |
| US-605 | Active mode auto-trigger | 3 | AI Eng |
| US-701 | Message embedding pipeline | 5 | AI Eng |
| US-702 | Semantic context retrieval | 5 | AI Eng |
| US-703 | Context window builder | 3 | AI Eng |
| US-1101 | Streaming AI message rendering | 3 | Frontend |
| US-1102 | AI message visual distinction | 2 | Frontend |

**Sprint Total:** 37 SP
**Notes:** AI engineer leads E6/E7. Backend pair on WebSocket streaming (US-604). Frontend pair on AI UX components. Integration test day at end of sprint.

---

### Sprint 5 — AI Summarization & Full AI UX (Weeks 9–10)

**Goal:** Summarization, digest channels, and all AI UX features are complete and polished.

| Story | Title | Points | Owner |
|---|---|---|---|
| US-801 | On-demand channel summarization | 5 | AI Eng |
| US-802 | Digest channel | 5 | AI Eng + Backend |
| US-1103 | Channel summary bar | 3 | Frontend |
| US-1104 | Inline AI suggestions (ghost text) | 5 | Frontend |
| US-1201 | Input validation and sanitization audit | 5 | Tech Lead + Backend |
| US-1203 | Observability | 5 | DevOps |

**Sprint Total:** 28 SP
**Notes:** Remaining capacity used for exploratory testing, documentation, and performance profiling. AI engineer begins benchmarking context retrieval at scale.

---

### Sprint 6 — Hardening & Launch (Weeks 11–12)

**Goal:** v1 is production-ready. All NFRs verified. E2E suite green. Deployment scripted.

| Story | Title | Points | Owner |
|---|---|---|---|
| US-1202 | Load testing | 5 | DevOps + Backend |
| US-1204 | End-to-end test suite | 8 | Frontend + QA |

**Sprint Total:** 13 SP
**Notes:** Entire team participates in final QA sweep. Bug bash on Day 1 of Sprint 6. All P0/P1 bugs resolved before launch gate. Remaining capacity is intentionally reserved for bug fixes surfaced during hardening.

---

## Definition of Done

A story is **Done** when:

- [ ] Code is merged to `main` via a reviewed PR (minimum 1 approval from a senior not the author)
- [ ] All acceptance criteria pass
- [ ] Unit tests written for all new business logic (coverage ≥ 80% on changed files)
- [ ] No new TypeScript errors (`tsc --noEmit` clean)
- [ ] No new lint warnings
- [ ] API changes reflected in spec.md if they deviate from the original
- [ ] Feature verified working end-to-end in Docker Compose environment

## Definition of Ready

A story is **Ready** to be pulled into a sprint when:

- [ ] Acceptance criteria are written and unambiguous
- [ ] Dependencies on other stories are identified and either done or planned in the same sprint
- [ ] Story is pointed by the team (no 13s — must be broken down first)
- [ ] Any external API keys or infrastructure needed are provisioned or have a provisioning plan

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM API latency exceeds 2s p90 | Medium | High | Benchmark early (Sprint 4); implement response caching for repeated queries |
| pgvector similarity search too slow at scale | Medium | Medium | Load test in Sprint 5; consider approximate index tuning (ivfflat `lists` param) |
| WebSocket 10k connection target missed | Low | High | Load test in Sprint 6; Redis PubSub is the bottleneck — profile early |
| Context window overflow for active channels | Medium | Medium | Context builder unit-tested in US-703; token budgeting enforced before Sprint 4 ships |
| Anthropic API cost overruns in dev | High | Low | Rate-limit AI invocations in dev environment; mock adapter used in all non-integration tests |
| Frontend performance on large message history | Low | Medium | Virtualized list (US-1001) addresses this; benchmark at 10k messages in Sprint 3 |
