import type { LLMAdapter, ChatMessage, CompletionOptions } from './LLMAdapter'

export class MockAdapter implements LLMAdapter {
  constructor(private readonly response: string = 'This is a mock AI response.') {}

  async *complete(_messages: ChatMessage[], _options: CompletionOptions): AsyncIterable<string> {
    const words = this.response.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise((r) => setTimeout(r, 10))
    }
  }
}
