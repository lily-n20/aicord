import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { channels, memberships } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors } from '../lib/errors'

async function getMemberRole(serverId: string, userId: string) {
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.serverId, serverId), eq(memberships.userId, userId)))
    .limit(1)
  return m?.role ?? null
}

const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Channel name must be lowercase alphanumeric with hyphens'),
  type: z.enum(['text', 'ai', 'digest']).default('text'),
  topic: z.string().max(500).optional(),
})

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  topic: z.string().max(500).nullable().optional(),
  position: z.number().int().min(0).optional(),
})

export const channelRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /servers/:serverId/channels
  fastify.get('/servers/:serverId/channels', { preHandler: requireAuth }, async (request) => {
    const { serverId } = request.params as { serverId: string }
    const role = await getMemberRole(serverId, request.user.sub)
    if (!role) throw Errors.FORBIDDEN()

    const rows = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .orderBy(channels.position)

    return { channels: rows }
  })

  // POST /servers/:serverId/channels
  fastify.post('/servers/:serverId/channels', { preHandler: requireAuth }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string }
    const role = await getMemberRole(serverId, request.user.sub)
    if (!role || !['owner', 'admin'].includes(role)) throw Errors.FORBIDDEN()

    const body = createChannelSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const [existing] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.serverId, serverId), eq(channels.name, body.data.name)))
      .limit(1)
    if (existing) return reply.status(409).send({ error: { code: 'CHANNEL_NAME_TAKEN', message: 'A channel with this name already exists' } })

    const [channel] = await db
      .insert(channels)
      .values({ serverId, name: body.data.name, type: body.data.type, topic: body.data.topic ?? null })
      .returning()

    return reply.status(201).send({ channel })
  })

  // PATCH /channels/:id
  fastify.patch('/channels/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
    if (!channel) throw Errors.NOT_FOUND('Channel')

    const role = await getMemberRole(channel.serverId, request.user.sub)
    if (!role || !['owner', 'admin'].includes(role)) throw Errors.FORBIDDEN()

    const body = updateChannelSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const updates: Record<string, unknown> = {}
    if (body.data.name !== undefined) updates.name = body.data.name
    if (body.data.topic !== undefined) updates.topic = body.data.topic
    if (body.data.position !== undefined) updates.position = body.data.position

    const [updated] = await db.update(channels).set(updates).where(eq(channels.id, id)).returning()
    return { channel: updated }
  })

  // DELETE /channels/:id
  fastify.delete('/channels/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
    if (!channel) throw Errors.NOT_FOUND('Channel')

    const role = await getMemberRole(channel.serverId, request.user.sub)
    if (!role || !['owner', 'admin'].includes(role)) throw Errors.FORBIDDEN()

    await db.delete(channels).where(eq(channels.id, id))
    return reply.status(204).send()
  })
}
