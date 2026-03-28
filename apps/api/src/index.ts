import 'dotenv/config'
import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import { logger } from './lib/logger'
import { AppError } from './lib/errors'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { wsRoutes } from './routes/ws'
import { serverRoutes } from './routes/servers'
import { channelRoutes } from './routes/channels'
import { messageRoutes } from './routes/messages'
import { reactionRoutes } from './routes/reactions'
import { dmRoutes } from './routes/dms'
import { aiRoutes } from './routes/ai'
import { pool } from './db'

const app = Fastify({
  loggerInstance: logger,
  disableRequestLogging: false,
})

async function bootstrap() {
  await app.register(fastifyCors, {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  })
  await app.register(fastifyCookie)
  await app.register(fastifyWebsocket)

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      })
    }

    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.validation,
        },
      })
    }

    logger.error({ err: error, url: request.url }, 'Unhandled error')
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    })
  })

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(userRoutes, { prefix: '/api/v1/users' })
  await app.register(serverRoutes, { prefix: '/api/v1/servers' })
  await app.register(channelRoutes, { prefix: '/api/v1' })
  await app.register(messageRoutes, { prefix: '/api/v1' })
  await app.register(reactionRoutes, { prefix: '/api/v1/messages' })
  await app.register(dmRoutes, { prefix: '/api/v1/dms' })
  await app.register(aiRoutes, { prefix: '/api/v1' })
  await app.register(wsRoutes)

  const port = parseInt(process.env.PORT ?? '3000', 10)
  await app.listen({ port, host: '0.0.0.0' })
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})

process.on('SIGTERM', async () => {
  logger.info('Shutting down...')
  await app.close()
  await pool.end()
  process.exit(0)
})
