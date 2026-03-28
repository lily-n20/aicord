export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface CompletionOptions {
  model: string
  maxTokens: number
  systemPrompt: string
}

export interface LLMAdapter {
  complete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<string>
}
