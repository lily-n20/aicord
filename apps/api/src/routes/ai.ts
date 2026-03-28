import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db'
import { aiAgents, channels, memberships, messages, servers } from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { Errors, AppError } from '../lib/errors'
import { aiService } from '../services/ai/AIService'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'

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

const suggestSchema = z.object({
  content: z.string().min(1).max(500),
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

    // Find last summary message to determine window
    const [lastSummaryMsg] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, id),
          eq(messages.authorType, 'ai'),
          sql`${messages.metadata}::jsonb->>'trigger' = 'summarize'`
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(1)

    const since = lastSummaryMsg?.createdAt ?? null
    const countConditions: any[] = [eq(messages.channelId, id), eq(messages.authorType, 'user')]
    if (since) {
      countConditions.push(sql`${messages.createdAt} > ${since}`)
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(...countConditions))

    const messageCount = countResult?.count ?? 0

    const summarizePrompt = since
      ? 'Please provide a concise summary of the recent conversation in this channel since the last summary. Highlight key topics, decisions, and action items. Be brief — 4-6 sentences max.'
      : 'Please provide a concise summary of the recent conversation in this channel (last 50 messages). Highlight key topics, decisions, and action items. Be brief — 4-6 sentences max.'

    const summary = await aiService.invokeAgent(
      agent,
      id,
      'summarize-request',
      summarizePrompt,
      'summarize',
      { summary: true }
    )

    const generatedAt = new Date().toISOString()

    // Emit AI_SUMMARY WS event so clients update their summary bars
    await redis.publish(
      `channel:${id}`,
      JSON.stringify({
        op: 'AI_SUMMARY',
        d: { channelId: id, summary, messageCount, generatedAt },
      })
    )

    logger.info({ channelId: id, messageCount }, 'Channel summarized on demand')

    return { summary, message_count: messageCount, generated_at: generatedAt }
  })

  // POST /channels/:id/ai/suggest — inline ghost-text suggestion (no message stored)
  fastify.post('/channels/:id/ai/suggest', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
    if (!channel) throw Errors.NOT_FOUND('Channel')

    const role = await getMemberRole(channel.serverId, request.user.sub)
    if (!role) throw Errors.FORBIDDEN()

    const body = suggestSchema.safeParse(request.body)
    if (!body.success) throw Errors.VALIDATION_ERROR(body.error.flatten())

    const suggestion = await aiService.generateSuggestion(id, body.data.content)
    return { suggestion }
  })

  // POST /servers/:id/ai/digest — manual digest trigger (owner/admin only)
  fastify.post('/servers/:id/ai/digest', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string }

    const [server] = await db.select().from(servers).where(eq(servers.id, id)).limit(1)
    if (!server) throw Errors.NOT_FOUND('Server')

    const role = await getMemberRole(id, request.user.sub)
    if (!role || !['owner', 'admin'].includes(role)) throw Errors.FORBIDDEN()

    const { DigestService } = await import('../services/ai/DigestService')
    const ds = new DigestService(aiService)
    ds.runDigestsForServer(id).catch((err) =>
      logger.error({ err, serverId: id }, 'Manual digest trigger failed')
    )

    return { status: 'digest_triggered' }
  })
}
