// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { waitFor } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { TrellisKnowledgeView } from '../src/client/TrellisKnowledgeView.tsx'
import { apply } from '../src/client/index.ts'
import { apply as applyInvariant } from '../src/invariant.ts'
import { apply as applyHost } from '../src/index.ts'

vi.mock('force-graph', () => {
  class FakeForceGraph {
    readonly values = new Map<string, unknown>()
    data: { nodes: Array<Record<string, unknown>>; links: Array<Record<string, unknown>> } = { nodes: [], links: [] }
    readonly centerAt = vi.fn(() => this)
    readonly zoom = vi.fn(() => 1)
    readonly zoomToFit = vi.fn(() => this)
    readonly _destructor = vi.fn()
    readonly width = vi.fn(() => this)
    readonly height = vi.fn(() => this)

    constructor(readonly element: HTMLElement) {}
    private set(name: string, value: unknown): this { this.values.set(name, value); return this }
    backgroundColor(value: unknown): this { return this.set('backgroundColor', value) }
    nodeId(value: unknown): this { return this.set('nodeId', value) }
    nodeLabel(): this { return this }
    nodeColor(): this { return this }
    nodeRelSize(value: unknown): this { return this.set('nodeRelSize', value) }
    linkColor(): this { return this }
    linkWidth(value: unknown): this { return this.set('linkWidth', value) }
    linkDirectionalArrowLength(value: unknown): this { return this.set('arrowLength', value) }
    linkDirectionalArrowRelPos(value: unknown): this { return this.set('arrowPosition', value) }
    linkLabel(): this { return this }
    nodeCanvasObjectMode(): this { return this }
    nodeCanvasObject(): this { return this }
    onNodeClick(): this { return this }
    onBackgroundClick(): this { return this }
    graphData(): typeof this.data
    graphData(value: typeof this.data): this
    graphData(value?: typeof this.data): typeof this.data | this {
      if (value === undefined) return this.data
      this.data = value
      return this
    }
  }
  return { default: FakeForceGraph }
})

const mockT: TranslateNS<'ui-trellis-knowledge'> = (key: string): string => key

type MockInputActions = NonNullable<ConvViewProps['inputActions']>

function createMockInputActions(setText: (text: string) => void): MockInputActions {
  return {
    setDraft: setText,
    addImages: () => false,
    removeImage: () => {},
    pruneImages: () => {},
    submit: () => {},
  }
}

const KNOWLEDGE_PAYLOAD = {
  ok: true,
  stats: { totalDocuments: 3, totalRelations: 2, totalTags: 5 },
  documents: [
    {
      id: 'doc-cs101',
      title: 'Computer Science Fundamentals',
      summary: 'Foundational principles of algorithms, computation models, and systems.',
      kind: 'document',
      tags: ['ComputerScience', 'Algorithms', 'Core'],
      source: { type: 'url', url: 'https://en.wikipedia.org/wiki/Computer_science' },
      createdAt: '2026-08-19T10:00:00.000Z',
      updatedAt: '2026-08-19T10:00:00.000Z',
      relationsCount: 2,
      wordCount: 1420,
      content: '# Computer Science\n\nFoundational principles of algorithms, computation models, and systems.',
    },
    {
      id: 'doc-algo',
      title: 'Graph Theory & Networks',
      summary: 'Nodes, directed edges, graph traversals, and semantic knowledge networks.',
      kind: 'note',
      tags: ['GraphTheory', 'Algorithms', 'Obsidian'],
      source: { type: 'file', name: 'graph_notes.md' },
      createdAt: '2026-08-19T11:00:00.000Z',
      updatedAt: '2026-08-19T11:00:00.000Z',
      relationsCount: 1,
      wordCount: 890,
      content: '# Graph Theory\n\nA graph consists of vertices and edges linking concepts.',
    },
    {
      id: 'doc-markitdown',
      title: 'Microsoft MarkItDown Pipeline',
      summary: 'Structured Markdown extraction from noisy HTML pages and documents.',
      kind: 'webpage',
      tags: ['MarkItDown', 'Extraction', 'Tool'],
      source: { type: 'url', url: 'https://github.com/microsoft/markitdown' },
      createdAt: '2026-08-19T12:00:00.000Z',
      updatedAt: '2026-08-19T12:00:00.000Z',
      relationsCount: 1,
      wordCount: 650,
      content: '# MarkItDown\n\nConverts arbitrary documents to clean GitHub Flavored Markdown.',
    },
  ],
  graph: {
    nodes: [
      { id: 'doc-cs101', title: 'Computer Science Fundamentals', summary: 'Foundational principles', kind: 'document', tags: ['Algorithms'] },
      { id: 'doc-algo', title: 'Graph Theory & Networks', summary: 'Graph algorithms and networks', kind: 'note', tags: ['Algorithms'] },
      { id: 'doc-markitdown', title: 'Microsoft MarkItDown Pipeline', summary: 'Structured Markdown extraction', kind: 'webpage', tags: ['Extraction'] },
    ],
    edges: [
      { id: 'rel-1', source: 'doc-cs101', target: 'doc-algo', kind: 'relates_to', label: 'foundational_basis', evidence: 'Computer science provides mathematical foundations for graph theory algorithms.', confidence: 0.96 },
      { id: 'rel-2', source: 'doc-algo', target: 'doc-markitdown', kind: 'references', label: 'ingestion_format', evidence: 'Graph nodes are constructed from clean structured Markdown representations.', confidence: 0.88 },
    ],
  },
}

