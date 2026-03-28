import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken, AccessTokenPayload } from '../lib/jwt'
import { Errors } from '../lib/errors'

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenPayload
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.UNAUTHORIZED()
  }
  const token = authHeader.slice(7)
  request.user = verifyAccessToken(token)
}
