/** Interactive canvas view for a settled `trellis_graph` result. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph from 'force-graph'
import type { LinkObject, NodeObject } from 'force-graph'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './TrellisGraphRow.module.css'

interface GraphNode extends NodeObject {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly kind: string
  readonly tags: readonly string[]
  readonly sourceLabel: string
}

interface GraphEdge extends LinkObject<GraphNode> {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly kind: string
  readonly label?: string
  readonly evidence: string
  readonly confidence: number
}

interface GraphSnapshot {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly totalDocuments: number
  readonly truncated: boolean
}

type RowProps = ToolCallViewProps & PropsLocale<'trellisGraph'>

const KIND_COLORS: Readonly<Record<string, string>> = {
  webpage: '#4aa8ff',
  document: '#8b7cf6',
  note: '#38b98a',
  other: '#8d98a8',
}

/** Flatten durable text blocks; non-text blocks cannot carry a graph payload. */
function resultText(block: ToolCallViewProps['block']): string | null {
  if (!('kind' in block)) return null
  return block.content
    .filter((item): item is Extract<typeof item, { type: 'text' }> => item.type === 'text')
    .map(item => item.text)
    .join('\n') || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStringFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every(field => typeof value[field] === 'string')
}

function parseNode(value: unknown): GraphNode | undefined {
  if (!isRecord(value)) return undefined
  if (!hasStringFields(value, ['id', 'title', 'summary', 'kind', 'sourceLabel'])) return undefined
  if (!Array.isArray(value.tags) || !value.tags.every(tag => typeof tag === 'string')) return undefined
  return {
    id: value.id as string,
    title: value.title as string,
    summary: value.summary as string,
    kind: value.kind as string,
    tags: value.tags,
    sourceLabel: value.sourceLabel as string,
  }
}

function parseEdge(value: unknown): GraphEdge | undefined {
  if (!isRecord(value)) return undefined
  if (!hasStringFields(value, ['id', 'source', 'target', 'kind', 'evidence'])) return undefined
  if (typeof value.confidence !== 'number') return undefined
  if (value.label !== undefined && typeof value.label !== 'string') return undefined
  return {
    id: value.id as string,
    source: value.source as string,
    target: value.target as string,
    kind: value.kind as string,
    ...(value.label === undefined ? {} : { label: value.label }),
    evidence: value.evidence as string,
    confidence: value.confidence,
  }
}

/**
 * Parse canonical graph-tool JSON without trusting replayed or obsolete data.
 * @param text - flattened tool-result text.
 * @returns a validated graph snapshot, or `undefined` for malformed data.
 */
export function parseTrellisGraphSnapshot(text: string | null): GraphSnapshot | undefined {
  if (text === null) return undefined
  try {
    const root = JSON.parse(text) as unknown
    if (!isRecord(root) || root.ok !== true || !isRecord(root.graph)) return undefined
    const graph = root.graph
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return undefined
    if (typeof graph.totalDocuments !== 'number' || typeof graph.truncated !== 'boolean') return undefined
    const nodes = graph.nodes.map(parseNode)
    const edges = graph.edges.map(parseEdge)
    if (nodes.some(node => node === undefined) || edges.some(edge => edge === undefined)) return undefined
    const ids = new Set((nodes as GraphNode[]).map(node => node.id))
    if ((edges as GraphEdge[]).some(edge => !ids.has(edge.source) || !ids.has(edge.target))) return undefined
    return {
      nodes: nodes as GraphNode[],
      edges: edges as GraphEdge[],
      totalDocuments: graph.totalDocuments,
      truncated: graph.truncated,
    }
  } catch {
    return undefined
  }
}

/**
 * Render the graph, floating controls, node search, and evidence detail panel.
 * @param props - keyed tool result and locale seat.
 * @returns the Trellis graph card.
 */
