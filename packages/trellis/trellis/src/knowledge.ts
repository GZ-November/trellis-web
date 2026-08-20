/**
 * Source-backed Trellis knowledge service shared by agent tools and views.
 * @module @trellis/trellis/knowledge
 */

import { createHash } from 'node:crypto'
import type { WebRuntime } from '@deepseek-ai/dsh-web'
import { formatFetchOutput } from '@deepseek-ai/dsh-tool-web'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type {
  KnowledgeDocumentKind,
  KnowledgeDocumentRecord,
  KnowledgeRelationKind,
  KnowledgeRelationRecord,
  KnowledgeSource,
} from './spec.ts'
import type { TrellisDocumentId, TrellisRelationId } from './types.ts'
import { convertToMarkdown } from './markitdown.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    trellisKnowledge: TrellisKnowledge
  }
}

/** Resolved limits for stored and returned Trellis knowledge. */
export interface TrellisKnowledgeConfig {
  /** Maximum characters retained for one source. */
  readonly maxContentChars: number
  /** Maximum document characters returned by one read. */
  readonly maxReadChars: number
  /** Maximum search hits returned by one request. */
  readonly maxSearchResults: number
  /** Maximum characters in a search-result excerpt. */
  readonly maxSnippetChars: number
  /** Maximum nodes in one graph snapshot. */
  readonly maxGraphNodes: number
  /** Maximum outgoing relations accepted for one document. */
  readonly maxRelationsPerDocument: number
}

/** Relation proposed while ingesting or connecting documents. */
export interface TrellisRelationInput {
  /** Existing target document. */
  readonly targetId: TrellisDocumentId
  /** Directed relationship semantics. */
  readonly kind: KnowledgeRelationKind
  /** Optional human-readable edge label. */
  readonly label?: string
  /** Source passage or concise explanation supporting this edge. */
  readonly evidence: string
  /** Confidence from 0 through 1. */
  readonly confidence: number
}

/** Input for one idempotent knowledge-document ingestion. */
export interface TrellisIngestRequest {
  /** HTTP(S) source. Fetched when `content` is absent. */
  readonly url?: string
  /** Pasted or already-extracted document text. */
  readonly content?: string
  /** Original file name for pasted file content. */
  readonly fileName?: string
  /** Original file media type. */
  readonly mediaType?: string
  /** Curated title. A URL-derived title is used when omitted. */
  readonly title?: string
  /** Agent-authored concise summary. */
  readonly summary: string
  /** Broad source category. */
  readonly kind?: KnowledgeDocumentKind
  /** Normalized study and retrieval tags. */
  readonly tags?: readonly string[]
  /** Evidence-bearing links to existing Trellis documents. */
  readonly relations?: readonly TrellisRelationInput[]
}

/** Result of an ingestion, including whether an existing source was refreshed. */
export interface TrellisIngestResult {
  readonly created: boolean
  readonly document: KnowledgeDocumentRecord
}

/** Compact knowledge search hit. */
export interface TrellisSearchHit {
  readonly id: TrellisDocumentId
  readonly title: string
  readonly summary: string
  readonly kind: KnowledgeDocumentKind
  readonly tags: readonly string[]
  readonly snippet: string
  readonly score: number
  readonly source: KnowledgeSource
}

/** A complete read plus inbound relations from other documents. */
export interface TrellisDocumentRead {
  readonly document: KnowledgeDocumentRecord
  readonly contentTruncated: boolean
  readonly backlinks: readonly TrellisGraphEdge[]
}

/** Lightweight node sent to graph consumers. */
export interface TrellisGraphNode {
  readonly id: TrellisDocumentId
  readonly title: string
  readonly summary: string
  readonly kind: KnowledgeDocumentKind
  readonly tags: readonly string[]
  readonly sourceLabel: string
}

