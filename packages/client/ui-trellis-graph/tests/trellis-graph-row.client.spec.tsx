// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { RunningToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { TrellisGraphRow, parseTrellisGraphSnapshot } from '../src/client/TrellisGraphRow.tsx'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import { en, NS, zh } from '../src/client/locales.ts'

const forceGraphMock = vi.hoisted(() => ({ instances: [] as unknown[] }))

vi.mock('force-graph', () => {
  class FakeForceGraph {
    readonly values = new Map<string, unknown>()
    data: { nodes: Array<Record<string, unknown>>; links: Array<Record<string, unknown>> } = { nodes: [], links: [] }
    nodeClick?: (node: Record<string, unknown>) => void
    backgroundClick?: () => void
    nodeLabelValue?: (node: Record<string, unknown>) => unknown
    nodeColorValue?: (node: Record<string, unknown>) => unknown
    linkColorValue?: (edge: Record<string, unknown>) => unknown
    linkLabelValue?: (edge: Record<string, unknown>) => unknown
    canvasModeValue?: () => unknown
    canvasValue?: (node: Record<string, unknown>, context: CanvasRenderingContext2D, scale: number) => void
    readonly centerAt = vi.fn(() => this)
    readonly zoom = vi.fn(() => this)
    readonly zoomToFit = vi.fn(() => this)
    readonly _destructor = vi.fn()

    constructor(readonly element: HTMLElement) {
      forceGraphMock.instances.push(this)
    }

    private set(name: string, value: unknown): this { this.values.set(name, value); return this }
    backgroundColor(value: unknown): this { return this.set('backgroundColor', value) }
    nodeId(value: unknown): this { return this.set('nodeId', value) }
    nodeLabel(value: (node: Record<string, unknown>) => unknown): this { this.nodeLabelValue = value; return this }
    nodeColor(value: (node: Record<string, unknown>) => unknown): this { this.nodeColorValue = value; return this }
    nodeRelSize(value: unknown): this { return this.set('nodeRelSize', value) }
    linkColor(value: (edge: Record<string, unknown>) => unknown): this { this.linkColorValue = value; return this }
    linkWidth(value: unknown): this { return this.set('linkWidth', value) }
    linkDirectionalArrowLength(value: unknown): this { return this.set('arrowLength', value) }
    linkDirectionalArrowRelPos(value: unknown): this { return this.set('arrowPosition', value) }
    linkLabel(value: (edge: Record<string, unknown>) => unknown): this { this.linkLabelValue = value; return this }
    nodeCanvasObjectMode(value: () => unknown): this { this.canvasModeValue = value; return this }
    nodeCanvasObject(value: (node: Record<string, unknown>, context: CanvasRenderingContext2D, scale: number) => void): this {
      this.canvasValue = value
      return this
    }
    onNodeClick(value: (node: Record<string, unknown>) => void): this { this.nodeClick = value; return this }
    onBackgroundClick(value: () => void): this { this.backgroundClick = value; return this }
    graphData(): typeof this.data
    graphData(value: typeof this.data): this
    graphData(value?: typeof this.data): typeof this.data | this {
      if (value === undefined) return this.data
      this.data = {
        nodes: value.nodes.map((node, index) => ({ ...node, x: 10 + index, y: 20 + index })),
        links: value.links,
      }
      return this
    }
    width(value: unknown): this { return this.set('width', value) }
    height(value: unknown): this { return this.set('height', value) }
  }
  return { default: FakeForceGraph }
})

type Props = Parameters<typeof TrellisGraphRow>[0]
const t: Props['t'] = makeTranslate(zh, commonZh)

