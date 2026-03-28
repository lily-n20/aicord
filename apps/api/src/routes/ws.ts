import { FastifyPluginAsync } from 'fastify'
import { WebSocket } from 'ws'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users, servers, memberships } from '../db/schema'
import { verifyAccessToken } from '../lib/jwt'
import { logger } from '../lib/logger'
import { redisSub } from '../lib/redis'
import { metrics } from '../middleware/requestLogger'
import type { WSEvent, ReadyPayload } from '@aicord/shared'

interface ConnectedClient {
  userId: string
  username: string
  ws: WebSocket
  subscribedChannels: Set<string>
  lastHeartbeat: number
}

export const clients = new Map<string, ConnectedClient>()

export function send<T>(ws: WebSocket, op: string, data: T): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op, d: data, t: Date.now() }))
  }
}

export function broadcast(channelId: string, op: string, data: unknown, excludeUserId?: string): void {
  for (const [userId, client] of clients) {
    if (excludeUserId && userId === excludeUserId) continue
    if (client.subscribedChannels.has(channelId)) {
      send(client.ws, op, data)
    }
  }
}

// Redis PubSub: forward channel messages to subscribed WS clients
redisSub.on('message', (redisChannel: string, rawMessage: string) => {
  try {
    const channelId = redisChannel.replace('channel:', '')
    const { op, d } = JSON.parse(rawMessage)
    broadcast(channelId, op, d)
  } catch {
    // ignore
  }
})

const subscribedRedisChannels = new Set<string>()

export function ensureRedisSubscription(channelId: string): void {
  const key = `channel:${channelId}`
  if (!subscribedRedisChannels.has(key)) {
    redisSub.subscribe(key)
    subscribedRedisChannels.add(key)
  }
}

export const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (connection, request) => {
    const ws = connection as unknown as WebSocket

    const token = (request.query as Record<string, string>)['token']
    if (!token) {
      ws.close(4001, 'Missing token')
      return
    }

    let userId: string
    let username: string
    try {
      const payload = verifyAccessToken(token)
      userId = payload.sub
      username = payload.username
    } catch {
      ws.close(4001, 'Invalid token')
      return
    }

    const userServers = await db
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
      .where(eq(memberships.userId, userId))

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
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      ws.close(4001, 'User not found')
      return
    }

    await db.update(users).set({ presence: 'online', updatedAt: new Date() }).where(eq(users.id, userId))

    const client: ConnectedClient = {
      userId,
      username,
      ws,
      subscribedChannels: new Set(),
      lastHeartbeat: Date.now(),
    }
    clients.set(userId, client)
    metrics.wsConnections++

    send<ReadyPayload>(ws, 'READY', {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        presence: 'online',
        createdAt: user.createdAt.toISOString(),
      },
      servers: userServers.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        iconUrl: s.iconUrl ?? null,
        ownerId: s.ownerId,
        createdAt: s.createdAt.toISOString(),
      })),
    })

    logger.info({ userId, username }, 'WebSocket client connected')

    const heartbeatWatchdog = setInterval(() => {
      if (Date.now() - client.lastHeartbeat > 90_000) {
        logger.info({ userId }, 'WebSocket heartbeat timeout')
        ws.close(4000, 'Heartbeat timeout')
        clearInterval(heartbeatWatchdog)
      }
    }, 10_000)

    ws.on('message', async (raw) => {
      metrics.wsMessages++
      let event: WSEvent
      try {
        event = JSON.parse(raw.toString())
      } catch {
        return
      }

      switch (event.op) {
        case 'HEARTBEAT':
          client.lastHeartbeat = Date.now()
          send(ws, 'HEARTBEAT_ACK', {})
          break

        case 'SUBSCRIBE': {
          const { channelId } = event.d as { channelId: string }
          client.subscribedChannels.add(channelId)
          ensureRedisSubscription(channelId)
          break
        }

        case 'UNSUBSCRIBE': {
          const { channelId } = event.d as { channelId: string }
          client.subscribedChannels.delete(channelId)
          break
        }

        case 'TYPING_START': {
          const { channelId } = event.d as { channelId: string }
          for (const [otherId, other] of clients) {
            if (otherId !== userId && other.subscribedChannels.has(channelId)) {
              send(other.ws, 'TYPING_START', { userId, channelId })
            }
          }
          break
        }

        case 'PRESENCE_UPDATE': {
          const { presence } = event.d as { presence: string }
          await db
            .update(users)
            .set({ presence: presence as 'online' | 'idle' | 'offline' | 'ai_assisted', updatedAt: new Date() })
            .where(eq(users.id, userId))
          for (const [, other] of clients) {
            send(other.ws, 'PRESENCE_UPDATE', { userId, presence })
          }
          break
        }
      }
    })

    ws.on('close', async () => {
      clearInterval(heartbeatWatchdog)
      clients.delete(userId)
      metrics.wsConnections--
      await db.update(users).set({ presence: 'offline', updatedAt: new Date() }).where(eq(users.id, userId))
      logger.info({ userId, activeConnections: clients.size }, 'WebSocket client disconnected')
    })

    ws.on('error', (err) => {
      logger.error({ userId, err }, 'WebSocket error')
    })
  })
}