/** Evidence-bearing directed graph edge. */
export interface TrellisGraphEdge {
  readonly id: TrellisRelationId
  readonly source: TrellisDocumentId
  readonly target: TrellisDocumentId
  readonly kind: KnowledgeRelationKind
  readonly label?: string
  readonly evidence: string
  readonly confidence: number
}

/** One bounded projection of the durable Trellis graph. */
export interface TrellisGraphSnapshot {
  readonly nodes: readonly TrellisGraphNode[]
  readonly edges: readonly TrellisGraphEdge[]
  readonly totalDocuments: number
  readonly truncated: boolean
}

/** Parameters for a graph projection. */
export interface TrellisGraphRequest {
  /** Optional text filter; matching documents and their neighbors are selected. */
  readonly query?: string
  /** Requested node bound, capped by plugin config. */
  readonly limit?: number
}

const timestamp = (): string => new Date().toISOString()

function digest(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
}

function documentId(identity: string): TrellisDocumentId {
  return digest('doc', identity) as TrellisDocumentId
}

function relationId(source: TrellisDocumentId, input: TrellisRelationInput): TrellisRelationId {
  return digest('rel', `${source}\0${input.targetId}\0${input.kind}\0${input.label ?? ''}`) as TrellisRelationId
}

function canonicalUrl(raw: string): string {
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Trellis only ingests HTTP(S) URLs')
  }
  url.hash = ''
  return url.toString()
}

function nonBlank(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new Error(`${field} must not be blank`)
  return trimmed
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(value => value.length > 0))]
}

function sourceLabel(source: KnowledgeSource): string {
  switch (source.type) {
    case 'url': return source.url
    case 'file': return source.name
    case 'pasted': return 'Pasted content'
  }
}

function urlTitle(raw: string): string {
  const url = new URL(raw)
  const path = url.pathname.replace(/\/$/, '')
  return path.length > 0 ? `${url.hostname}${path}` : url.hostname
}

function scoreDocument(document: KnowledgeDocumentRecord, query: string): number {
  const needle = query.toLocaleLowerCase()
  const title = document.title.toLocaleLowerCase()
  const summary = document.summary.toLocaleLowerCase()
  const tags = document.tags.join(' ').toLocaleLowerCase()
  const content = document.content.toLocaleLowerCase()
  let score = 0
  if (title === needle) score += 12
  else if (title.includes(needle)) score += 8
  if (tags.includes(needle)) score += 5
  if (summary.includes(needle)) score += 3
  if (content.includes(needle)) score += 1
  return score
}

function excerpt(document: KnowledgeDocumentRecord, query: string, maxChars: number): string {
  const lower = document.content.toLocaleLowerCase()
  const offset = lower.indexOf(query.toLocaleLowerCase())
  const start = Math.max(0, offset === -1 ? 0 : offset - Math.floor(maxChars / 3))
  const value = document.content.slice(start, start + maxChars).trim()
  return `${start > 0 ? '…' : ''}${value}${start + maxChars < document.content.length ? '…' : ''}`
}

function graphNode(document: KnowledgeDocumentRecord): TrellisGraphNode {
  return {
    id: document.id,
    title: document.title,
    summary: document.summary,
    kind: document.kind,
    tags: document.tags,
    sourceLabel: sourceLabel(document.source),
  }
}

/**
 * Durable knowledge API used by Trellis tools and future interfaces. Source
 * identity determines document ids, so importing the same URL or file refreshes
 * one record instead of creating duplicates.
 */
export class TrellisKnowledge {
  /**
   * @param documents - authoritative durable table.
   * @param web - safe web retrieval capability.
   * @param config - resolved storage and projection limits.
   */
  constructor(
    private readonly documents: KvTable<TrellisDocumentId, KnowledgeDocumentRecord>,
    private readonly web: WebRuntime,
    private readonly config: TrellisKnowledgeConfig,
  ) {}

  /** Current number of knowledge documents. */
  get size(): number {
    return this.documents.size
  }

