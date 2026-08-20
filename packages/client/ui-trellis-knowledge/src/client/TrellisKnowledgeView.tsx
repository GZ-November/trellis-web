/**
 * Transparent Trellis Knowledge Hub View.
 * Displays real-time document ledger, concept extraction network with evidence quotes,
 * confidence meters, and full interactive Obsidian force-directed graph.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-knowledge/client/TrellisKnowledgeView
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import ForceGraph from 'force-graph'
import type { LinkObject, NodeObject } from 'force-graph'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { zh, type TrellisKnowledgeKey } from './locales.ts'
import css from './TrellisKnowledgeView.module.css'

interface DocumentItem {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly kind: 'document' | 'note' | 'webpage' | 'other'
  readonly tags: readonly string[]
  readonly source: { type: string; url?: string; name?: string }
  readonly createdAt: string
  readonly updatedAt: string
  readonly relationsCount: number
  readonly wordCount: number
  readonly content?: string
}

interface RelationItem extends LinkObject {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly kind: string
  readonly label?: string
  readonly evidence: string
  readonly confidence: number
}

interface GraphNode extends NodeObject {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly kind: string
  readonly tags: readonly string[]
}

interface KnowledgePayload {
  readonly stats: {
    readonly totalDocuments: number
    readonly totalRelations: number
    readonly totalTags: number
  }
  readonly documents: readonly DocumentItem[]
  readonly graph: {
    readonly nodes: readonly GraphNode[]
    readonly edges: readonly RelationItem[]
  }
}

const KIND_COLORS: Readonly<Record<string, string>> = {
  document: '#8b5cf6',
  note: '#10b981',
  webpage: '#3b82f6',
  other: '#f59e0b',
}

const EMPTY_PAYLOAD: KnowledgePayload = {
  stats: {
    totalDocuments: 0,
    totalRelations: 0,
    totalTags: 0,
  },
  documents: [],
  graph: {
    nodes: [],
    edges: [],
  },
}

/** Component properties composed from runtime view slot and locale. */
export type TrellisKnowledgeViewProps = Partial<PropsRuntime<'conversation.view'>> & Partial<PropsLocale<'ui-trellis-knowledge'>>

/**
 * Transparent Knowledge Hub View for Trellis.
 */
