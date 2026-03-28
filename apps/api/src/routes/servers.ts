import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { servers, memberships, users } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors } from '../lib/errors'
import { sanitizeName } from '../lib/sanitize'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let i = 1
  while (true) {
    const [existing] = await db.select({ id: servers.id }).from(servers).where(eq(servers.slug, slug)).limit(1)
    if (!existing) return slug
    slug = `${base}-${i++}`
  }
}

async function getMemberRole(serverId: string, userId: string) {
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.serverId, serverId), eq(memberships.userId, userId)))
    .limit(1)
  return m?.role ?? null
}

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  iconUrl: z.string().url().nullable().optional(),
})

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iconUrl: z.string().url().nullable().optional(),
})

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member', 'guest']),
})

export const serverRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /servers — list servers for current user
  fastify.get('/', { preHandler: requireAuth }, async (request) => {
    const rows = await db
      .select({
        id: servers.id,
        name: servers.name,
        slug: servers.slug,
        iconUrl: servers.iconUrl,
        ownerId: servers.ownerId,
        createdAt: servers.createdAt,
      })
      .from(servers)
      .innerJoin(memberships, eq(memberships.serverId, servers.id))
      .where(eq(memberships.userId, request.user.sub))

    return { servers: rows }
  })

  // POST /servers — create server
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const body = createServerSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const cleanName = sanitizeName(body.data.name)
    const slug = await uniqueSlug(toSlug(cleanName))

    const [server] = await db
      .insert(servers)
      .values({ name: cleanName, slug, iconUrl: body.data.iconUrl ?? null, ownerId: request.user.sub })
      .returning()

    // Creator becomes owner
    await db.insert(memberships).values({ serverId: server.id, userId: request.user.sub, role: 'owner' })

    return reply.status(201).send({ server })
  })

  // GET /servers/:id
  fastify.get('/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.user.sub)
    if (!role) throw Errors.FORBIDDEN()

    const [server] = await db.select().from(servers).where(eq(servers.id, id)).limit(1)
    if (!server) throw Errors.NOT_FOUND('Server')

    return { server }
  })

  // PATCH /servers/:id
  fastify.patch('/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.user.sub)
    if (!role || !['owner', 'admin'].includes(role)) throw Errors.FORBIDDEN()

    const body = updateServerSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const updates: Record<string, unknown> = {}
    if (body.data.name !== undefined) updates.name = sanitizeName(body.data.name)
    if (body.data.iconUrl !== undefined) updates.iconUrl = body.data.iconUrl

    const [updated] = await db.update(servers).set(updates).where(eq(servers.id, id)).returning()
    return { server: updated }
  })

  // DELETE /servers/:id
  fastify.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.user.sub)
    if (role !== 'owner') throw Errors.FORBIDDEN()

    await db.delete(servers).where(eq(servers.id, id))
    return reply.status(204).send()
  })

  // POST /servers/:id/join
  fastify.post('/:id/join', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [server] = await db.select({ id: servers.id }).from(servers).where(eq(servers.id, id)).limit(1)
    if (!server) throw Errors.NOT_FOUND('Server')

    const existing = await getMemberRole(id, request.user.sub)
    if (existing) return reply.status(409).send({ error: { code: 'ALREADY_MEMBER', message: 'Already a member of this server' } })

    await db.insert(memberships).values({ serverId: id, userId: request.user.sub, role: 'member' })
    return reply.status(204).send()
  })

  // DELETE /servers/:id/leave
  fastify.delete('/:id/leave', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.user.sub)
    if (!role) throw Errors.FORBIDDEN()
    if (role === 'owner') {
      return reply.status(400).send({ error: { code: 'OWNER_CANNOT_LEAVE', message: 'Owner cannot leave the server. Transfer ownership or delete the server.' } })
    }

    await db.delete(memberships).where(and(eq(memberships.serverId, id), eq(memberships.userId, request.user.sub)))
    return reply.status(204).send()
  })

  // GET /servers/:id/members
  fastify.get('/:id/members', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }
    const role = await getMemberRole(id, request.user.sub)
    if (!role) throw Errors.FORBIDDEN()

    const members = await db
      .select({
        id: memberships.id,
        serverId: memberships.serverId,
        userId: memberships.userId,
        role: memberships.role,
        joinedAt: memberships.joinedAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.serverId, id))

    return { members }
  })

  // PATCH /servers/:id/members/:userId
  fastify.patch('/:id/members/:userId', { preHandler: requireAuth }, async (request) => {
    const { id, userId } = request.params as { id: string; userId: string }

    const callerRole = await getMemberRole(id, request.user.sub)
    if (!callerRole || !['owner', 'admin'].includes(callerRole)) throw Errors.FORBIDDEN()

    const body = updateMemberSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const targetRole = await getMemberRole(id, userId)
    if (!targetRole) throw Errors.NOT_FOUND('Member')
    if (targetRole === 'owner') throw Errors.FORBIDDEN()

    // Check last admin guard
    if (userId === request.user.sub && callerRole === 'admin' && body.data.role !== 'admin') {
      const admins = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.serverId, id), eq(memberships.role, 'admin')))
      if (admins.length <= 1) {
        return { error: { code: 'LAST_ADMIN', message: 'Cannot demote the last admin' } }
      }
    }

    const [updated] = await db
      .update(memberships)
      .set({ role: body.data.role })
      .where(and(eq(memberships.serverId, id), eq(memberships.userId, userId)))
      .returning()

    return { membership: updated }
  })
}
