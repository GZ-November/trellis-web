import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { registerKnowledgeTools } from '../src/knowledge-tools.ts'
import type { TrellisKnowledge } from '../src/knowledge.ts'

const signal = new AbortController().signal

async function setup() {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const knowledge = {
    ingest: vi.fn((request: unknown) => Promise.resolve({ created: true, document: request })),
    search: vi.fn(() => [{ id: 'doc-search', title: 'Found' }]),
    read: vi.fn(() => ({ document: { id: 'doc-read' }, contentTruncated: false, backlinks: [] })),
    connect: vi.fn(() => Promise.resolve({ id: 'rel-connect', targetId: 'doc-target' })),
    graph: vi.fn(() => ({ nodes: [], edges: [], totalDocuments: 0, truncated: false })),
  } as unknown as TrellisKnowledge
  registerKnowledgeTools(ctx, knowledge, 12_345)
  return { ctx, knowledge: knowledge as unknown as {
    ingest: ReturnType<typeof vi.fn>
    search: ReturnType<typeof vi.fn>
    read: ReturnType<typeof vi.fn>
    connect: ReturnType<typeof vi.fn>
    graph: ReturnType<typeof vi.fn>
  } }
}

let call = 0
function execute(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({ signal, callId: CallId(`trellis-tool-${++call}`), name, arguments: args })
}

describe('Trellis knowledge tools', () => {
  it('registers the five public knowledge operations with bounded ingestion', async () => {
    const { ctx } = await setup()
    expect(ctx.tools.schemas().map(tool => tool.name)).toEqual([
      'trellis_ingest',
      'trellis_search',
      'trellis_read',
      'trellis_connect',
      'trellis_graph',
    ])
    expect(ctx.tools.schemas().find(tool => tool.name === 'trellis_ingest')).toMatchObject({
      parameters: { required: ['summary'] },
    })
  })

  it('maps complete and minimal ingestion arguments onto the shared service', async () => {
    const { ctx, knowledge } = await setup()
    const complete = {
      url: 'https://example.com',
      content: 'Provided content',
      file_name: 'source.md',
      media_type: 'text/markdown',
      title: 'Source',
      summary: 'Summary',
      kind: 'document',
      tags: ['study'],
      relations: [{
        target_id: 'doc-target', kind: 'supports', label: 'supports', evidence: 'Direct quote.', confidence: 0.8,
      }],
    }
    const first = await execute(ctx, 'trellis_ingest', complete)
    const second = await execute(ctx, 'trellis_ingest', { summary: 'Paste it', content: 'minimal note' })
    const third = await execute(ctx, 'trellis_ingest', { summary: 'Fetch it', url: 'https://example.org' })

    expect(first.isError).toBe(false)
    expect(second.isError).toBe(false)
    expect(third.isError).toBe(false)
    expect(knowledge.ingest).toHaveBeenNthCalledWith(1, {
      url: complete.url,
      content: complete.content,
      fileName: complete.file_name,
      mediaType: complete.media_type,
      title: complete.title,
      summary: complete.summary,
      kind: complete.kind,
      tags: complete.tags,
      relations: [{
        targetId: 'doc-target', kind: 'supports', label: 'supports', evidence: 'Direct quote.', confidence: 0.8,
      }],
    }, signal)
    expect(knowledge.ingest).toHaveBeenNthCalledWith(2, {
      content: 'minimal note',
      summary: 'Paste it',
    }, signal)
    expect(first.content[0]).toMatchObject({ type: 'text' })
  })

  it('routes search, read, connect, and graph arguments and results', async () => {
    const { ctx, knowledge } = await setup()
    const search = await execute(ctx, 'trellis_search', { query: 'networks', limit: 4 })
    await execute(ctx, 'trellis_search', { query: 'strategy' })
    const read = await execute(ctx, 'trellis_read', { id: 'doc-read' })
    const connect = await execute(ctx, 'trellis_connect', {
      source_id: 'doc-source',
      target_id: 'doc-target',
      kind: 'related',
      evidence: 'They address the same question.',
      confidence: 0.7,
    })
    await execute(ctx, 'trellis_graph', { query: 'strategy', limit: 8 })
    const graph = await execute(ctx, 'trellis_graph', {})

    expect([search, read, connect, graph].every(result => !result.isError)).toBe(true)
    expect(knowledge.search).toHaveBeenNthCalledWith(1, 'networks', 4)
    expect(knowledge.search).toHaveBeenNthCalledWith(2, 'strategy', undefined)
    expect(knowledge.read).toHaveBeenCalledWith('doc-read')
    expect(knowledge.connect).toHaveBeenCalledWith('doc-source', {
      targetId: 'doc-target',
      kind: 'related',
      evidence: 'They address the same question.',
      confidence: 0.7,
    })
    expect(knowledge.graph).toHaveBeenNthCalledWith(1, { query: 'strategy', limit: 8 })
    expect(knowledge.graph).toHaveBeenNthCalledWith(2, {})
  })
})
