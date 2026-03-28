import { eq, ne, desc, and, sql } from 'drizzle-orm'
import { db } from '../../db'
import { servers, channels, aiAgents, messages } from '../../db/schema'
import { logger } from '../../lib/logger'
import type { AIService } from './AIService'

const DIGEST_INTERVAL_MS = parseInt(
  process.env.DIGEST_INTERVAL_MS ?? String(6 * 60 * 60 * 1000),
  10
)

export class DigestService {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private aiService: AIService) {}

  start() {
    this.timer = setInterval(() => {
      this.runDigests().catch((err) => logger.error({ err }, 'Scheduled digest run failed'))
    }, DIGEST_INTERVAL_MS)
    logger.info({ intervalMs: DIGEST_INTERVAL_MS }, 'DigestService started')
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async runDigestsForServer(serverId: string): Promise<void> {
    const [digestChannel] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.serverId, serverId), eq(channels.type, 'digest')))
      .limit(1)

    if (!digestChannel) return

    const [agent] = await db
      .select()
      .from(aiAgents)
      .where(and(eq(aiAgents.channelId, digestChannel.id), eq(aiAgents.enabled, true)))
      .limit(1)

    if (!agent) return

    // Find last digest message to determine since-when window
    const [lastDigestMsg] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.channelId, digestChannel.id), eq(messages.authorType, 'ai')))
      .orderBy(desc(messages.createdAt))
      .limit(1)

    const since = lastDigestMsg?.createdAt ?? new Date(Date.now() - DIGEST_INTERVAL_MS)

    // Collect activity from all non-digest channels
    const textChannels = await db
      .select()
      .from(channels)
      .where(and(eq(channels.serverId, serverId), ne(channels.type, 'digest')))

    const sections: string[] = []

    for (const ch of textChannels) {
      const recentMsgs = await db
        .select({ content: messages.content })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, ch.id),
            eq(messages.authorType, 'user'),
            sql`${messages.createdAt} > ${since}`
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(50)

      if (recentMsgs.length < 2) continue

      const combined = recentMsgs
        .reverse()
        .map((m) => m.content)
        .join('\n')

      sections.push(`**#${ch.name}** (${recentMsgs.length} messages since last digest):\n${combined}`)
    }

    if (sections.length === 0) {
      logger.info({ serverId }, 'No activity for digest, skipping')
      return
    }

    const channelSummaries = sections.join('\n\n---\n\n')
    const prompt = [
      'You are generating a digest summary for a community server.',
      'For each channel section below, write 2-3 concise bullet points covering key topics, decisions, and action items.',
      'Keep each section short. Format as: **#channel-name** → bullets.',
      '',
      channelSummaries,
    ].join('\n')

    const digestAgent = { ...agent, model: agent.model }
    await this.aiService.invokeDigest(digestAgent, digestChannel.id, prompt)

    logger.info(
      { serverId, channelCount: sections.length },
      'Digest completed'
    )
  }

  async runDigests(): Promise<void> {
    const allServers = await db.select({ id: servers.id }).from(servers)
    logger.info({ count: allServers.length }, 'Running digests for all servers')

    for (const server of allServers) {
      await this.runDigestsForServer(server.id).catch((err) =>
        logger.error({ err, serverId: server.id }, 'Digest failed for server')
      )
    }
  }
}