export function TrellisKnowledgeView(props: TrellisKnowledgeViewProps): ReactElement {
  const t = props.t ?? ((key: TrellisKnowledgeKey) => zh[key])
  const inputActions = props.inputActions

  const [activeTab, setActiveTab] = useState<'documents' | 'relations' | 'graph'>('documents')
  const [data, setData] = useState<KnowledgePayload>(EMPTY_PAYLOAD)
  const [searchQuery, setSearchQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)
  const [loading, setLoading] = useState(false)

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraph<GraphNode, RelationItem> | null>(null)

  const loadKnowledge = useCallback(async () => {
    setLoading(true)
    try {
      if (typeof window === 'undefined') return
      const res = await fetch('/api/trellis/knowledge')
      if (!res.ok) return
      const json = await res.json() as unknown
      if (typeof json !== 'object' || json === null || !('ok' in json) || !(json as { ok: boolean }).ok) return
      setData(json as unknown as KnowledgePayload)
      // Keep the open preview in sync when its document changed underneath it.
      setSelectedDoc((current) => {
        if (current === null) return current
        const next = (json as unknown as KnowledgePayload).documents.find(doc => doc.id === current.id)
        return next ?? null
      })
    } catch {
      // Offline / test fallback keeps the last good payload (empty initially).
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadKnowledge()
    // The hub is a living projection: poll gently while mounted and refresh
    // immediately when another Trellis surface reports an ingestion.
    const timer = window.setInterval(() => { void loadKnowledge() }, 6000)
    const onUpdated = () => { void loadKnowledge() }
    window.addEventListener('trellis:knowledge-updated', onUpdated)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('trellis:knowledge-updated', onUpdated)
    }
  }, [loadKnowledge])

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return data.documents.filter((doc) => {
      const matchKind = kindFilter === 'all' || doc.kind === kindFilter
      if (!matchKind) return false
      if (!q) return true
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.tags.some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [data.documents, kindFilter, searchQuery])

  // Canvas Force Graph rendering when 'graph' tab is active
  useEffect(() => {
    if (activeTab !== 'graph' || !canvasRef.current || data.graph.nodes.length === 0) return
    const element = canvasRef.current
    const nodes = data.graph.nodes.map(n => ({ ...n }))
    const links = data.graph.edges.map(e => ({ ...e }))

    const graph = new ForceGraph<GraphNode, RelationItem>(element)
      .backgroundColor('rgba(0,0,0,0)')
      .nodeId('id')
      .nodeLabel(node => `${node.title}\n${node.summary}`)
      .nodeColor(node => KIND_COLORS[node.kind] ?? '#8d98a8')
      .nodeRelSize(7)
      .linkColor(() => 'rgba(137, 151, 173, 0.45)')
      .linkWidth(1.5)
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(0.9)
      .linkLabel(edge => `${edge.label ?? edge.kind} (${Math.round(edge.confidence * 100)}%)`)
      /* jscpd:ignore-start */
      .nodeCanvasObjectMode(() => 'after')
      .nodeCanvasObject((node, context, globalScale) => {
        const fontSize = Math.max(2.5, 11 / globalScale)
        context.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'top'
        context.fillStyle = 'rgba(241, 245, 249, 0.95)'
        context.fillText(node.title.slice(0, 36), node.x ?? 0, (node.y ?? 0) + 8)
      })
      /* jscpd:ignore-end */
      .onNodeClick((node) => {
        const doc = data.documents.find(d => d.id === node.id)
        if (doc) setSelectedDoc(doc)
      })
      .graphData({ nodes, links })
    graphRef.current = graph

    const resize = (): void => {
      graph.width(element.clientWidth).height(element.clientHeight)
    }
    resize()
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize)
      observer.observe(element)
    }
    const fit = window.setTimeout(() => { graph.zoomToFit(400, 32) }, 150)

    return () => {
      window.clearTimeout(fit)
      observer?.disconnect()
      graph._destructor()
      graphRef.current = null
    }
  }, [activeTab, data])

  const handleAskAgent = useCallback((doc: DocumentItem) => {
    if (inputActions) {
      inputActions.setDraft(`请根据知识库中的文档《${doc.title}》进行深度分析，解释其核心概念并推荐可能关联的延伸方向。`)
    }
  }, [inputActions])

  return (
    <div className={css.container} data-testid="trellis-knowledge-view">
      {/* Top Header & Transparent Metrics */}
      <header className={css.header}>
        <div className={css.titleRow}>
          <div className={css.titleArea}>
            <h2 className={css.title}>{t('title')}</h2>
            <p className={css.subtitle}>{t('subtitle')}</p>
          </div>
          <button
            type="button"
            className={css.refreshBtn}
            onClick={() => void loadKnowledge()}
            disabled={loading}
          >
            {loading ? '…' : t('refresh')}
          </button>
        </div>

        {/* Real-time Transparent Statistics */}
        <div className={css.statsRow}>
          <div className={css.statCard}>
            <span className={`${css.statIcon} ${css.statIconDoc}`} aria-hidden="true" />
            <div className={css.statInfo}>
              <span className={css.statValue}>{data.stats.totalDocuments}</span>
              <span className={css.statLabel}>{t('stat_docs')}</span>
            </div>
          </div>
          <div className={css.statCard}>
            <span className={`${css.statIcon} ${css.statIconRel}`} aria-hidden="true" />
            <div className={css.statInfo}>
              <span className={css.statValue}>{data.stats.totalRelations}</span>
              <span className={css.statLabel}>{t('stat_relations')}</span>
            </div>
          </div>
          <div className={css.statCard}>
            <span className={`${css.statIcon} ${css.statIconTag}`} aria-hidden="true" />
            <div className={css.statInfo}>
              <span className={css.statValue}>{data.stats.totalTags}</span>
              <span className={css.statLabel}>{t('stat_tags')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Sub-Tabs & Filtering */}
      <div className={css.navBar}>
        <div className={css.tabGroup}>
          <button
            type="button"
            className={`${css.tabBtn} ${activeTab === 'documents' ? css.tabBtnActive : ''}`}
            onClick={() => { setActiveTab('documents') }}
          >
            {t('tab_documents')} ({filteredDocs.length})
          </button>
          <button
            type="button"
            className={`${css.tabBtn} ${activeTab === 'relations' ? css.tabBtnActive : ''}`}
            onClick={() => { setActiveTab('relations') }}
          >
            {t('tab_relations')} ({data.graph.edges.length})
          </button>
          <button
            type="button"
            className={`${css.tabBtn} ${activeTab === 'graph' ? css.tabBtnActive : ''}`}
            onClick={() => { setActiveTab('graph') }}
          >
            {t('tab_graph')}
          </button>
        </div>

        {activeTab === 'documents' && (
          <div className={css.filterGroup}>
            <input
              type="text"
              className={css.searchInput}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value) }}
              placeholder={t('search_placeholder')}
              aria-label="Search documents"
            />
            <select
              className={css.kindSelect}
              value={kindFilter}
              onChange={(e) => { setKindFilter(e.target.value) }}
              aria-label="Filter type"
            >
              <option value="all">{t('filter_all')}</option>
              <option value="document">{t('kind_document')}</option>
              <option value="note">{t('kind_note')}</option>
              <option value="webpage">{t('kind_webpage')}</option>
              <option value="other">{t('kind_other')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Workspace Area */}
      <div className={css.workspace}>
        {/* Tab 1: Documents Ledger */}
        {activeTab === 'documents' && (
          filteredDocs.length === 0 ? (
            <div className={css.emptyState}>{t('empty_documents')}</div>
          ) : (
            <div className={css.docGrid} data-testid="doc-grid">
              {filteredDocs.map(doc => (
                <div
                  key={doc.id}
                  className={css.docCard}
                  onClick={() => { setSelectedDoc(doc) }}
                >
                  <div className={css.docCardHeader}>
                    <span
                      className={css.kindBadge}
                      style={{
                        background: `${KIND_COLORS[doc.kind] ?? '#8d98a8'}22`,
                        color: KIND_COLORS[doc.kind] ?? '#8d98a8',
                        border: `1px solid ${KIND_COLORS[doc.kind] ?? '#8d98a8'}44`,
                      }}
                    >
                      {doc.kind}
                    </span>
                    <span className={css.docDate}>{doc.createdAt.slice(0, 10)}</span>
                  </div>

                  <h3 className={css.docTitle}>{doc.title}</h3>
                  <p className={css.docSummary}>{doc.summary}</p>

                  <div className={css.tagList}>
                    {doc.tags.map(tag => (
                      <span key={tag} className={css.tagChip}>#{tag}</span>
                    ))}
                  </div>

                  <div className={css.docFooter}>
                    <span>{t('source')}: {doc.source.url ?? doc.source.name ?? 'Pasted'}</span>
                    <span>{doc.wordCount} {t('word_count')}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Tab 2: Concept Relations & Evidence Ledger */}
        {activeTab === 'relations' && (
          data.graph.edges.length === 0 ? (
            <div className={css.emptyState}>{t('empty_relations')}</div>
          ) : (
            <div className={css.relationsGrid} data-testid="relations-grid">
              {data.graph.edges.map((rel) => {
                const sourceDoc = data.documents.find(d => d.id === rel.source)
                const targetDoc = data.documents.find(d => d.id === rel.target)
                return (
                  <div key={rel.id} className={css.relationCard}>
                    <div className={css.relationHeader}>
                      <div className={css.relationNodes}>
                        <span className={css.relationNode}>{sourceDoc?.title ?? rel.source}</span>
                        <span className={css.relTag}>{rel.label ?? rel.kind} →</span>
                        <span className={css.relationNode}>{targetDoc?.title ?? rel.target}</span>
                      </div>
                      <div className={css.confidenceBox}>
                        <div className={css.confidenceBar}>
                          <div
                            className={css.confidenceFill}
                            style={{ width: `${Math.round(rel.confidence * 100)}%` }}
                          />
                        </div>
                        <span>{t('confidence')}: {Math.round(rel.confidence * 100)}%</span>
                      </div>
                    </div>

                    <div className={css.evidenceQuote}>
                      <b>{t('evidence')}:</b> "{rel.evidence}"
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Tab 3: Interactive Obsidian Knowledge Graph */}
        {activeTab === 'graph' && (
          <div className={css.graphWrapper} data-testid="graph-wrapper">
            <div ref={canvasRef} className={css.graphCanvas} role="img" aria-label={t('title')} />
            <div className={css.graphDock}>
              <button
                type="button"
                className={css.dockBtn}
                onClick={() => {
                  const g = graphRef.current
                  if (g) g.zoom(g.zoom() * 1.3, 300)
                }}
                title={t('zoom_in')}
              >
                +
              </button>
              <button
                type="button"
                className={css.dockBtn}
                onClick={() => {
                  const g = graphRef.current
                  if (g) g.zoom(g.zoom() / 1.3, 300)
                }}
                title={t('zoom_out')}
              >
                −
              </button>
              <button
                type="button"
                className={css.dockBtn}
                onClick={() => {
                  const g = graphRef.current
                  if (g) g.zoomToFit(400, 32)
                }}
                title={t('zoom_fit')}
              >
                ⛶
              </button>
            </div>
          </div>
        )}

        {/* Slide-over Full Document Drawer */}
        {selectedDoc && (
          <aside className={css.drawer} data-testid="doc-preview-drawer">
            <div className={css.drawerHeader}>
              <div>
                <span
                  className={css.kindBadge}
                  style={{
                    background: `${KIND_COLORS[selectedDoc.kind] ?? '#8d98a8'}22`,
                    color: KIND_COLORS[selectedDoc.kind] ?? '#8d98a8',
                    border: `1px solid ${KIND_COLORS[selectedDoc.kind] ?? '#8d98a8'}44`,
                  }}
                >
                  {selectedDoc.kind}
                </span>
                <h3 className={css.docTitle} style={{ marginTop: '6px' }}>{selectedDoc.title}</h3>
              </div>
              <button
                type="button"
                className={css.dockBtn}
                onClick={() => { setSelectedDoc(null) }}
                title={t('close_preview')}
                aria-label={t('close_preview')}
              >
                ✕
              </button>
            </div>

            <div className={css.drawerBody}>
              <p className={css.docSummary}>{selectedDoc.summary}</p>
              <div className={css.tagList}>
                {selectedDoc.tags.map(tag => (
                  <span key={tag} className={css.tagChip}>#{tag}</span>
                ))}
              </div>

              <div className={css.markdownBody}>
                {selectedDoc.content ?? `# ${selectedDoc.title}\n\n${selectedDoc.summary}\n\n> Source: ${selectedDoc.source.url ?? selectedDoc.source.name ?? 'Pasted'}`}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className={css.refreshBtn}
                  onClick={() => { handleAskAgent(selectedDoc) }}
                >
                  {t('ask_agent')}
                </button>
                {selectedDoc.source.url && (
                  <button
                    type="button"
                    className={css.refreshBtn}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('trellis:open-browser', { detail: { url: selectedDoc.source.url } }))
                    }}
                    title={t('source_link')}
                  >
                    {t('source_link')}
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