  /**
   * Check package-owned graph relationships against the authoritative table.
   * @returns the first violated relationship, or `undefined` when consistent.
   */
  diagnose(): string | undefined {
    for (const [, document] of this.documents.entries()) {
      if (document.relations.length > this.config.maxRelationsPerDocument) {
        return `document '${document.id}' has ${document.relations.length} relations, above the configured limit ${this.config.maxRelationsPerDocument}`
      }
      const relationIds = new Set<TrellisRelationId>()
      for (const relation of document.relations) {
        if (relationIds.has(relation.id)) return `document '${document.id}' repeats relation '${relation.id}'`
        relationIds.add(relation.id)
        if (relation.targetId === document.id) return `document '${document.id}' relates to itself`
        if (this.documents.get(relation.targetId) === undefined) {
          return `document '${document.id}' relation '${relation.id}' targets missing document '${relation.targetId}'`
        }
      }
    }
    return undefined
  }

  /**
   * Fetch or accept a source, validate every proposed target, then durably
   * create or refresh its record. A failed fetch or relation validation writes
   * nothing.
   * @param request - source, organization metadata, and proposed relations.
   * @param signal - cancellation forwarded to web retrieval.
   * @returns the stored record and whether it was newly created.
   */
  async ingest(request: TrellisIngestRequest, signal?: AbortSignal): Promise<TrellisIngestResult> {
    if (request.url === undefined && request.content === undefined) {
      throw new Error('trellis_ingest requires url or content')
    }
    const summary = nonBlank(request.summary, 'summary')
    const requestedRelations = request.relations ?? []
    if (requestedRelations.length > this.config.maxRelationsPerDocument) {
      throw new Error(`relations exceeds configured limit ${this.config.maxRelationsPerDocument}`)
    }
    for (const relation of requestedRelations) this.validateRelationInput(relation)

    let content: string
    let source: KnowledgeSource
    let identity: string
    let inferredTitle: string
    if (request.url !== undefined) {
      const requestedUrl = canonicalUrl(request.url)
      identity = `url:${requestedUrl}`
      inferredTitle = request.title ?? urlTitle(requestedUrl)
      if (request.content === undefined) {
        const fetched = await this.web.fetch({ url: requestedUrl }, signal)
        if (fetched.statusCode < 200 || fetched.statusCode >= 300) {
          throw new Error(`Trellis could not ingest ${fetched.url}: HTTP ${fetched.statusCode}`)
        }
        const raw = formatFetchOutput(fetched, this.config.maxContentChars)
        const parsed = convertToMarkdown(raw, inferredTitle)
        content = parsed.markdown.slice(0, this.config.maxContentChars)
        source = {
          type: 'url',
          url: fetched.url,
          retrieval: 'fetched',
          statusCode: fetched.statusCode,
          fetchedAt: timestamp(),
          truncated: fetched.truncated || (fetched.body.kind === 'text' && fetched.body.content.length > this.config.maxContentChars) || raw.length >= this.config.maxContentChars || content.length >= this.config.maxContentChars,
        }
      } else {
        const full = nonBlank(request.content, 'content')
        const parsed = convertToMarkdown(full, inferredTitle)
        content = parsed.markdown.slice(0, this.config.maxContentChars)
        source = {
          type: 'url',
          url: requestedUrl,
          retrieval: 'provided',
          truncated: content.length !== full.length || full.length > this.config.maxContentChars,
        }
      }
    } else {
      const full = nonBlank(request.content as string, 'content')
      const parsed = convertToMarkdown(full, request.title ?? request.fileName)
      content = parsed.markdown.slice(0, this.config.maxContentChars)
      if (request.fileName !== undefined) {
        const fileName = nonBlank(request.fileName, 'fileName')
        identity = `file:${fileName.toLocaleLowerCase()}`
        inferredTitle = request.title ?? fileName
        source = {
          type: 'file',
          name: fileName,
          ...(request.mediaType !== undefined ? { mediaType: request.mediaType } : {}),
        }
      } else {
        identity = `pasted:${digest('content', full)}`
        inferredTitle = request.title ?? 'Pasted note'
        source = { type: 'pasted' }
      }
    }

    const id = documentId(identity)
    for (const relation of requestedRelations) {
      if (relation.targetId === id) throw new Error('a Trellis document cannot link to itself')
      if (this.documents.get(relation.targetId) === undefined) {
        throw new Error(`relation target not found: ${relation.targetId}`)
      }
    }
    const existing = this.documents.get(id)
    const storedAt = timestamp()
    const relations = new Map(existing?.relations.map(relation => [relation.id, relation]) ?? [])
    for (const input of requestedRelations) {
      const id = relationId(existing?.id ?? documentId(identity), input)
      relations.set(id, {
        id,
        targetId: input.targetId,
        kind: input.kind,
        ...(input.label === undefined ? {} : { label: nonBlank(input.label, 'relation label') }),
        evidence: nonBlank(input.evidence, 'relation evidence'),
        confidence: input.confidence,
        createdAt: relations.get(id)?.createdAt ?? storedAt,
      })
    }
    if (relations.size > this.config.maxRelationsPerDocument) {
      throw new Error(`document relation limit ${this.config.maxRelationsPerDocument} reached`)
    }
    const document: KnowledgeDocumentRecord = {
      id,
      kind: request.kind ?? existing?.kind ?? (source.type === 'url' ? 'webpage' : source.type === 'file' ? 'document' : 'note'),
      title: request.title === undefined ? existing?.title ?? inferredTitle : nonBlank(request.title, 'title'),
      content,
      summary,
      tags: uniqueStrings(request.tags ?? existing?.tags ?? []),
      source,
      relations: [...relations.values()],
      createdAt: existing?.createdAt ?? storedAt,
      updatedAt: storedAt,
    }
    await this.documents.put(id, document)
    return { created: existing === undefined, document }
  }

