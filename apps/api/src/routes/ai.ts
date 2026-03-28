import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { aiAgents, channels, memberships } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors, AppError } from '../lib/errors'
import { aiService } from '../services/ai/AIService'

async function getMemberRole(serverId: string, userId: string) {
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.serverId, serverId), eq(memberships.userId, userId)))
    .limit(1)
  return m?.role ?? null
}

const upsertAgentSchema = z.object({
  persona: z.string().max(2000).optional(),
  model: z.string().max(100).optional(),
  behavior: z.enum(['passive', 'active']).optional(),
  triggerCount: z.number().int().min(10).max(500).optional(),
  permissions: z.enum(['read_only', 'reply_only', 'full']).optional(),
  enabled: z.boolean().optional(),
})

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /channels/:id/ai
  fastify.get('/channels/:id/ai', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
    if (!channel) throw Errors.NOT_FOUND('Channel')

    const role = await getMemberRole(channel.serverId, request.user.sub)
    if (!role) throw Errors.FORBIDDEN()

    const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.channelId, id)).limit(1)
    return { agent: agent ?? null }
  })

  // PUT /channels/:id/ai
  fastify.put('/channels/:id/ai', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
    if (!channel) throw Errors.NOT_FOUND('Channel')

    if (channel.type === 'text') {
      throw new AppError(
        'INVALID_CHANNEL_TYPE',
        'AI agents can only be configured on ai or digest channels',
        400
      )
    }

    const role = await getMemberRole(channel.serverId, request.user.sub)
    if (!role || !['owner', 'admin'].includes(role)) throw Errors.FORBIDDEN()

    const body = upsertAgentSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const values = {
      channelId: id,
      persona: body.data.persona ?? null,
      model: body.data.model ?? (process.env.AI_DEFAULT_MODEL ?? 'claude-sonnet-4-6'),
      behavior: body.data.behavior ?? 'passive' as const,
      triggerCount: body.data.triggerCount ?? 50,
      permissions: body.data.permissions ?? 'reply_only' as const,
      enabled: body.data.enabled ?? true,
      updatedAt: new Date(),
    }

    const [agent] = await db
      .insert(aiAgents)
      .values(values)
      .onConflictDoUpdate({ target: aiAgents.channelId, set: { ...values } })
      .returning()

    return { agent }
  })

  // POST /channels/:id/ai/summarize
  fastify.post('/channels/:id/ai/summarize', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
    if (!channel) throw Errors.NOT_FOUND('Channel')

    const role = await getMemberRole(channel.serverId, request.user.sub)
    if (!role) throw Errors.FORBIDDEN()

    const [agent] = await db
      .select()
      .from(aiAgents)
      .where(and(eq(aiAgents.channelId, id), eq(aiAgents.enabled, true)))
      .limit(1)

    if (!agent) {
      throw new AppError('NO_AI_AGENT', 'No AI agent configured for this channel', 400)
    }

    const summary = await aiService.invokeAgent(
      agent,
      id,
      'summarize-request',
      'Please provide a concise summary of the recent conversation in this channel. Highlight key topics, decisions, and action items.',
      'summarize'
    )

    return {
      summary,
      message_count: 0,
      generated_at: new Date().toISOString(),
    }
  })
}
