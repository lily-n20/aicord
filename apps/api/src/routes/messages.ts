import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, lt, desc } from 'drizzle-orm'
import { db } from '../db'
import { messages, channels, memberships, users } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors } from '../lib/errors'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'
import { aiService } from '../services/ai/AIService'

async function assertChannelAccess(channelId: string, userId: string) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1)
  if (!channel) throw Errors.NOT_FOUND('Channel')

  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.serverId, channel.serverId), eq(memberships.userId, userId)))
    .limit(1)
  if (!membership) throw Errors.FORBIDDEN()

  return { channel, role: membership.role }
}

const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters')
    .refine((s) => s.trim().length > 0, 'Message cannot be whitespace only'),
})

const editMessageSchema = z.object({
  content: z.string().min(1).max(2000).refine((s) => s.trim().length > 0),
})

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

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /channels/:id/messages
  fastify.get('/channels/:id/messages', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }
    const query = z.object({
      before: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).safeParse(request.query)
    if (!query.success) throw Errors.VALIDATION_ERROR(query.error.flatten())

    await assertChannelAccess(id, request.user.sub)

    const { before, limit } = query.data

    const conditions = [eq(messages.channelId, id)]
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
      messages: page.reverse().map((r) => serializeMessage(r, r.username ? { username: r.username, avatarUrl: r.avatarUrl } : null)),
      nextCursor: hasMore ? page[0].id : null,
    }
  })

  // POST /channels/:id/messages
  fastify.post('/channels/:id/messages', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    await assertChannelAccess(id, request.user.sub)

    const body = sendMessageSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const [user] = await db
      .select({ username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, request.user.sub))
      .limit(1)

    const [message] = await db
      .insert(messages)
      .values({ channelId: id, authorId: request.user.sub, authorType: 'user', content: body.data.content })
      .returning()

    const payload = serializeMessage(message, user ? { username: user.username, avatarUrl: user.avatarUrl } : null)

    // Publish to Redis for WebSocket broadcast
    await redis.publish(`channel:${id}`, JSON.stringify({ op: 'MESSAGE_CREATE', d: payload }))

    // Trigger AI service non-blocking
    aiService.handleNewMessage(message.id, id, body.data.content, request.user.sub).catch((err) =>
      logger.warn({ err }, 'AI service error')
    )

    return reply.status(201).send({ message: payload })
  })

  // PATCH /messages/:id
  fastify.patch('/messages/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1)
    if (!message) throw Errors.NOT_FOUND('Message')
    if (message.authorId !== request.user.sub) throw Errors.FORBIDDEN()

    const body = editMessageSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const [updated] = await db
      .update(messages)
      .set({ content: body.data.content, editedAt: new Date() })
      .where(eq(messages.id, id))
      .returning()

    const [user] = await db.select({ username: users.username, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, request.user.sub)).limit(1)
    const payload = serializeMessage(updated, user ? { username: user.username, avatarUrl: user.avatarUrl } : null)

    await redis.publish(`channel:${message.channelId}`, JSON.stringify({ op: 'MESSAGE_UPDATE', d: payload }))

    return { message: payload }
  })

  // DELETE /messages/:id
  fastify.delete('/messages/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1)
    if (!message) throw Errors.NOT_FOUND('Message')

    const isAuthor = message.authorId === request.user.sub
    if (!isAuthor) {
      const [channel] = await db.select().from(channels).where(eq(channels.id, message.channelId)).limit(1)
      const [membership] = await db
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.serverId, channel!.serverId), eq(memberships.userId, request.user.sub)))
        .limit(1)
      if (!membership || !['owner', 'admin'].includes(membership.role)) throw Errors.FORBIDDEN()
    }

    // Soft delete
    await db.update(messages).set({ content: '[deleted]', authorId: null }).where(eq(messages.id, id))

    await redis.publish(`channel:${message.channelId}`, JSON.stringify({ op: 'MESSAGE_DELETE', d: { messageId: id, channelId: message.channelId } }))

    return reply.status(204).send()
  })
}
