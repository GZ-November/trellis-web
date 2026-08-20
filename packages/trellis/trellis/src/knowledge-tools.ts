/**
 * Agent-facing Trellis knowledge tools over the shared knowledge service.
 * @module @trellis/trellis/knowledge-tools
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { KnowledgeRelationKind } from './spec.ts'
import type { TrellisDocumentId } from './types.ts'
import type { TrellisKnowledge, TrellisRelationInput } from './knowledge.ts'

const DOCUMENT_KINDS = ['webpage', 'document', 'note', 'other'] as const
const RELATION_KINDS = ['references', 'supports', 'contradicts', 'extends', 'example', 'related'] as const

const jsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue
const jsonResult = (_args: unknown, value: JsonValue): ContentBlock[] =>
  [{ type: 'text', text: JSON.stringify(value, null, 2) }]

const relationInputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target_id: { type: 'string', required: true, description: 'Existing target document id from trellis_search or trellis_graph.' },
    kind: { type: 'string', required: true, enum: RELATION_KINDS, description: 'Directed semantic relationship.' },
    label: { type: 'string', description: 'Optional concise edge label.' },
    evidence: { type: 'string', required: true, description: 'Passage or concise source-backed explanation for the relationship.' },
    confidence: { type: 'number', required: true, description: 'Confidence from 0 to 1.' },
  },
} as const

function relationInput(input: {
  target_id: string
  kind: string
  label?: string
  evidence: string
  confidence: number
}): TrellisRelationInput {
  return {
    targetId: input.target_id as TrellisDocumentId,
    kind: input.kind as KnowledgeRelationKind,
    ...(input.label === undefined ? {} : { label: input.label }),
    evidence: input.evidence,
    confidence: input.confidence,
  }
}

/**
 * Register ingestion, retrieval, linking, and graph-projection tools.
 * @param ctx - context carrying the tool registry.
 * @param knowledge - shared Trellis knowledge service.
 * @param fetchTimeoutMs - cooperative budget for URL ingestion.
 */
export function registerKnowledgeTools(ctx: Context, knowledge: TrellisKnowledge, fetchTimeoutMs: number): void {
  ctx.tools.register(defineTool({
    name: 'trellis_ingest',
    description: 'Archive and organize a URL, pasted note, or extracted text document in the Trellis knowledge graph. A URL is fetched when content is omitted. Search first and add only evidence-backed relations to existing document ids.',
    parameters: {
      url: { type: 'string', description: 'HTTP(S) source URL. Trellis fetches it when content is omitted.' },
      content: { type: 'string', description: 'Pasted or already-extracted document content.' },
      file_name: { type: 'string', description: 'Original file name when content came from a document.' },
      media_type: { type: 'string', description: 'Original document media type, if known.' },
      title: { type: 'string', description: 'Curated title. Trellis derives one from the URL or file name when omitted.' },
      summary: { type: 'string', required: true, description: 'Concise source-grounded summary useful for later study and retrieval.' },
      kind: { type: 'string', enum: DOCUMENT_KINDS, description: 'Broad knowledge document category.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Normalized topic tags.' },
      relations: { type: 'array', items: relationInputSchema, description: 'Evidence-backed links from this document to existing Trellis documents.' },
    },
    timeoutMs: fetchTimeoutMs,
    output: { schema: { type: 'json' }, render: jsonResult },
    async execute(args, exec): Promise<JsonValue> {
      const result = await knowledge.ingest({
        ...(args.url === undefined ? {} : { url: args.url }),
        ...(args.content === undefined ? {} : { content: args.content }),
        ...(args.file_name === undefined ? {} : { fileName: args.file_name }),
        ...(args.media_type === undefined ? {} : { mediaType: args.media_type }),
        ...(args.title === undefined ? {} : { title: args.title }),
        summary: args.summary,
        ...(args.kind === undefined ? {} : { kind: args.kind }),
        ...(args.tags === undefined ? {} : { tags: args.tags }),
        ...(args.relations === undefined ? {} : { relations: args.relations.map(relationInput) }),
      }, exec.signal)
      return jsonValue({ ok: true, ...result })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_search',
    description: 'Search Trellis knowledge documents by title, topic tag, summary, and full text. Use the returned ids with trellis_read or trellis_connect.',
    parameters: {
      query: { type: 'string', required: true, description: 'Text to find in the knowledge base.' },
      limit: { type: 'integer', description: 'Maximum hits; plugin configuration applies the hard cap.' },
    },
    output: { schema: { type: 'json' }, render: jsonResult },
    execute(args): Promise<JsonValue> {
      return Promise.resolve(jsonValue({ ok: true, query: args.query, matches: knowledge.search(args.query, args.limit) }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_read',
    description: 'Read one Trellis knowledge document, its outgoing relations, and backlinks. The returned body is bounded; source provenance is always included.',
    parameters: {
      id: { type: 'string', required: true, description: 'Document id from trellis_search or trellis_graph.' },
    },
    output: { schema: { type: 'json' }, render: jsonResult },
    execute(args): Promise<JsonValue> {
      return Promise.resolve(jsonValue({ ok: true, ...knowledge.read(args.id as TrellisDocumentId) }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_connect',
    description: 'Create or update an evidence-bearing directed relation between two existing Trellis knowledge documents.',
    parameters: {
      source_id: { type: 'string', required: true, description: 'Document that owns the outgoing relation.' },
      target_id: relationInputSchema.properties.target_id,
      kind: relationInputSchema.properties.kind,
      label: relationInputSchema.properties.label,
      evidence: relationInputSchema.properties.evidence,
      confidence: relationInputSchema.properties.confidence,
    },
    output: { schema: { type: 'json' }, render: jsonResult },
    async execute(args): Promise<JsonValue> {
      const relation = await knowledge.connect(args.source_id as TrellisDocumentId, relationInput(args))
      return jsonValue({ ok: true, source_id: args.source_id, relation })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_graph',
    description: 'Return a bounded node-and-edge projection of the Trellis knowledge graph for interactive visualization. Optionally focus it around a search query.',
    parameters: {
      query: { type: 'string', description: 'Optional topic filter. Matching documents and their direct neighbors are selected.' },
      limit: { type: 'integer', description: 'Maximum nodes; plugin configuration applies the hard cap.' },
    },
    output: { schema: { type: 'json' }, render: jsonResult },
    execute(args): Promise<JsonValue> {
      return Promise.resolve(jsonValue({ ok: true, graph: knowledge.graph({
        ...(args.query === undefined ? {} : { query: args.query }),
        ...(args.limit === undefined ? {} : { limit: args.limit }),
      }) }))
    },
  }))
}
