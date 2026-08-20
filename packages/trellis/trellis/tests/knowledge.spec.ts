import { describe, expect, it, vi } from 'vitest'
import type { WebFetchResult, WebRuntime } from '@deepseek-ai/dsh-web'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import { TrellisKnowledge } from '../src/knowledge.ts'
import type { KnowledgeDocumentRecord } from '../src/spec.ts'
import type { TrellisDocumentId } from '../src/types.ts'

class MemoryTable<K extends string, V> implements KvTable<K, V> {
  private readonly records = new Map<K, V>()

  get size(): number { return this.records.size }
  get(key: K): V | undefined { return this.records.get(key) }
  entries(): IterableIterator<[K, V]> { return new Map(this.records).entries() }
  keys(): IterableIterator<K> { return new Map(this.records).keys() }
  put(key: K, value: V): Promise<void> { this.records.set(key, value); return Promise.resolve() }
  delete(key: K): Promise<boolean> { return Promise.resolve(this.records.delete(key)) }
  update(key: K, fn: (current: V) => V): Promise<V> {
    const current = this.records.get(key)
    if (current === undefined) return Promise.reject(new Error(`missing key: ${key}`))
    const next = fn(current)
    this.records.set(key, next)
    return Promise.resolve(next)
  }
}

const config = {
  maxContentChars: 1_000,
  maxReadChars: 80,
  maxSearchResults: 10,
  maxSnippetChars: 40,
  maxGraphNodes: 20,
  maxRelationsPerDocument: 4,
}

function setup(result?: WebFetchResult, overrides: Partial<typeof config> = {}) {
  const fetch = vi.fn(() => Promise.resolve(result ?? {
    url: 'https://example.com/research',
    statusCode: 200,
    body: { kind: 'html' as const, content: '<h1>Graph Research</h1><p>Linked knowledge supports study.</p>' },
    truncated: false,
  }))
  const web = { fetch } as unknown as WebRuntime
  const table = new MemoryTable<TrellisDocumentId, KnowledgeDocumentRecord>()
  return { fetch, table, knowledge: new TrellisKnowledge(table, web, { ...config, ...overrides }) }
}

function relation(targetId: TrellisDocumentId, over: Partial<KnowledgeDocumentRecord['relations'][number]> = {}) {
  return {
    id: 'rel-test' as KnowledgeDocumentRecord['relations'][number]['id'],
    targetId,
    kind: 'related' as const,
    evidence: 'Grounded relation.',
    confidence: 0.5,
    createdAt: '2026-08-19T00:00:00.000Z',
    ...over,
  }
}

function document(id: string, relations: KnowledgeDocumentRecord['relations'] = []): KnowledgeDocumentRecord {
  return {
    id: id as TrellisDocumentId,
    kind: 'note',
    title: id,
    content: id,
    summary: id,
    tags: [],
    source: { type: 'pasted' },
    relations,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  }
}

