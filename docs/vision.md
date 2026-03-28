# AICORD — Product Vision

## Overview

AICORD is a lightweight, AI-native messaging platform built for teams, communities, and individuals who want the familiar structure of Discord but with artificial intelligence woven into every layer of the experience. Where Discord is a platform that hosts conversations, AICORD is a platform that *participates* in them — helping users communicate faster, understand context better, and get more done together.

AICORD is not Discord with a chatbot added. AI is the substrate: every channel, every server, every interaction is designed with intelligence as a first-class citizen.

---

## Target Users

- **Developer and creator communities** who collaborate asynchronously and need context across long threads
- **Small teams and startups** that want a lightweight alternative to Slack with built-in AI assistance
- **Power users** who are frustrated by the noise-to-signal ratio in existing messaging apps
- **AI-curious communities** exploring what it means to build, learn, and work alongside AI agents

---

## Key Features

### Multi-User Platform
- Account creation, authentication, and user profiles
- Presence indicators (online, idle, offline, AI-assisted mode)
- Direct messages between users
- User roles: Owner, Admin, Member, Guest, and AI Agent

### Servers and Channels
- Users create or join **Servers** — persistent community spaces
- Each server contains **Channels** organized by topic or function
- Channel types:
  - **#text** — standard real-time messaging
  - **#ai** — a channel where an AI agent is always present and participates
  - **#digest** — AI-curated summaries of activity across other channels
  - **#voice** *(roadmap)* — voice rooms with live AI transcription and summarization

### AI-Powered Capabilities
- **Per-channel AI assistants** with configurable personas, knowledge bases, and permissions
- **Smart summarization** — catch up on any channel with a one-click AI summary
- **Context-aware replies** — AI drafts suggested responses based on thread context
- **@ai mentions** — tag the AI mid-conversation to ask questions, get explanations, or generate content
- **Thread intelligence** — AI surfaces related past conversations and relevant links
- **Moderation assist** — AI flags potentially toxic or off-topic messages for human review

### Real-Time Messaging
- WebSocket-based live messaging with low latency
- Typing indicators, read receipts, and reactions
- Rich message formatting: markdown, code blocks, embeds
- File and image sharing

### Roles and Permissions
- Granular permission system per server and per channel
- AI agents have their own permission scope — they can be read-only, reply-only, or fully conversational
- Admins can configure what AI features are enabled per channel

---

## How It Works

### A Typical User Session

1. **Sign in** — A user logs into AICORD and lands on their server list, with unread counts and AI-generated highlights for what they missed.
2. **Join a channel** — They open a `#product-feedback` channel and see a pinned AI digest: *"12 messages since yesterday. Main themes: onboarding friction, mobile bugs, two feature requests."*
3. **Catch up** — Instead of scrolling, they click **Summarize Thread** and read a 4-sentence AI summary.
4. **Participate** — They type a reply. As they write, a subtle AI suggestion appears below their draft: *"Similar question was answered in #support 3 days ago — want to link it?"*
5. **Ask the AI** — They type `@ai what's the status of the mobile bug fix?` and the AI synthesizes an answer from recent messages across relevant channels.
6. **Move on** — They mark the channel as read and move to the next, spending a fraction of the time they would on a traditional platform.

---

## AI Integration

AI in AICORD is not a plugin — it is a participant. Every server has an AI agent that can be configured by admins. This agent:

- **Listens passively** by default, building context without interrupting
- **Responds on mention** (`@ai`) with answers grounded in conversation history
- **Acts proactively** when configured to do so (e.g., auto-summarize after 50 messages, alert on keywords)
- **Has memory** within a server's context window, so it understands ongoing projects and running threads
- **Is transparent** — users always know when a message comes from an AI versus a human

AI agents can also be **specialized**: a `#code-review` channel might have an agent configured for technical review, while a `#announcements` channel might have one that drafts and polishes posts.

---

## Design Principles

1. **Intelligence is invisible until needed.** AI features should feel helpful, not intrusive. They surface when relevant and stay quiet when not.
2. **Simplicity over feature bloat.** AICORD does fewer things than Discord but does them better. Every feature earns its place.
3. **Humans stay in control.** AI assists and suggests; it never takes action without user intent. Moderation, posting, and decisions remain human.
4. **Context is a product.** The platform is designed to preserve, surface, and make use of conversation history — not let it disappear into an infinite scroll.
5. **Open and extensible.** Developers can bring their own AI models, configure custom agents, and integrate external tools via an API.

---

## Success Metrics

- Time-to-context: how quickly a returning user understands what they missed
- AI interaction rate: % of users who engage with AI features per session
- Message resolution rate: conversations that reach a clear conclusion vs. trailing off
- User retention: 7-day and 30-day active user rates compared to baseline

---

*AICORD is built on the belief that the best version of online community is one where AI makes every participant more informed, more heard, and more effective — without replacing the human connection at the center of it.*
