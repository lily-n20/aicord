import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { reactions, messages, channels, memberships } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors } from '../lib/errors'
import { redis } from '../lib/redis'

async function assertChannelAccess(messageId: string, userId: string) {
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
  if (!msg) throw Errors.NOT_FOUND('Message')
  const [ch] = await db.select().from(channels).where(eq(channels.id, msg.channelId)).limit(1)
  if (!ch) throw Errors.NOT_FOUND('Channel')
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.serverId, ch.serverId), eq(memberships.userId, userId)))
    .limit(1)
  if (!m) throw Errors.FORBIDDEN()
  return { message: msg, channel: ch }
}

const addReactionSchema = z.object({
  emoji: z.string().min(1).max(32),
})

export const reactionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /messages/:id/reactions
  fastify.post('/:id/reactions', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = addReactionSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const { message } = await assertChannelAccess(id, request.user.sub)

    // Count distinct emoji types on this message
    const existing = await db
      .select({ emoji: reactions.emoji })
      .from(reactions)
      .where(eq(reactions.messageId, id))
    const distinctEmoji = new Set(existing.map((r) => r.emoji))
    if (!distinctEmoji.has(body.data.emoji) && distinctEmoji.size >= 20) {
      return reply.status(400).send({ error: { code: 'MAX_REACTIONS', message: 'Maximum 20 distinct emoji per message' } })
    }

    // Upsert — idempotent
    await db
      .insert(reactions)
      .values({ messageId: id, userId: request.user.sub, emoji: body.data.emoji })
      .onConflictDoNothing()
      .returning()

    const allReactions = await db
      .select()
      .from(reactions)
      .where(eq(reactions.messageId, id))

    const grouped = allReactions.reduce<Record<string, { emoji: string; count: number; userIds: string[] }>>((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] }
      acc[r.emoji].count++
      acc[r.emoji].userIds.push(r.userId)
      return acc
    }, {})

    await redis.publish(`channel:${message.channelId}`, JSON.stringify({
      op: 'REACTION_ADD',
      d: { messageId: id, channelId: message.channelId, reactions: Object.values(grouped) },
    }))

    return reply.status(200).send({ reactions: Object.values(grouped) })
  })

  // DELETE /messages/:id/reactions/:emoji
  fastify.delete('/:id/reactions/:emoji', { preHandler: requireAuth }, async (request, reply) => {
    const { id, emoji } = request.params as { id: string; emoji: string }

    const { message } = await assertChannelAccess(id, request.user.sub)

    await db.delete(reactions).where(
      and(
        eq(reactions.messageId, id),
        eq(reactions.userId, request.user.sub),
        eq(reactions.emoji, decodeURIComponent(emoji))
      )
    )

    const allReactions = await db.select().from(reactions).where(eq(reactions.messageId, id))
    const grouped = allReactions.reduce<Record<string, { emoji: string; count: number; userIds: string[] }>>((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] }
      acc[r.emoji].count++
      acc[r.emoji].userIds.push(r.userId)
      return acc
    }, {})

    await redis.publish(`channel:${message.channelId}`, JSON.stringify({
      op: 'REACTION_REMOVE',
      d: { messageId: id, channelId: message.channelId, reactions: Object.values(grouped) },
    }))

    return reply.status(200).send({ reactions: Object.values(grouped) })
  })
}
