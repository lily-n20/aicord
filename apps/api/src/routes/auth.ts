import { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users, sessions } from '../db/schema'
import { Errors } from '../lib/errors'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores only'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const BCRYPT_ROUNDS = 12
const DUMMY_HASH = '$2b$12$invalidhashfortimingsafety00000000000000000'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const { username, email, password } = body.data

    const [existingEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (existingEmail) throw Errors.EMAIL_TAKEN()

    const [existingUsername] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
    if (existingUsername) throw Errors.USERNAME_TAKEN()

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const [user] = await db
      .insert(users)
      .values({ username, email, passwordHash })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        presence: users.presence,
        createdAt: users.createdAt,
      })

    return reply.status(201).send({ user })
  })

  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const { email, password } = body.data

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    // Always run bcrypt to prevent timing attacks
    const hash = user?.passwordHash ?? DUMMY_HASH
    const valid = await bcrypt.compare(password, hash)

    if (!user || !valid) throw Errors.INVALID_CREDENTIALS()

    const accessToken = signAccessToken({ sub: user.id, username: user.username })
    const refreshToken = signRefreshToken(user.id)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.insert(sessions).values({ userId: user.id, refreshToken, expiresAt })

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        presence: user.presence,
        createdAt: user.createdAt.toISOString(),
      },
      accessToken,
      refreshToken,
    })
  })

  fastify.post('/refresh', async (request, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(request.body)
    if (!body.success) throw Errors.INVALID_TOKEN()

    const { refreshToken } = body.data
    const payload = verifyRefreshToken(refreshToken)

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshToken, refreshToken))
      .limit(1)

    if (!session || session.expiresAt < new Date()) throw Errors.INVALID_TOKEN()

    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!user) throw Errors.INVALID_TOKEN()

    // Rotate refresh token
    const newRefreshToken = signRefreshToken(user.id)
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.delete(sessions).where(eq(sessions.id, session.id))
    await db.insert(sessions).values({ userId: user.id, refreshToken: newRefreshToken, expiresAt: newExpiresAt })

    const accessToken = signAccessToken({ sub: user.id, username: user.username })

    return reply.send({ accessToken, refreshToken: newRefreshToken })
  })

  fastify.post('/logout', async (request, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(request.body)
    if (body.success) {
      await db.delete(sessions).where(eq(sessions.refreshToken, body.data.refreshToken))
    }
    return reply.status(204).send()
  })
}