afterEach(() => {
  cleanup()
  forceGraphMock.instances.length = 0
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

interface ForceGraphCapture {
  data: { nodes: Array<Record<string, unknown>>; links: Array<Record<string, unknown>> }
  nodeClick: (node: Record<string, unknown>) => void
  backgroundClick: () => void
  nodeLabelValue: (node: Record<string, unknown>) => unknown
  nodeColorValue: (node: Record<string, unknown>) => unknown
  linkColorValue: (edge: Record<string, unknown>) => unknown
  linkLabelValue: (edge: Record<string, unknown>) => unknown
  canvasModeValue: () => unknown
  canvasValue: (node: Record<string, unknown>, context: CanvasRenderingContext2D, scale: number) => void
  centerAt: ReturnType<typeof vi.fn>
  zoom: ReturnType<typeof vi.fn>
  zoomToFit: ReturnType<typeof vi.fn>
  _destructor: ReturnType<typeof vi.fn>
  values: Map<string, unknown>
}

describe('Trellis graph plugin registration', () => {
  it('registers one keyed view and both dictionaries, then releases them on teardown', async () => {
    const ctx = new Context()
    const slots = new SlotRegistry(ctx)
    slots.register({
      name: 'root',
      children: { 'tool.call.toolview': { kind: 'keyed', scope: 'session' } },
    } as never, () => null)
    const dictionaries: Array<{ namespace: string; value: unknown }> = []
    let dictionariesDisposed = false
    ctx.provide('locale', {
      register(namespace: string, value: unknown) {
        dictionaries.push({ namespace, value })
        return () => { dictionariesDisposed = true }
      },
    })

    expect(inject).toEqual(['slots', 'locale'])
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('tool.call.toolview')).toEqual([
      expect.objectContaining({
        options: { key: 'trellis_graph' },
        locale: NS,
        component: TrellisGraphRow,
      }),
    ])
    expect(dictionaries).toEqual([{ namespace: NS, value: { zh, en } }])

    await fiber.dispose()
    expect(slots.entries('tool.call.toolview')).toHaveLength(0)
    expect(dictionariesDisposed).toBe(true)
  })

  it('keeps the node half intentionally inert', () => {
    expect(applyNode).not.toThrow()
  })
})

function settled(text: string): ToolResultNode {
  return {
    kind: 'tool-result',
    seq: 3,
    time: 3_000,
    callId: 'call-graph',
    call: { name: 'trellis_graph', argsRaw: '{}' },
    callTime: 2_000,
    content: [{ type: 'text', text }],
    isError: false,
    callView: null,
    resultView: null,
    subCalls: [],
  }
}

function props(block: Props['block']): Props {
  return {
    callId: block.callId,
    toolName: 'trellis_graph',
    block,
    openFile: vi.fn(),
    t,
  } as unknown as Props
}

describe('TrellisGraphRow', () => {
  it('shows lifecycle, empty, and malformed replay states without consulting live data', () => {
    const running: RunningToolCall = {
      callId: 'call-graph', name: 'trellis_graph', argsRaw: '{}', turn: 1, step: 1, time: 2_000, callView: null, subCalls: [],
    }
    const live = render(<TrellisGraphRow {...props(running)} />)
    expect(live.container.textContent).toContain('正在生成图谱')
    cleanup()

    const empty = render(<TrellisGraphRow {...props(settled(JSON.stringify({
      ok: true,
      graph: { nodes: [], edges: [], totalDocuments: 0, truncated: false },
    })))} />)
    expect(empty.container.textContent).toContain('知识库里还没有可显示的文档')
    cleanup()

    const malformed = render(<TrellisGraphRow {...props(settled('{obsolete'))} />)
    expect(malformed.container.textContent).toContain('无法读取这次图谱结果')
    cleanup()

    const noText = render(<TrellisGraphRow {...props(settled(''))} />)
    expect(noText.container.textContent).toContain('无法读取这次图谱结果')
  })

  it('validates node, edge, provenance, and evidence fields before rendering', () => {
    const value = JSON.stringify({
      ok: true,
      graph: {
        nodes: [
          { id: 'doc-a', title: 'Alpha', summary: 'A', kind: 'note', tags: ['study'], sourceLabel: 'alpha.md' },
          { id: 'doc-b', title: 'Beta', summary: 'B', kind: 'webpage', tags: [], sourceLabel: 'https://example.com' },
        ],
        edges: [{
          id: 'rel-a', source: 'doc-a', target: 'doc-b', kind: 'supports',
          evidence: 'Alpha quotes the result in Beta.', confidence: 0.9,
        }],
        totalDocuments: 2,
        truncated: false,
      },
    })
    expect(parseTrellisGraphSnapshot(value)).toMatchObject({
      nodes: [{ id: 'doc-a', sourceLabel: 'alpha.md' }, { id: 'doc-b' }],
      edges: [{ source: 'doc-a', target: 'doc-b', evidence: 'Alpha quotes the result in Beta.' }],
    })
    expect(parseTrellisGraphSnapshot(value.replace('"target":"doc-b"', '"target":"doc-missing"'))).toBeUndefined()
  })

  it('rejects malformed replay values at each durable graph layer', () => {
    const node = { id: 'doc-a', title: 'Alpha', summary: 'A', kind: 'note', tags: ['study'], sourceLabel: 'a.md' }
    const edge = {
      id: 'rel-a', source: 'doc-a', target: 'doc-a', kind: 'related', evidence: 'Evidence.', confidence: 0.5,
    }
    const graph = (nodes: unknown, edges: unknown, totalDocuments: unknown = 1, truncated: unknown = false) =>
      JSON.stringify({ ok: true, graph: { nodes, edges, totalDocuments, truncated } })
    const invalid = [
      null,
      'null',
      JSON.stringify({ ok: false, graph: {} }),
      JSON.stringify({ ok: true, graph: null }),
      graph({}, []),
      graph([], {}),
      graph([], [], '1'),
      graph([], [], 1, 'false'),
      graph([null], []),
      graph([{ ...node, title: 1 }], []),
      graph([{ ...node, tags: 'study' }], []),
      graph([{ ...node, tags: [1] }], []),
      graph([node], [null]),
      graph([node], [{ ...edge, evidence: 1 }]),
      graph([node], [{ ...edge, confidence: '0.5' }]),
      graph([node], [{ ...edge, label: 1 }]),
      '{broken',
    ]
    for (const value of invalid) expect(parseTrellisGraphSnapshot(value)).toBeUndefined()
  })

  it('renders, explores, resizes, and disposes a populated force graph', () => {
    vi.useFakeTimers()
    let resize: (() => void) | undefined
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resize = () => { callback([], this as unknown as ResizeObserver) }
      }
      observe(): void {}
      disconnect(): void { disconnect() }
    })
    const inspect = vi.fn()
    const snapshot = JSON.stringify({
      ok: true,
      graph: {
        nodes: [
          { id: 'doc-a', title: 'Alpha', summary: 'A summary', kind: 'note', tags: ['study'], sourceLabel: 'alpha.md' },
          { id: 'doc-b', title: 'Beta', summary: 'B summary', kind: 'custom', tags: ['network'], sourceLabel: 'https://example.com' },
        ],
        edges: [
          { id: 'rel-a', source: 'doc-a', target: 'doc-b', kind: 'supports', label: 'supports', evidence: 'Alpha supports Beta.', confidence: 0.9 },
          { id: 'rel-b', source: 'doc-b', target: 'doc-a', kind: 'related', evidence: 'They share a topic.', confidence: 0.5 },
        ],
        totalDocuments: 12,
        truncated: true,
      },
    })
    const view = render(<TrellisGraphRow {...props(settled(snapshot))} inspect={inspect} />)
    const graph = forceGraphMock.instances[0] as ForceGraphCapture
    expect(view.container.textContent).toContain('这是大型知识库的局部视图')
    expect(view.getByRole('img', { name: 'Trellis 知识图谱' })).toBeTruthy()
    expect(graph.values.get('nodeId')).toBe('id')
    expect(graph.nodeLabelValue(graph.data.nodes[0]!)).toBe('Alpha\nA summary')
    expect(graph.nodeColorValue(graph.data.nodes[0]!)).toBe('#38b98a')
    expect(graph.nodeColorValue(graph.data.nodes[1]!)).toBe('#8d98a8')
    expect(graph.linkColorValue(graph.data.links[0]!)).toContain('rgba')
    expect(graph.linkLabelValue(graph.data.links[0]!)).toBe('supports')
    expect(graph.linkLabelValue(graph.data.links[1]!)).toBe('related')
    expect(graph.canvasModeValue()).toBe('after')

    const fillText = vi.fn()
    const context = {
      font: '', textAlign: '', textBaseline: '', fillStyle: '', fillText,
    } as unknown as CanvasRenderingContext2D
    graph.canvasValue(graph.data.nodes[0]!, context, 1)
    graph.canvasValue({ ...graph.data.nodes[0], x: undefined, y: undefined }, context, 10)
    expect(fillText).toHaveBeenCalledTimes(2)
    act(() => { graph.nodeClick(graph.data.nodes[0]!) })
    expect(view.container.textContent).toContain('Alpha supports Beta.')
    expect(view.container.textContent).toContain('They share a topic.')
    expect(graph.centerAt).toHaveBeenCalledWith(10, 20, 450)
    act(() => { graph.nodeClick({ ...graph.data.nodes[0], x: undefined, y: undefined }) })
    act(() => { graph.backgroundClick() })
    expect(view.container.textContent).not.toContain('Alpha supports Beta.')

    const finder = view.getByPlaceholderText('查找图中条目')
    fireEvent.change(finder, { target: { value: 'network' } })
    fireEvent.submit(finder.closest('form')!)
    expect(view.container.textContent).toContain('B summary')
    fireEvent.change(finder, { target: { value: 'missing' } })
    fireEvent.submit(finder.closest('form')!)
    fireEvent.click(view.getByRole('button', { name: '检查原始结果' }))
    expect(inspect).toHaveBeenCalledTimes(1)

    resize?.()
    act(() => { vi.runAllTimers() })
    expect(graph.zoomToFit).toHaveBeenCalledWith(500, 32)
    view.unmount()
    expect(disconnect).toHaveBeenCalled()
    expect(graph._destructor).toHaveBeenCalled()
  })
})
