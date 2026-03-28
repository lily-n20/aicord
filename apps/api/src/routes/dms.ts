import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, lt } from 'drizzle-orm'
import { db } from '../db'
import { dmChannels, dmParticipants, messages, users } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors } from '../lib/errors'
import { redis } from '../lib/redis'
import { sanitizeContent } from '../lib/sanitize'

function serializeMessage(msg: typeof messages.$inferSelect, author?: { username: string; avatarUrl: string | null } | null) {
  return {
    id: msg.id,
    channelId: msg.channelId,
    authorId: msg.authorId,
    authorType: msg.authorType,
    content: msg.content,
    metadata: JSON.parse(msg.metadata),
    editedAt: msg.editedAt?.toISOString() ?? null,
    createdAt: msg.createdAt.toISOString(),
    author: author ?? null,
  }
}

export const dmRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /dms — list all DM conversations for current user
  fastify.get('/', { preHandler: requireAuth }, async (request) => {
    const participantRows = await db
      .select({ dmChannelId: dmParticipants.dmChannelId })
      .from(dmParticipants)
      .where(eq(dmParticipants.userId, request.user.sub))

    const dmIds = participantRows.map((r) => r.dmChannelId)

    if (dmIds.length === 0) return { dms: [] }

    const dms = await Promise.all(
      dmIds.map(async (dmId) => {
        const participants = await db
          .select({ userId: dmParticipants.userId, username: users.username, avatarUrl: users.avatarUrl, presence: users.presence })
          .from(dmParticipants)
          .innerJoin(users, eq(users.id, dmParticipants.userId))
          .where(eq(dmParticipants.dmChannelId, dmId))

        const [lastMsg] = await db
          .select()
          .from(messages)
          .where(eq(messages.channelId, dmId))
          .orderBy(desc(messages.createdAt))
          .limit(1)

        return {
          id: dmId,
          participants,
          lastMessage: lastMsg ? serializeMessage(lastMsg) : null,
        }
      })
    )

    dms.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? '0'
      const bTime = b.lastMessage?.createdAt ?? '0'
      return bTime.localeCompare(aTime)
    })

    return { dms }
  })

  // POST /dms — open or get DM with a user
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const body = z.object({ userId: z.string().uuid() }).safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const { userId } = body.data
    if (userId === request.user.sub) {
      return reply.status(400).send({ error: { code: 'CANNOT_DM_SELF', message: 'Cannot open a DM with yourself' } })
    }

    const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!targetUser) throw Errors.NOT_FOUND('User')

    // Find existing DM channel between the two users
    const myDMs = await db
      .select({ dmChannelId: dmParticipants.dmChannelId })
      .from(dmParticipants)
      .where(eq(dmParticipants.userId, request.user.sub))

    const myDMIds = myDMs.map((r) => r.dmChannelId)

    for (const dmId of myDMIds) {
      const participants = await db
        .select({ userId: dmParticipants.userId })
        .from(dmParticipants)
        .where(eq(dmParticipants.dmChannelId, dmId))
      const participantIds = participants.map((p) => p.userId)
      if (participantIds.includes(userId) && participantIds.length === 2) {
        return reply.send({ dmChannelId: dmId, created: false })
      }
    }

    // Create new DM channel
    const [dm] = await db.insert(dmChannels).values({}).returning()
    await db.insert(dmParticipants).values([
      { dmChannelId: dm.id, userId: request.user.sub },
      { dmChannelId: dm.id, userId },
    ])

    return reply.status(201).send({ dmChannelId: dm.id, created: true })
  })

  // GET /dms/:id/messages
  fastify.get('/:id/messages', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }
    const query = z.object({
      before: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).safeParse(request.query)
    if (!query.success) throw Errors.VALIDATION_ERROR(query.error.flatten())

    // Verify participant
    const [participant] = await db
      .select()
      .from(dmParticipants)
      .where(and(eq(dmParticipants.dmChannelId, id), eq(dmParticipants.userId, request.user.sub)))
      .limit(1)
    if (!participant) throw Errors.FORBIDDEN()

    const { before, limit } = query.data
    const conditions: Parameters<typeof and>[0][] = [eq(messages.channelId, id)]

    if (before) {
      const [cursor] = await db.select({ createdAt: messages.createdAt }).from(messages).where(eq(messages.id, before)).limit(1)
      if (cursor) conditions.push(lt(messages.createdAt, cursor.createdAt))
    }

    const rows = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        authorId: messages.authorId,
        authorType: messages.authorType,
        content: messages.content,
        metadata: messages.metadata,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    return {
      messages: page.reverse().map((r) =>
        serializeMessage(r, r.username ? { username: r.username, avatarUrl: r.avatarUrl } : null)
      ),
      nextCursor: hasMore ? page[0].id : null,
    }
  })

  // POST /dms/:id/messages
  fastify.post('/:id/messages', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [participant] = await db
      .select()
      .from(dmParticipants)
      .where(and(eq(dmParticipants.dmChannelId, id), eq(dmParticipants.userId, request.user.sub)))
      .limit(1)
    if (!participant) throw Errors.FORBIDDEN()

    const body = z.object({
      content: z.string().min(1).max(2000).refine((s) => s.trim().length > 0),
    }).safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const [user] = await db
      .select({ username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, request.user.sub))
      .limit(1)

    const sanitized = sanitizeContent(body.data.content)

    const [message] = await db
      .insert(messages)
      .values({ channelId: id, authorId: request.user.sub, authorType: 'user', content: sanitized })
      .returning()

    const payload = serializeMessage(message, user ? { username: user.username, avatarUrl: user.avatarUrl } : null)

    await redis.publish(`channel:${id}`, JSON.stringify({ op: 'MESSAGE_CREATE', d: payload }))

    return reply.status(201).send({ message: payload })
  })
}
