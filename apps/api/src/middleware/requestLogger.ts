import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger'

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string
    startTime: number
  }
}

/** Metrics counters — exported for health-check and monitoring endpoints */
export const metrics = {
  httpRequests: 0,
  httpErrors: 0,
  aiInvocations: 0,
  wsConnections: 0,
  wsMessages: 0,
}

export function registerRequestLogger(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.requestId = (request.headers['x-request-id'] as string) ?? randomUUID()
    request.startTime = Date.now()
  })

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    metrics.httpRequests++
    if (reply.statusCode >= 400) metrics.httpErrors++

    const durationMs = Date.now() - request.startTime
    const logData = {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs,
      userId: (request as any).user?.sub ?? null,
    }

    if (reply.statusCode >= 500) {
      logger.error(logData, 'Request completed with server error')
    } else if (reply.statusCode >= 400) {
      logger.warn(logData, 'Request completed with client error')
    } else if (durationMs > 2000) {
      logger.warn(logData, 'Slow request')
    } else {
      logger.info(logData, 'Request completed')
    }
  })

  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-Request-Id', request.requestId)
  })
}