export function TrellisGraphRow({ block, inspect, t }: RowProps) {
  const settled = 'kind' in block
  const snapshot = useMemo(() => parseTrellisGraphSnapshot(resultText(block)), [block])
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraph<GraphNode, GraphEdge> | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (snapshot === undefined || snapshot.nodes.length === 0) return
    const element = canvasRef.current as HTMLDivElement
    const nodes = snapshot.nodes.map(node => ({ ...node }))
    const links = snapshot.edges.map(edge => ({ ...edge }))
    const graph = new ForceGraph<GraphNode, GraphEdge>(element)
      .backgroundColor('rgba(0,0,0,0)')
      .nodeId('id')
      .nodeLabel(node => `${node.title}\n${node.summary}`)
      .nodeColor(node => KIND_COLORS[node.kind] ?? '#8d98a8')
      .nodeRelSize(6)
      .linkColor(() => 'rgba(137, 151, 173, 0.45)')
      .linkWidth(1.5)
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(0.9)
      .linkLabel(edge => edge.label ?? edge.kind)
      .nodeCanvasObjectMode(() => 'after')
      .nodeCanvasObject((node, context, globalScale) => {
        const fontSize = Math.max(2.5, 11 / globalScale)
        context.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'top'
        context.fillStyle = 'rgba(241, 245, 249, 0.95)'
        context.fillText(node.title.slice(0, 40), node.x ?? 0, (node.y ?? 0) + 7)
      })
      .onNodeClick((node) => {
        setSelectedId(node.id)
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          graph.centerAt(node.x, node.y, 450).zoom(3.2, 450)
        }
      })
      .onBackgroundClick(() => { setSelectedId(null) })
      .graphData({ nodes, links })
    graphRef.current = graph

    const resize = (): void => {
      graph.width(element.clientWidth).height(element.clientHeight)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    const fit = window.setTimeout(() => { graph.zoomToFit(500, 32) }, 180)
    return () => {
      window.clearTimeout(fit)
      observer.disconnect()
      graph._destructor()
      graphRef.current = null
    }
  }, [snapshot])

  const handleZoomIn = useCallback(() => {
    const graph = graphRef.current
    if (graph) graph.zoom(graph.zoom() * 1.3, 300)
  }, [])

  const handleZoomOut = useCallback(() => {
    const graph = graphRef.current
    if (graph) graph.zoom(graph.zoom() / 1.3, 300)
  }, [])

  const handleZoomFit = useCallback(() => {
    const graph = graphRef.current
    if (graph) graph.zoomToFit(400, 32)
  }, [])

  const handleToggleSimulation = useCallback(() => {
    const graph = graphRef.current
    if (graph) {
      if (isPaused) {
        graph.resumeAnimation()
        setIsPaused(false)
      } else {
        graph.pauseAnimation()
        setIsPaused(true)
      }
    }
  }, [isPaused])

  if (!settled) {
    return <section className={css.card} data-tool="trellis-graph"><div className={css.status}>{t('building')}</div></section>
  }
  if (snapshot === undefined) {
    return <section className={css.card} data-tool="trellis-graph"><div className={css.status}>{t('malformed')}</div></section>
  }
  const selected = snapshot.nodes.find(node => node.id === selectedId)
  const connected = selected === undefined ? [] : snapshot.edges.filter(edge =>
    edge.source === selected.id || edge.target === selected.id)

  const selectMatch = (): void => {
    const normalized = query.trim().toLocaleLowerCase()
    const match = snapshot.nodes.find(node => node.title.toLocaleLowerCase().includes(normalized)
      || node.tags.some(tag => tag.toLocaleLowerCase().includes(normalized)))
    if (match === undefined) return
    setSelectedId(match.id)
    const graph = graphRef.current
    const rendered = graph?.graphData().nodes.find(node => node.id === match.id)
    if (graph !== null && rendered !== undefined
      && typeof rendered.x === 'number' && typeof rendered.y === 'number') {
      graph.centerAt(rendered.x, rendered.y, 450).zoom(3.2, 450)
    }
  }

  return (
    <section className={css.card} data-tool="trellis-graph">
      <header className={css.header}>
        <div>
          <h3 className={css.headerTitle}>
            <span>🕸️</span>
            <span>{t('title')}</span>
          </h3>
          <div className={css.counts}>
            <span className={css.countChip}>{t('nodes', { count: snapshot.nodes.length })}</span>
            <span className={css.countChip}>{t('edges', { count: snapshot.edges.length })}</span>
          </div>
        </div>
        {inspect !== undefined ? <button type="button" className={css.inspect} onClick={inspect}>{t('inspect')}</button> : null}
      </header>

      {snapshot.truncated ? <p className={css.localView}>{t('truncated')}</p> : null}

      {snapshot.nodes.length === 0 ? <div className={css.empty}>{t('empty')}</div> : (
        <>
          {/* Floating Controls & Search Dock */}
          <div className={css.controlsBar}>
            <form className={css.finder} onSubmit={(event) => { event.preventDefault(); selectMatch() }}>
              <input
                className={css.finderInput}
                value={query}
                onChange={(event) => { setQuery(event.target.value) }}
                placeholder={t('find')}
                list={`trellis-graph-${block.callId}`}
              />
              <datalist id={`trellis-graph-${block.callId}`}>
                {snapshot.nodes.map(node => <option key={node.id} value={node.title} />)}
              </datalist>
            </form>

            <div className={css.dockActions}>
              <button
                type="button"
                className={css.dockBtn}
                onClick={handleZoomIn}
                title={t('zoom_in')}
                aria-label={t('zoom_in')}
              >
                +
              </button>
              <button
                type="button"
                className={css.dockBtn}
                onClick={handleZoomOut}
                title={t('zoom_out')}
                aria-label={t('zoom_out')}
              >
                −
              </button>
              <button
                type="button"
                className={css.dockBtn}
                onClick={handleZoomFit}
                title={t('zoom_fit')}
                aria-label={t('zoom_fit')}
              >
                ⛶
              </button>
              <button
                type="button"
                className={css.dockBtn}
                onClick={handleToggleSimulation}
                title={isPaused ? t('resume_sim') : t('pause_sim')}
                aria-label={isPaused ? t('resume_sim') : t('pause_sim')}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            </div>
          </div>

          <div className={css.workspace}>
            <div ref={canvasRef} className={css.canvas} role="img" aria-label={t('title')} />

            {/* Slide-over Evidence Inspector */}
            {selected !== undefined ? (
              <aside className={css.details}>
                <div className={css.detailHeader}>
                  <span
                    className={css.kindBadge}
                    style={{
                      background: `${KIND_COLORS[selected.kind] ?? '#8d98a8'}22`,
                      color: KIND_COLORS[selected.kind] ?? '#8d98a8',
                      border: `1px solid ${KIND_COLORS[selected.kind] ?? '#8d98a8'}44`,
                    }}
                  >
                    {selected.kind}
                  </span>
                  <button
                    type="button"
                    className={css.closeBtn}
                    onClick={() => { setSelectedId(null) }}
                    title={t('close')}
                    aria-label={t('close')}
                  >
                    ✕
                  </button>
                </div>

                <h4 className={css.detailTitle}>{selected.title}</h4>
                <p className={css.detailSummary}>{selected.summary}</p>

                {selected.tags.length > 0 && (
                  <div className={css.tags}>
                    {selected.tags.map(tag => (
                      <span className={css.tagChip} key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <dl className={css.metaList}>
                  <dt>{t('source')}:</dt>
                  <dd>{selected.sourceLabel}</dd>
                  <dt>{t('relations')}:</dt>
                  <dd>{connected.length}</dd>
                </dl>

                {connected.length > 0 && (
                  <div className={css.edgesSection}>
                    <h5 className={css.edgesSectionTitle}>{t('relations')} ({connected.length})</h5>
                    {connected.map(edge => (
                      <div className={css.edgeCard} key={edge.id}>
                        <div className={css.edgeHeader}>
                          <span className={css.edgeLabel}>{edge.label ?? edge.kind}</span>
                          <span className={css.confidenceBadge}>
                            {t('confidence', { value: `${Math.round(edge.confidence * 100)}%` })}
                          </span>
                        </div>
                        <div className={css.confidenceMeter}>
                          <div
                            className={css.confidenceFill}
                            style={{ width: `${Math.round(edge.confidence * 100)}%` }}
                          />
                        </div>
                        {edge.evidence && (
                          <div className={css.evidenceQuote}>
                            <b>{t('evidence')}:</b> "{edge.evidence}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