function mockKnowledgeFetch(): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => KNOWLEDGE_PAYLOAD,
  }))
}

describe('TrellisKnowledgeView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKnowledgeFetch()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders initial metrics, documents ledger, and cards', async () => {
    render(<TrellisKnowledgeView t={mockT} />)
    expect(screen.getByTestId('trellis-knowledge-view')).toBeDefined()
    await waitFor(() => {
      expect(screen.getByTestId('doc-grid')).toBeDefined()
      expect(screen.getByText('Computer Science Fundamentals')).toBeDefined()
      expect(screen.getByText('Graph Theory & Networks')).toBeDefined()
    })
  })

  it('filters documents by search query and kind selector', async () => {
    render(<TrellisKnowledgeView t={mockT} />)
    await waitFor(() => { expect(screen.getByText('Computer Science Fundamentals')).toBeDefined() })
    const searchInput = screen.getByRole('textbox', { name: 'Search documents' })
    fireEvent.change(searchInput, { target: { value: 'Fundamentals' } })

    expect(screen.getByText('Computer Science Fundamentals')).toBeDefined()
    expect(screen.queryByText('Graph Theory & Networks')).toBeNull()

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Graph Theory & Networks')).toBeDefined()

    // Filter by kind
    const kindSelect = screen.getByRole('combobox', { name: 'Filter type' })
    fireEvent.change(kindSelect, { target: { value: 'note' } })
    expect(screen.getByText('Graph Theory & Networks')).toBeDefined()
    expect(screen.queryByText('Computer Science Fundamentals')).toBeNull()
  })

  it('switches to Relations & Evidence tab and renders evidence quote', async () => {
    render(<TrellisKnowledgeView t={mockT} />)
    const relsTab = screen.getByRole('button', { name: /tab_relations/ })
    fireEvent.click(relsTab)

    await waitFor(() => {
      expect(screen.getByTestId('relations-grid')).toBeDefined()
      expect(screen.getByText(/Computer science provides mathematical foundations/)).toBeDefined()
      expect(screen.getByText(/96%/)).toBeDefined()
    })
  })

  it('switches to Graph tab and mounts canvas', async () => {
    render(<TrellisKnowledgeView t={mockT} />)
    await waitFor(() => { expect(screen.getByText('Computer Science Fundamentals')).toBeDefined() })
    const graphTab = screen.getByRole('button', { name: 'tab_graph' })
    fireEvent.click(graphTab)

    expect(screen.getByTestId('graph-wrapper')).toBeDefined()
  })

  it('opens document preview drawer on card click and allows asking agent', async () => {
    const setText = vi.fn()
    render(<TrellisKnowledgeView t={mockT} inputActions={createMockInputActions(setText)} />)

    const docCard = await screen.findByText('Computer Science Fundamentals')
    fireEvent.click(docCard)

    expect(screen.getByTestId('doc-preview-drawer')).toBeDefined()
    expect(screen.getAllByText(/Foundational principles of algorithms/).length).toBeGreaterThanOrEqual(1)

    const askBtn = screen.getByRole('button', { name: /ask_agent/ })
    fireEvent.click(askBtn)
    expect(setText).toHaveBeenCalledWith(expect.stringContaining('Computer Science Fundamentals'))

    // Close preview
    const closeBtn = screen.getByRole('button', { name: 'close_preview' })
    fireEvent.click(closeBtn)
    expect(screen.queryByTestId('doc-preview-drawer')).toBeNull()
  })

  it('uses fallback zh localization when t prop is omitted', () => {
    render(<TrellisKnowledgeView />)
    expect(screen.getByText('Trellis 知识库与概念网络')).toBeDefined()
  })
})

describe('Plugin Registration and Invariant', () => {
  it('applies client plugin, registers locale, and registers view and dock slots', async () => {
    const ctx = new Context()
    const slots = new SlotRegistry(ctx)
    slots.register({
      name: 'root',
      children: {
        'conversation.view': { kind: 'list', scope: 'session' },
        'conversation.input.dock': { kind: 'list', scope: 'session' },
      },
    } as never, () => null)
    const dictionaries: Array<{ namespace: string; value: unknown }> = []
    let dictionariesDisposed = false
    ctx.provide('locale', {
      register(namespace: string, value: unknown) {
        dictionaries.push({ namespace, value })
        return () => { dictionariesDisposed = true }
      },
      bind() {
        return (k: string) => k
      },
    })

    const fiber = ctx.plugin({ inject: ['slots', 'locale'], apply })
    await fiber.await()
    const entries = slots.entries('conversation.view')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.options.id).toBe('trellis_knowledge')
    expect(entries[0]?.options.order).toBe(10)
    expect(entries[0]?.component).toBe(TrellisKnowledgeView)

    const dockEntries = slots.entries('conversation.input.dock')
    expect(dockEntries).toHaveLength(1)
    expect(dockEntries[0]?.options.id).toBe('trellis_knowledge_dock')

    expect(dictionaries).toHaveLength(1)

    await fiber.dispose()
    expect(slots.entries('conversation.view')).toHaveLength(0)
    expect(slots.entries('conversation.input.dock')).toHaveLength(0)
    expect(dictionariesDisposed).toBe(true)
  })

  it('applies host plugin and invariant without throwing', async () => {
    applyHost()
    const ctx = new Context()
    ctx.provide('invariants', {
      register: vi.fn().mockReturnValue(() => {}),
    })
    const disposer = await applyInvariant(ctx)
    expect(typeof disposer).toBe('function')
  })
})
