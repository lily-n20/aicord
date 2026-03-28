import { logger } from '../../lib/logger'
import { pool } from '../../db'

// Simple embedding using OpenAI if key available, otherwise skip
async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    })

    if (!res.ok) {
      logger.warn({ status: res.status }, 'OpenAI embeddings API error')
      return null
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  } catch (err) {
    logger.warn({ err }, 'Failed to generate embedding')
    return null
  }
}

export async function embedMessage(messageId: string, channelId: string, content: string, attempt = 1): Promise<void> {
  const embedding = await generateEmbedding(content)
  if (!embedding) return // gracefully skip if embeddings unavailable

  try {
    const embeddingStr = `[${embedding.join(',')}]`
    await pool.query(
      `INSERT INTO ai_contexts (id, channel_id, message_id, embedding, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3::vector, now())
       ON CONFLICT DO NOTHING`,
      [channelId, messageId, embeddingStr]
    )
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * attempt))
      return embedMessage(messageId, channelId, content, attempt + 1)
    }
    logger.error({ err, messageId }, 'Failed to store embedding after 3 attempts')
  }
}

export async function findSimilarMessages(
  channelId: string,
  queryText: string,
  excludeMessageId: string,
  limit = 5
): Promise<Array<{ messageId: string; content: string }>> {
  const embedding = await generateEmbedding(queryText)
  if (!embedding) return []

  try {
    const embeddingStr = `[${embedding.join(',')}]`
    const result = await pool.query<{ message_id: string; content: string }>(
      `SELECT ac.message_id, m.content
       FROM ai_contexts ac
       JOIN messages m ON m.id = ac.message_id
       WHERE ac.channel_id = $1
         AND ac.message_id != $2
         AND m.content != '[deleted]'
       ORDER BY ac.embedding <=> $3::vector
       LIMIT $4`,
      [channelId, excludeMessageId, embeddingStr, limit]
    )
    return result.rows.map((r) => ({ messageId: r.message_id, content: r.content }))
  } catch (err) {
    logger.warn({ err }, 'pgvector similarity search failed, falling back to empty context')
    return []
  }
}