describe('TrellisKnowledge', () => {
  it('fetches a URL, stores source provenance, and refreshes the same deterministic document', async () => {
    const { fetch, knowledge } = setup()
    const first = await knowledge.ingest({
      url: 'https://example.com/research#section',
      summary: 'Research about connected knowledge.',
      tags: ['Research', ' study ', 'Research'],
    })
    const refreshed = await knowledge.ingest({
      url: 'https://example.com/research',
      summary: 'Updated connected-knowledge research.',
      title: 'Knowledge graph research',
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(first.created).toBe(true)
    expect(refreshed.created).toBe(false)
    expect(refreshed.document.id).toBe(first.document.id)
    expect(first.document.content).toContain('# Graph Research')
    expect(first.document.tags).toEqual(['Research', 'study'])
    expect(first.document.source).toMatchObject({
      type: 'url',
      url: 'https://example.com/research',
      retrieval: 'fetched',
      statusCode: 200,
    })
  })

  it('connects existing documents with evidence visible in graph and backlinks', async () => {
    const { knowledge } = setup()
    const source = await knowledge.ingest({ content: 'Alpha studies networks.', summary: 'Alpha summary.', title: 'Alpha' })
    const target = await knowledge.ingest({ content: 'Beta extends alpha.', summary: 'Beta summary.', title: 'Beta' })

    const relation = await knowledge.connect(source.document.id, {
      targetId: target.document.id,
      kind: 'extends',
      evidence: 'Beta applies the network method introduced by Alpha.',
      confidence: 0.91,
    })
    const graph = knowledge.graph()
    const read = knowledge.read(target.document.id)

    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toEqual([expect.objectContaining({
      id: relation.id,
      source: source.document.id,
      target: target.document.id,
      kind: 'extends',
      confidence: 0.91,
    })])
    expect(read.backlinks).toEqual(graph.edges)
  })

  it('rejects an unknown relation target before writing the source', async () => {
    const { knowledge, table } = setup()
    await expect(knowledge.ingest({
      content: 'Uncommitted source.',
      summary: 'Should not be stored.',
      relations: [{
        targetId: 'doc-missing' as TrellisDocumentId,
        kind: 'related',
        evidence: 'No durable target exists.',
        confidence: 0.5,
      }],
    })).rejects.toThrow('relation target not found')
    expect(table.size).toBe(0)
  })

  it('ranks title matches above body-only matches and bounds read content', async () => {
    const { knowledge } = setup()
    const body = await knowledge.ingest({
      content: `${'long '.repeat(30)}portfolio construction`,
      summary: 'A long note.',
      title: 'General finance note',
    })
    const title = await knowledge.ingest({
      content: 'Short content.',
      summary: 'Direct title match.',
      title: 'Portfolio construction',
    })

    expect(knowledge.search('portfolio construction').map(hit => hit.id)).toEqual([
      title.document.id,
      body.document.id,
    ])
    const read = knowledge.read(body.document.id)
    expect(read.document.content).toHaveLength(config.maxReadChars)
    expect(read.contentTruncated).toBe(true)
  })

  it('accepts provided URLs, files, and pasted text with stable source identities and defaults', async () => {
    const { fetch, knowledge } = setup(undefined, { maxContentChars: 12 })
    const url = await knowledge.ingest({
      url: 'https://example.com/#fragment',
      content: 'provided content is clipped',
      summary: 'Provided URL.',
    })
    const file = await knowledge.ingest({
      content: 'file body', fileName: 'Study.MD', summary: 'File.', tags: [' ', 'Study'],
    })
    const refreshedFile = await knowledge.ingest({
      content: 'new file body', fileName: 'study.md', summary: 'Refreshed file.',
    })
    const pasted = await knowledge.ingest({ content: 'pasted body', summary: 'Pasted.' })

    expect(fetch).not.toHaveBeenCalled()
    expect(url.document).toMatchObject({
      title: 'example.com',
      kind: 'webpage',
      source: { type: 'url', retrieval: 'provided', url: 'https://example.com/', truncated: true },
    })
    expect(file.document).toMatchObject({
      title: 'Study.MD', kind: 'document', tags: ['Study'], source: { type: 'file', name: 'Study.MD' },
    })
    expect(refreshedFile.created).toBe(false)
    expect(refreshedFile.document.id).toBe(file.document.id)
    expect(refreshedFile.document.title).toBe('Study.MD')
    expect(refreshedFile.document.tags).toEqual(['Study'])
    expect(pasted.document).toMatchObject({ title: 'Pasted note', kind: 'note', source: { type: 'pasted' } })
    expect(knowledge.graph().nodes.map(node => node.sourceLabel).sort()).toEqual([
      'Pasted content', 'study.md', 'https://example.com/',
    ].sort())
  })

  it('retains file media types and explicit organization metadata', async () => {
    const { knowledge } = setup()
    const stored = await knowledge.ingest({
      content: 'Report content.',
      fileName: 'report.csv',
      mediaType: 'text/csv',
      title: 'Quarterly report',
      summary: 'A finance report.',
      kind: 'other',
      tags: ['finance', 'finance'],
    })
    expect(stored.document).toMatchObject({
      title: 'Quarterly report',
      kind: 'other',
      tags: ['finance'],
      source: { type: 'file', name: 'report.csv', mediaType: 'text/csv' },
    })
  })

  it('rejects invalid ingestion inputs before a durable write', async () => {
    const { knowledge, table } = setup()
    const invalid = [
      knowledge.ingest({ summary: 'Missing source.' }),
      knowledge.ingest({ content: 'body', summary: '   ' }),
      knowledge.ingest({ url: 'ftp://example.com/file', summary: 'Bad protocol.' }),
      knowledge.ingest({ content: '   ', summary: 'Blank body.' }),
      knowledge.ingest({ content: 'body', fileName: '  ', summary: 'Blank file.' }),
      knowledge.ingest({ content: 'body', title: '  ', summary: 'Blank title.' }),
      knowledge.ingest({
        content: 'body', summary: 'Too many relations.',
        relations: Array.from({ length: config.maxRelationsPerDocument + 1 }, () => ({
          targetId: 'doc-any' as TrellisDocumentId,
          kind: 'related' as const,
          evidence: 'Evidence.',
          confidence: 0.5,
        })),
      }),
      knowledge.ingest({
        content: 'body', summary: 'Blank evidence.',
        relations: [{ targetId: 'doc-any' as TrellisDocumentId, kind: 'related', evidence: ' ', confidence: 0.5 }],
      }),
      knowledge.ingest({
        content: 'body', summary: 'Bad confidence.',
        relations: [{ targetId: 'doc-any' as TrellisDocumentId, kind: 'related', evidence: 'Evidence.', confidence: 2 }],
      }),
    ]
    const messages = await Promise.all(invalid.map(request => request.then(
      () => 'unexpected success',
      (error: unknown) => error instanceof Error ? error.message : String(error),
    )))
    expect(messages).toEqual(expect.arrayContaining([
      expect.stringContaining('requires url or content'),
      expect.stringContaining('summary must not be blank'),
      expect.stringContaining('HTTP(S)'),
      expect.stringContaining('content must not be blank'),
      expect.stringContaining('fileName must not be blank'),
      expect.stringContaining('title must not be blank'),
      expect.stringContaining('relations exceeds configured limit'),
      expect.stringContaining('relation evidence must not be blank'),
      expect.stringContaining('relation confidence must be between 0 and 1'),
    ]))
    expect(table.size).toBe(0)
  })

  it('rejects both low and high HTTP failures and records either truncation signal', async () => {
    for (const statusCode of [199, 300]) {
      const { knowledge, table } = setup({
        url: 'https://example.com/failure', statusCode,
        body: { kind: 'text', content: 'failure' }, truncated: false,
      })
      await expect(knowledge.ingest({ url: 'https://example.com/failure', summary: 'Failure.' }))
        .rejects.toThrow(`HTTP ${statusCode}`)
      expect(table.size).toBe(0)
    }

    const upstream = setup({
      url: 'https://example.com/upstream', statusCode: 200,
      body: { kind: 'text', content: 'short' }, truncated: true,
    })
    expect((await upstream.knowledge.ingest({ url: 'https://example.com/upstream', summary: 'Truncated.' }))
      .document.source).toMatchObject({ truncated: true })

    const local = setup({
      url: 'https://example.com/local', statusCode: 200,
      body: { kind: 'text', content: 'a very long response body' }, truncated: false,
    }, { maxContentChars: 8 })
    expect((await local.knowledge.ingest({ url: 'https://example.com/local', summary: 'Clipped.' }))
      .document.source).toMatchObject({ truncated: true })
  })

  it('preserves relation creation time on refresh and rejects self-links or merged overflow', async () => {
    const { knowledge } = setup(undefined, { maxRelationsPerDocument: 1 })
    const firstTarget = await knowledge.ingest({ content: 'first target', summary: 'First target.' })
    const secondTarget = await knowledge.ingest({ content: 'second target', summary: 'Second target.' })
    const source = await knowledge.ingest({
      content: 'source', summary: 'Source.',
      relations: [{
        targetId: firstTarget.document.id, kind: 'supports', label: 'supports', evidence: 'Initial evidence.', confidence: 0.6,
      }],
    })
    const originalRelation = source.document.relations[0]!
    const refreshed = await knowledge.ingest({
      content: 'source', summary: 'Source refreshed.',
      relations: [{
        targetId: firstTarget.document.id, kind: 'supports', label: 'supports', evidence: 'Better evidence.', confidence: 0.9,
      }],
    })
    expect(refreshed.document.relations[0]).toMatchObject({
      id: originalRelation.id, createdAt: originalRelation.createdAt, evidence: 'Better evidence.', label: 'supports',
    })
    await expect(knowledge.ingest({
      content: 'source', summary: 'Overflow.',
      relations: [{ targetId: secondTarget.document.id, kind: 'related', evidence: 'Another edge.', confidence: 0.5 }],
    })).rejects.toThrow('document relation limit 1 reached')
    await expect(knowledge.ingest({
      content: 'source', summary: 'Self.',
      relations: [{ targetId: source.document.id, kind: 'related', evidence: 'Self edge.', confidence: 0.5 }],
    })).rejects.toThrow('cannot link to itself')
  })

  it('validates connection endpoints and limits, and updates an existing labeled edge', async () => {
    const { knowledge } = setup(undefined, { maxRelationsPerDocument: 1 })
    const source = await knowledge.ingest({ content: 'source connect', summary: 'Source.' })
    const target = await knowledge.ingest({ content: 'target connect', summary: 'Target.' })
    const other = await knowledge.ingest({ content: 'other connect', summary: 'Other.' })
    const initial = await knowledge.connect(source.document.id, {
      targetId: target.document.id, kind: 'references', label: 'cites', evidence: 'Citation one.', confidence: 0,
    })
    const updated = await knowledge.connect(source.document.id, {
      targetId: target.document.id, kind: 'references', label: 'cites', evidence: 'Citation two.', confidence: 1,
    })
    expect(updated).toMatchObject({ id: initial.id, createdAt: initial.createdAt, evidence: 'Citation two.', label: 'cites' })
    expect(knowledge.graph().edges[0]).toMatchObject({ label: 'cites' })
    await expect(knowledge.connect(source.document.id, {
      targetId: other.document.id, kind: 'related', evidence: 'Second edge.', confidence: 0.5,
    })).rejects.toThrow('document relation limit 1 reached')
    await expect(knowledge.connect(source.document.id, {
      targetId: source.document.id, kind: 'related', evidence: 'Self.', confidence: 0.5,
    })).rejects.toThrow('cannot link to itself')
    await expect(knowledge.connect(source.document.id, {
      targetId: 'doc-missing' as TrellisDocumentId, kind: 'related', evidence: 'Missing.', confidence: 0.5,
    })).rejects.toThrow('relation target not found')
    await expect(knowledge.connect('doc-missing-source' as TrellisDocumentId, {
      targetId: target.document.id, kind: 'related', evidence: 'Missing source.', confidence: 0.5,
    })).rejects.toThrow('missing key')
    for (const confidence of [Number.NaN, -0.1, 1.1]) {
      await expect(knowledge.connect(source.document.id, {
        targetId: target.document.id, kind: 'related', evidence: 'Invalid.', confidence,
      })).rejects.toThrow('confidence')
    }
    await expect(knowledge.connect(source.document.id, {
      targetId: target.document.id, kind: 'related', evidence: ' ', confidence: 0.5,
    })).rejects.toThrow('evidence must not be blank')
    await expect(knowledge.connect(source.document.id, {
      targetId: target.document.id, kind: 'references', label: ' ', evidence: 'Bad label.', confidence: 0.5,
    })).rejects.toThrow('label must not be blank')

    const multi = setup()
    const multiSource = await multi.knowledge.ingest({ content: 'multi source', summary: 'Multi.' })
    const multiA = await multi.knowledge.ingest({ content: 'multi a', summary: 'A.' })
    const multiB = await multi.knowledge.ingest({ content: 'multi b', summary: 'B.' })
    await multi.knowledge.connect(multiSource.document.id, {
      targetId: multiA.document.id, kind: 'related', evidence: 'A edge.', confidence: 0.5,
    })
    await multi.knowledge.connect(multiSource.document.id, {
      targetId: multiB.document.id, kind: 'related', evidence: 'B edge.', confidence: 0.5,
    })
    await multi.knowledge.connect(multiSource.document.id, {
      targetId: multiA.document.id, kind: 'related', evidence: 'Updated A edge.', confidence: 0.6,
    })
    expect(multi.knowledge.read(multiSource.document.id).document.relations).toHaveLength(2)
  })

  it('covers every invariant failure class against the authoritative table', async () => {
    const checks: Array<{
      records: KnowledgeDocumentRecord[]
      maxRelations?: number
      message: string
    }> = [
      {
        records: [document('doc-a', [relation('doc-b' as TrellisDocumentId), relation('doc-b' as TrellisDocumentId, { id: 'rel-2' as never })]), document('doc-b')],
        maxRelations: 1,
        message: 'above the configured limit',
      },
      {
        records: [document('doc-a', [relation('doc-b' as TrellisDocumentId), relation('doc-b' as TrellisDocumentId)]), document('doc-b')],
        message: 'repeats relation',
      },
      {
        records: [document('doc-a', [relation('doc-a' as TrellisDocumentId)])],
        message: 'relates to itself',
      },
      {
        records: [document('doc-a', [relation('doc-missing' as TrellisDocumentId)])],
        message: 'targets missing document',
      },
    ]
    for (const check of checks) {
      const { knowledge, table } = setup(undefined, { maxRelationsPerDocument: check.maxRelations ?? 4 })
      for (const record of check.records) await table.put(record.id, record)
      expect(knowledge.diagnose()).toContain(check.message)
    }
    const valid = setup()
    await valid.table.put('doc-a' as TrellisDocumentId, document('doc-a'))
    expect(valid.knowledge.size).toBe(1)
    expect(valid.knowledge.diagnose()).toBeUndefined()
  })

  it('scores every searchable field, applies stable tie ordering, and validates bounds', async () => {
    const { knowledge, table } = setup(undefined, { maxSearchResults: 5, maxSnippetChars: 18 })
    const title = await knowledge.ingest({ content: 'title-only body', title: 'Needle handbook', summary: 'A.', tags: [] })
    const tag = await knowledge.ingest({ content: 'tag-only body', title: 'Tag note', summary: 'B.', tags: ['needle'] })
    const tie = await knowledge.ingest({ content: 'tie-only body', title: 'Needle guide', summary: 'Tie.', tags: [] })
    await knowledge.ingest({ content: 'summary-only body', title: 'Summary note', summary: 'Contains needle here.', tags: [] })
    await knowledge.ingest({ content: 'prefix '.repeat(10) + 'needle suffix '.repeat(4), title: 'Body note', summary: 'D.', tags: [] })
    await knowledge.ingest({ content: 'none', title: 'No match', summary: 'E.', tags: [] })
    const titleRecord = table.get(title.document.id)!
    const tieRecord = table.get(tie.document.id)!
    await table.put(title.document.id, { ...titleRecord, updatedAt: '2026-08-18T00:00:00.000Z' })
    await table.put(tie.document.id, { ...tieRecord, updatedAt: '2026-08-19T00:00:00.000Z' })

    const hits = knowledge.search('needle', 99)
    expect(hits).toHaveLength(5)
    expect(hits[0]!.id).toBe(tie.document.id)
    expect(hits[1]!.id).toBe(title.document.id)
    expect(hits[2]!.id).toBe(tag.document.id)
    expect(hits.some(hit => hit.title === 'No match')).toBe(false)
    expect(hits.every(hit => hit.snippet.length > 0)).toBe(true)
    expect(() => knowledge.search(' ')).toThrow('query must not be blank')
    expect(() => knowledge.search('needle', 0)).toThrow('positive integer')
    expect(() => knowledge.search('needle', 1.5)).toThrow('positive integer')
  })

  it('projects query neighborhoods, clips large graphs, and validates graph/read requests', async () => {
    const { knowledge } = setup()
    const seed = await knowledge.ingest({ content: 'seed body', title: 'Needle seed', summary: 'Seed.' })
    const outbound = await knowledge.ingest({ content: 'outbound body', title: 'Outbound', summary: 'Outbound.' })
    const inbound = await knowledge.ingest({ content: 'inbound body', title: 'Inbound', summary: 'Inbound.' })
    await knowledge.connect(seed.document.id, {
      targetId: outbound.document.id, kind: 'extends', evidence: 'Seed extends outbound.', confidence: 0.8,
    })
    await knowledge.connect(inbound.document.id, {
      targetId: seed.document.id, kind: 'supports', evidence: 'Inbound supports seed.', confidence: 0.7,
    })

    expect(knowledge.graph({ query: 'needle', limit: 3 })).toMatchObject({
      nodes: [{ id: seed.document.id }, { id: outbound.document.id }, { id: inbound.document.id }],
      edges: [{ source: seed.document.id }, { source: inbound.document.id }],
      truncated: false,
    })
    const clipped = knowledge.graph({ query: 'needle', limit: 2 })
    expect(clipped.nodes.map(node => node.id)).toEqual([seed.document.id, outbound.document.id])
    expect(clipped.edges).toHaveLength(1)
    expect(clipped.truncated).toBe(true)
    expect(knowledge.graph({ query: 'absent' }).nodes).toEqual([])
    expect(knowledge.graph({ limit: 1 })).toMatchObject({ totalDocuments: 3, truncated: true })
    expect(() => knowledge.graph({ limit: 0 })).toThrow('positive integer')
    expect(() => knowledge.graph({ limit: 1.5 })).toThrow('positive integer')
    expect(() => knowledge.read('doc-missing' as TrellisDocumentId)).toThrow('not found')
    expect(knowledge.read(outbound.document.id).contentTruncated).toBe(false)
  })
})
