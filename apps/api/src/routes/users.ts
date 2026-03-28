import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors } from '../lib/errors'

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

const updatePresenceSchema = z.object({
  presence: z.enum(['online', 'idle', 'offline', 'ai_assisted']),
})

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', { preHandler: requireAuth }, async (request) => {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, request.user.sub))
      .limit(1)

    if (!user) throw Errors.NOT_FOUND('User')
    return { user }
  })

  fastify.patch('/me', { preHandler: requireAuth }, async (request) => {
    const body = updateProfileSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const { username, avatarUrl } = body.data

    if (username) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1)
      if (existing && existing.id !== request.user.sub) throw Errors.USERNAME_TAKEN()
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (username !== undefined) updates.username = username
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, request.user.sub))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
        createdAt: users.createdAt,
      })

    return { user: updated }
  })

  fastify.patch('/me/presence', { preHandler: requireAuth }, async (request) => {
    const body = updatePresenceSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    await db
      .update(users)
      .set({ presence: body.data.presence, updatedAt: new Date() })
      .where(eq(users.id, request.user.sub))

    return { presence: body.data.presence }
  })

  fastify.get('/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!user) throw Errors.NOT_FOUND('User')
    return { user }
  })
}
