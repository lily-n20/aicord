import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from '../../db'
import { messages, channels, aiAgents, users } from '../../db/schema'
import { redis } from '../../lib/redis'
import { logger } from '../../lib/logger'
import { embedMessage, findSimilarMessages } from './EmbeddingService'
import { buildContext } from './ContextBuilder'
import type { LLMAdapter } from './LLMAdapter'
import { AnthropicAdapter } from './AnthropicAdapter'
import { MockAdapter } from './MockAdapter'
import { metrics } from '../../middleware/requestLogger'

const AI_MENTION_RE = /@ai\b/i

function getAdapter(): LLMAdapter {
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicAdapter()
  return new MockAdapter('I am AICORD AI. The Anthropic API key is not configured.')
}

export class AIService {
  private adapter: LLMAdapter

  constructor(adapter?: LLMAdapter) {
    this.adapter = adapter ?? getAdapter()
  }

  async handleNewMessage(messageId: string, channelId: string, content: string, authorId: string): Promise<void> {
    // Embed async, non-blocking
    embedMessage(messageId, channelId, content).catch((err) =>
      logger.error({ err, messageId }, 'Background embedding failed')
    )

    const [agent] = await db
      .select()
      .from(aiAgents)
      .where(and(eq(aiAgents.channelId, channelId), eq(aiAgents.enabled, true)))
      .limit(1)

    if (!agent) return

    const hasMention = AI_MENTION_RE.test(content)
    const canReply = agent.permissions === 'reply_only' || agent.permissions === 'full'
    const canAutoPost = agent.permissions === 'full' && agent.behavior === 'active'

    if (hasMention && canReply) {
      await this.invokeAgent(agent, channelId, messageId, content, 'mention')
      return
    }

    if (canAutoPost) {
      await this.checkAutoTrigger(agent, channelId, messageId, content)
    }
  }

