import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, ChatMessage, CompletionOptions } from './LLMAdapter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export class AnthropicAdapter implements LLMAdapter {
  async *complete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<string> {
    const stream = await client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.systemPrompt,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}
