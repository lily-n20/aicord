interface ContextInput {
  persona: string
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string; username?: string }>
  semanticResults: Array<{ content: string }>
  triggeringMessage: string
}

// Rough token estimate: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface BuiltContext {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

export function buildContext(input: ContextInput, maxTokens = 6000): BuiltContext {
  const { persona, triggeringMessage } = input
  let { recentMessages, semanticResults } = input

  const systemPrompt = persona || 'You are AICORD AI, a helpful assistant embedded in a chat platform. Be concise, helpful, and friendly. When referencing past conversation, cite context naturally.'

  const systemTokens = estimateTokens(systemPrompt)
  const triggerTokens = estimateTokens(triggeringMessage)
  let budget = maxTokens - systemTokens - triggerTokens - 200 // 200 token buffer

  // Build semantic context block
  let semanticBlock = ''
  const filteredSemantic: typeof semanticResults = []
  for (const r of semanticResults) {
    const tokens = estimateTokens(r.content)
    if (budget - tokens > 500) {
      filteredSemantic.push(r)
      budget -= tokens
    }
  }

  if (filteredSemantic.length > 0) {
    semanticBlock = '[Relevant past messages]\n' + filteredSemantic.map((r) => r.content).join('\n---\n') + '\n'
  }

  // Build recent messages, truncating oldest first if over budget
  const filteredRecent: typeof recentMessages = []
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i]
    const tokens = estimateTokens(`${msg.username ?? msg.role}: ${msg.content}`)
    if (budget - tokens > 0) {
      filteredRecent.unshift(msg)
      budget -= tokens
    } else {
      break
    }
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (semanticBlock || filteredRecent.length > 0) {
    const contextContent = [
      semanticBlock,
      filteredRecent.length > 0
        ? '[Recent conversation]\n' + filteredRecent.map((m) => `${m.username ?? m.role}: ${m.content}`).join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    if (contextContent.trim()) {
      messages.push({ role: 'user', content: contextContent })
      messages.push({ role: 'assistant', content: 'I have read the context. How can I help?' })
    }
  }

  messages.push({ role: 'user', content: triggeringMessage })

  return { systemPrompt, messages }
}