  /**
   * Search titles, tags, summaries, and bodies with deterministic local ranking.
   * @param query - non-blank search text.
   * @param limit - requested hit count, capped by config.
   * @returns ranked compact hits.
   */
  search(query: string, limit?: number): TrellisSearchHit[] {
    const normalized = nonBlank(query, 'query')
    const cappedLimit = Math.min(limit ?? this.config.maxSearchResults, this.config.maxSearchResults)
    if (!Number.isSafeInteger(cappedLimit) || cappedLimit <= 0) throw new Error('limit must be a positive integer')
    return [...this.documents.entries()]
      .map(([, document]) => ({ document, score: scoreDocument(document, normalized) }))
      .filter(result => result.score > 0)
      .sort((left, right) => right.score - left.score || right.document.updatedAt.localeCompare(left.document.updatedAt))
      .slice(0, cappedLimit)
      .map(({ document, score }) => ({
        id: document.id,
        title: document.title,
        summary: document.summary,
        kind: document.kind,
        tags: document.tags,
        snippet: excerpt(document, normalized, this.config.maxSnippetChars),
        score,
        source: document.source,
      }))
  }

  /**
   * Read one document, clipping only the returned body while retaining the
   * durable record unchanged.
   * @param id - document id.
   * @returns the bounded document and every inbound relation.
   */
  read(id: TrellisDocumentId): TrellisDocumentRead {
    const existing = this.documents.get(id)
    if (existing === undefined) throw new Error(`Trellis document not found: ${id}`)
    const content = existing.content.slice(0, this.config.maxReadChars)
    const backlinks: TrellisGraphEdge[] = []
    for (const [, source] of this.documents.entries()) {
      for (const relation of source.relations) {
        if (relation.targetId === id) backlinks.push(this.edge(source.id, relation))
      }
    }
    return {
      document: { ...existing, content },
      contentTruncated: content.length !== existing.content.length,
      backlinks,
    }
  }