  private async checkAutoTrigger(
    agent: typeof aiAgents.$inferSelect,
    channelId: string,
    messageId: string,
    content: string
  ): Promise<void> {
    const [lastAIMsg] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.channelId, channelId), eq(messages.authorType, 'ai')))
      .orderBy(desc(messages.createdAt))
      .limit(1)

    const conditions = [eq(messages.channelId, channelId), eq(messages.authorType, 'user')]
    if (lastAIMsg) {
      conditions.push(sql`${messages.createdAt} > ${lastAIMsg.createdAt}` as any)
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(...conditions))

    const count = result[0]?.count ?? 0
    if (count >= agent.triggerCount) {
      await this.invokeAgent(agent, channelId, messageId, content, 'auto')
    }
  }

  /** Generate an inline reply suggestion without creating a message in the channel */
  async generateSuggestion(
    channelId: string,
    draftContent: string
  ): Promise<string | null> {
    const [agent] = await db
      .select()
      .from(aiAgents)
      .where(and(eq(aiAgents.channelId, channelId), eq(aiAgents.enabled, true)))
      .limit(1)

    if (!agent) return null

    const recentRows = await db
      .select({ content: messages.content, authorType: messages.authorType })
      .from(messages)
      .where(and(eq(messages.channelId, channelId), eq(sql`${messages.content} != '[deleted]'`, true)))
      .orderBy(desc(messages.createdAt))
      .limit(10)

    const history = recentRows.reverse().map((r) => ({
      role: (r.authorType === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: r.content,
    }))

    const systemPrompt = [
      agent.persona ?? 'You are AICORD AI, a helpful assistant.',
      '',
      'The user is drafting a message. Suggest a concise, natural completion or reply (1-2 sentences max).',
      'Return ONLY the suggested text — no preamble, no quotes.',
    ].join('\n')

    const suggestionMessages = [
      ...history,
      {
        role: 'user' as const,
        content: `I am drafting this message: "${draftContent}"\n\nSuggest a concise completion or reply for me to send.`,
      },
    ]

    try {
      const startMs = Date.now()
      let suggestion = ''
      for await (const token of this.adapter.complete(suggestionMessages, {
        model: agent.model,
        maxTokens: 120,
        systemPrompt,
      })) {
        suggestion += token
      }
      logger.info(
        { channelId, model: agent.model, latencyMs: Date.now() - startMs },
        'AI suggestion generated'
      )
      return suggestion.trim() || null
    } catch (err) {
      logger.warn({ err, channelId }, 'Suggestion generation failed')
      return null
    }
  }

  /** Convenience wrapper for digest — posts with metadata.digest flag */
  async invokeDigest(
    agent: typeof aiAgents.$inferSelect,
    channelId: string,
    prompt: string
  ): Promise<string> {
    return this.invokeAgent(agent, channelId, 'digest', prompt, 'summarize', { digest: true })
  }

  async invokeAgent(
    agent: typeof aiAgents.$inferSelect,
    channelId: string,
    triggeringMessageId: string,
    triggeringContent: string,
    trigger: 'mention' | 'auto' | 'summarize',
    extraMeta: Record<string, unknown> = {}
  ): Promise<string> {
    const startMs = Date.now()
    metrics.aiInvocations++

    // Fetch recent messages (last 30)
    const recentRows = await db
      .select({
        id: messages.id,
        content: messages.content,
        authorType: messages.authorType,
        authorId: messages.authorId,
        username: users.username,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(and(eq(messages.channelId, channelId), eq(sql`${messages.content} != '[deleted]'`, true)))
      .orderBy(desc(messages.createdAt))
      .limit(30)

    const recentMessages = recentRows
      .reverse()
      .filter((r) => r.id !== triggeringMessageId)
      .map((r) => ({
        role: (r.authorType === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: r.content,
        username: r.username ?? undefined,
      }))

    // Semantic retrieval
    const semanticResults = await findSimilarMessages(channelId, triggeringContent, triggeringMessageId)

    const context = buildContext({
      persona: agent.persona ?? '',
      recentMessages,
      semanticResults,
      triggeringMessage: triggeringContent,
    })

    const baseMeta = { streaming: true, trigger, auto_triggered: trigger === 'auto', ...extraMeta }

    // Create a placeholder streaming message
    const [aiMsg] = await db
      .insert(messages)
      .values({
        channelId,
        authorId: null,
        authorType: 'ai',
        content: '',
        metadata: JSON.stringify(baseMeta),
      })
      .returning()

    // Broadcast streaming start
    await redis.publish(
      `channel:${channelId}`,
      JSON.stringify({
        op: 'MESSAGE_CREATE',
        d: {
          id: aiMsg.id,
          channelId,
          authorId: null,
          authorType: 'ai',
          content: '',
          metadata: baseMeta,
          editedAt: null,
          createdAt: aiMsg.createdAt.toISOString(),
          author: null,
        },
      })
    )

    let fullContent = ''
    let interrupted = false
    let tokenCount = 0

    try {
      for await (const token of this.adapter.complete(context.messages, {
        model: agent.model,
        maxTokens: parseInt(process.env.AI_MAX_TOKENS ?? '1024', 10),
        systemPrompt: context.systemPrompt,
      })) {
        fullContent += token
        tokenCount++
        await redis.publish(
          `channel:${channelId}`,
          JSON.stringify({
            op: 'MESSAGE_UPDATE',
            d: {
              id: aiMsg.id,
              channelId,
              authorId: null,
              authorType: 'ai',
              content: fullContent,
              metadata: { streaming: true, ...extraMeta },
              editedAt: null,
              createdAt: aiMsg.createdAt.toISOString(),
              author: null,
            },
          })
        )
      }
    } catch (err) {
      logger.error({ err, channelId }, 'LLM stream error')
      interrupted = true
      if (!fullContent) fullContent = "I'm having trouble responding right now."
    }

    const latencyMs = Date.now() - startMs
    // Estimate prompt tokens as chars/4
    const promptTokensEstimate = Math.ceil(
      (context.systemPrompt.length + context.messages.reduce((acc, m) => acc + m.content.length, 0)) / 4
    )

    logger.info(
      {
        channelId,
        model: agent.model,
        trigger,
        latencyMs,
        completionTokensEstimate: tokenCount,
        promptTokensEstimate,
        interrupted,
        ...extraMeta,
      },
      'AI agent invocation complete'
    )

    const finalMeta = {
      streaming: false,
      trigger,
      auto_triggered: trigger === 'auto',
      interrupted,
      ...extraMeta,
    }

    // Persist final content
    await db
      .update(messages)
      .set({
        content: fullContent,
        metadata: JSON.stringify(finalMeta),
      })
      .where(eq(messages.id, aiMsg.id))

    // Broadcast final message
    await redis.publish(
      `channel:${channelId}`,
      JSON.stringify({
        op: 'MESSAGE_UPDATE',
        d: {
          id: aiMsg.id,
          channelId,
          authorId: null,
          authorType: 'ai',
          content: fullContent,
          metadata: finalMeta,
          editedAt: null,
          createdAt: aiMsg.createdAt.toISOString(),
          author: null,
        },
      })
    )

    return fullContent
  }
}

export const aiService = new AIService()
