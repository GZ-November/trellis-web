/** Keyless Trellis scenario: ingest one text document, project its graph, reply. */

import type { Context } from '@deepseek-ai/cordis'
import {
  CallId,
  LlmAdapter,
  ReasoningEffortId,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'

const OFF = ReasoningEffortId('off')

class TrellisMockAdapter extends LlmAdapter {
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      reasoning: { efforts: [{ id: OFF, name: 'Off' }], defaultEffort: OFF },
    })
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const results = options.messages.flatMap(message => message.content.filter(block => block.type === 'tool-result'))
    if (results.length === 0) {
      yield* this.toolCall('trellis-ingest', 'trellis_ingest', {
        content: 'Network effects make a service more useful as more participants join.',
        file_name: 'network-effects.md',
        media_type: 'text/markdown',
        title: 'Network effects',
        summary: 'A concise definition of network effects for study.',
        kind: 'document',
        tags: ['economics', 'strategy'],
      })
      return
    }
    if (results.length === 1) {
      yield* this.toolCall('trellis-graph', 'trellis_graph', {})
      return
    }
    const reply = 'Trellis archived the document and projected the knowledge graph.'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: reply }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: reply } }
    yield { type: 'usage', usage: { inputTokens: 8, outputTokens: 6 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }

  private async * toolCall(id: string, name: string, value: object): AsyncIterable<StreamChunk> {
    const args = JSON.stringify(value)
    const callId = CallId(id)
    yield { type: 'block-start', index: 0, blockType: 'tool-call' }
    yield { type: 'tool-call-delta', index: 0, id: callId, name, argumentsDelta: args }
    yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name, arguments: args } }
    yield { type: 'usage', usage: { inputTokens: 5, outputTokens: 3 } }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  }
}

/** Cordis plugin name. */
export const name = 'trellis-mock-llm'
/** LLM registry required for adapter registration. */
export const inject = ['llm']

/**
 * Register the deterministic Trellis adapter.
 * @param ctx - Loader context carrying the LLM registry.
 */
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['trellis-mock'], new TrellisMockAdapter())
}