  /**
   * Create or replace one evidence-bearing directed relation. Both endpoints
   * must already exist, and the source update is atomic.
   * @param sourceId - document that owns the outgoing relation.
   * @param input - target, semantics, evidence, and confidence.
   * @returns the stored relation.
   */
  async connect(sourceId: TrellisDocumentId, input: TrellisRelationInput): Promise<KnowledgeRelationRecord> {
    this.validateRelationInput(input)
    if (sourceId === input.targetId) throw new Error('a Trellis document cannot link to itself')
    if (this.documents.get(input.targetId) === undefined) {
      throw new Error(`relation target not found: ${input.targetId}`)
    }
    const id = relationId(sourceId, input)
    let stored: KnowledgeRelationRecord | undefined
    await this.documents.update(sourceId, (document) => {
      const previous = document.relations.find(relation => relation.id === id)
      if (previous === undefined && document.relations.length >= this.config.maxRelationsPerDocument) {
        throw new Error(`document relation limit ${this.config.maxRelationsPerDocument} reached`)
      }
      stored = {
        id,
        targetId: input.targetId,
        kind: input.kind,
        ...(input.label === undefined ? {} : { label: nonBlank(input.label, 'relation label') }),
        evidence: nonBlank(input.evidence, 'relation evidence'),
        confidence: input.confidence,
        createdAt: previous?.createdAt ?? timestamp(),
      }
      return {
        ...document,
        relations: previous === undefined
          ? [...document.relations, stored]
          : document.relations.map(relation => relation.id === id ? stored as KnowledgeRelationRecord : relation),
        updatedAt: timestamp(),
      }
    })
    return stored as KnowledgeRelationRecord
  }

  /**
   * List all stored documents with their metadata and relations.
   * @returns all stored document records sorted by newest update.
   */
  listAll(): KnowledgeDocumentRecord[] {
    return [...this.documents.entries()]
      .map(([, document]) => document)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  /**
   * Project a bounded graph from current records. A query selects matching
   * documents followed by their direct neighbors; otherwise newest documents
   * are selected.
   * @param request - optional text filter and node limit.
   * @returns nodes, in-snapshot edges, total size, and truncation state.
   */
  graph(request: TrellisGraphRequest = {}): TrellisGraphSnapshot {
    const limit = Math.min(request.limit ?? this.config.maxGraphNodes, this.config.maxGraphNodes)
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer')
    const all = [...this.documents.entries()].map(([, document]) => document)
    let selected: KnowledgeDocumentRecord[]
    if (request.query !== undefined) {
      const hits = this.search(request.query, limit)
      const seedIds = new Set<TrellisDocumentId>(hits.map(hit => hit.id))
      const ids = new Set(seedIds)
      for (const document of all) {
        if (ids.size >= limit) break
        if (document.relations.some(relation => seedIds.has(relation.targetId))) ids.add(document.id)
        for (const relation of document.relations) {
          if (seedIds.has(document.id) && ids.size < limit) ids.add(relation.targetId)
        }
      }
      selected = all.filter(document => ids.has(document.id)).slice(0, limit)
    } else {
      selected = all.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, limit)
    }
    const selectedIds = new Set(selected.map(document => document.id))
    const edges = selected.flatMap(document => document.relations
      .filter(relation => selectedIds.has(relation.targetId))
      .map(relation => this.edge(document.id, relation)))
    return {
      nodes: selected.map(graphNode),
      edges,
      totalDocuments: all.length,
      truncated: selected.length < all.length,
    }
  }

  private validateRelationInput(input: TrellisRelationInput): void {
    nonBlank(input.evidence, 'relation evidence')
    if (input.label !== undefined) nonBlank(input.label, 'relation label')
    if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
      throw new Error('relation confidence must be between 0 and 1')
    }
  }

  private edge(source: TrellisDocumentId, relation: KnowledgeRelationRecord): TrellisGraphEdge {
    return {
      id: relation.id,
      source,
      target: relation.targetId,
      kind: relation.kind,
      ...(relation.label === undefined ? {} : { label: relation.label }),
      evidence: relation.evidence,
      confidence: relation.confidence,
    }
  }
}
