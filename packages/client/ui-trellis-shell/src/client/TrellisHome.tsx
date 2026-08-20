/**
 * Trellis full-screen workbench home: a chat-free knowledge capture,
 * organization, and analysis surface. It shadows the regular three-column
 * chat shell by registering into the root slot at a lower priority.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-shell/client/TrellisHome
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ConversationNode,
  ConversationSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import { CompanionBrowser } from './CompanionBrowser.tsx'
import type { TrellisSessionSource } from './session-source.ts'
import { KnowledgeCanvas } from './KnowledgeCanvas.tsx'
import type { CanvasEdge } from './KnowledgeCanvas.tsx'
import css from './TrellisHome.module.css'

/** Capture payload accepted by the injected capture action. */
export interface TrellisCaptureInput {
  readonly url?: string
  readonly content?: string
  readonly fileName?: string
  /** Binary document uploaded through the file-upload plugin and read by the agent. */
  readonly file?: File
}

/** Document summary returned by the Trellis knowledge API. */
interface DocumentSummary {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly kind: string
  readonly tags: readonly string[]
  readonly source: { readonly type: string; readonly url?: string; readonly name?: string }
  readonly createdAt: string
  readonly updatedAt: string
  readonly relationsCount: number
  readonly wordCount: number
}

/** Knowledge API payload. */
interface KnowledgePayload {
  readonly stats: {
    readonly totalDocuments: number
    readonly totalRelations: number
    readonly totalTags: number
  }
  readonly documents: readonly DocumentSummary[]
  readonly graph: {
    readonly nodes: readonly unknown[]
    readonly edges: readonly unknown[]
  }
}

/** One stored document detail. */
interface DocumentDetail {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly summary: string
  readonly tags: readonly string[]
  readonly source: { readonly type: string; readonly url?: string; readonly name?: string }
  readonly createdAt: string
  readonly updatedAt: string
}

/** Document detail payload. */
interface DocumentDetailPayload {
  readonly ok: boolean
  readonly data?: DocumentDetail
}

/** One rendered analysis exchange. */
interface AnalysisItem {
  readonly role: 'user' | 'assistant'
  readonly text: string
}

/** Business callbacks injected by the Trellis shell registration. */
export interface TrellisShellInjected {
  /** Send a capture prompt into the hidden Trellis session. */
  capture: (input: TrellisCaptureInput) => Promise<void>
  /** Send an analysis prompt for one document into the hidden Trellis session. */
  analyze: (doc: { id: string; title: string }, question: string) => Promise<void>
  /** Reactive current-session conversation source. */
  hooks: { trellisSession: TrellisSessionSource }
}

/** Full props composed from the root slot contract and the injected face. */
export type TrellisHomeProps =
  & PropsRuntime<'root'>
  & import('@deepseek-ai/dsh-client-ui-slots').InjectFace<TrellisShellInjected>
  & PropsLocale<'ui-trellis-shell'>

const ANALYSIS_MARKER = '[trellis-analysis]'

const DEEPREAD_MODES: Record<string, string> = {
  quick: '请使用 deepread 工具以 quick 模式快速精读这篇文档。先用 trellis_read 获取全文，再把全文作为 text 参数传给 deepread，最后输出快速要点报告。',
  deep: '请使用 deepread 工具以 deep 模式深度精读这篇文档。先用 trellis_read 获取全文，再把全文作为 text 参数传给 deepread，最后输出深度精读报告。',
  map: '请使用 deepread 工具以 map 模式生成知识地图。先用 trellis_read 获取全文，再把全文作为 text 参数传给 deepread，输出观点-证据-数据-关系报告和思维导图。',
  feynman: '请使用 deepread 工具以 feynman 模式进行费曼学习。先用 trellis_read 获取全文，再把全文作为 text 参数传给 deepread，输出费曼学习报告和复习计划。',
  book: '请使用 deepread 工具以 book 模式精读整本书。先用 trellis_read 获取全文，再把全文作为 text 参数传给 deepread，输出全书精读报告。',
}

function nodeText(node: ConversationNode): { user?: string; assistant?: string } {
  if (node.kind === 'user') {
    return {
      user: node.content
        .map(block => block.type === 'text' ? block.text : '')
        .filter(Boolean)
        .join('\n'),
    }
  }
  if (node.kind === 'assistant') {
    return {
      assistant: node.blocks
        .filter(block => block.kind === 'text')
        .map(block => block.text)
        .join('\n'),
    }
  }
  return {}
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function isTextFile(file: File): boolean {
  return file.type.startsWith('text/')
    || /\.(md|markdown|txt|html?|json|csv|tsv|xml|ya?ml|org)$/i.test(file.name)
}

/**
 * Trellis workbench home component.
 * @param props - composed slot props.
 * @returns the full-screen knowledge surface.
 */
export function TrellisHome(props: TrellisHomeProps): ReactElement {
  const t = props.t
  const { capture, analyze, useTrellisSession } = props

  const session = useTrellisSession((snapshot: ConversationSnapshot | null) => snapshot)
  const [payload, setPayload] = useState<KnowledgePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [captureText, setCaptureText] = useState('')
  const [captureBusy, setCaptureBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [question, setQuestion] = useState('')
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list')
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserUrl, setBrowserUrl] = useState<string | undefined>(undefined)
  const captureInputRef = useRef<HTMLInputElement | null>(null)
  const wasRunning = useRef(false)

  const loadKnowledge = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/trellis/knowledge')
      if (!res.ok) return
      const json = (await res.json()) as { ok?: boolean } & KnowledgePayload
      if (json.ok !== false) setPayload(json)
    } catch {
      // Offline / test fallback keeps the current payload.
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/trellis/document?id=${encodeURIComponent(id)}`)
    if (!res.ok) return
    const json = (await res.json()) as DocumentDetailPayload
    if (json.ok && json.data !== undefined) setDetail(json.data)
  }, [])

  useEffect(() => {
    void loadKnowledge()
  }, [loadKnowledge])

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  useEffect(() => {
    const running = session?.running ?? false
    if (running) {
      wasRunning.current = true
    } else if (wasRunning.current) {
      wasRunning.current = false
      void loadKnowledge()
      if (selectedId !== null) void loadDetail(selectedId)
    }
  }, [session?.running, selectedId, loadKnowledge, loadDetail])

  useEffect(() => {
    const handleOpenBrowser = (event: Event) => {
      const custom = event as CustomEvent<{ url?: string }>
      setBrowserUrl(custom.detail.url)
      setBrowserOpen(true)
    }
    window.addEventListener('trellis:open-browser', handleOpenBrowser)
    return () => {
      window.removeEventListener('trellis:open-browser', handleOpenBrowser)
    }
  }, [])

  const filteredDocs = useMemo(() => {
    if (payload === null) return []
    const q = search.trim().toLowerCase()
    if (q === '') return payload.documents
    return payload.documents.filter((doc) => {
      return doc.title.toLowerCase().includes(q)
        || doc.summary.toLowerCase().includes(q)
        || doc.tags.some(tag => tag.toLowerCase().includes(q))
    })
  }, [payload, search])

  const canvasEdges = useMemo<readonly CanvasEdge[]>(() => {
    if (payload === null) return []
    const docs = payload.documents
    const ids = new Set(docs.map(doc => doc.id))
    return (payload.graph.edges as readonly CanvasEdge[]).filter(edge => ids.has(edge.source) && ids.has(edge.target))
  }, [payload])

  const analysisItems = useMemo<readonly AnalysisItem[]>(() => {
    if (session === null) return []
    let show = false
    const items: AnalysisItem[] = []
    for (const node of session.nodes) {
      const text = nodeText(node)
      if (node.kind === 'user') {
        const userText = text.user ?? ''
        if (userText.includes(ANALYSIS_MARKER)) {
          show = true
          items.push({ role: 'user', text: userText.replace(ANALYSIS_MARKER, '').trim() })
        } else {
          show = false
        }
      } else if (node.kind === 'assistant' && show) {
        const assistantText = text.assistant ?? ''
        if (assistantText !== '') items.push({ role: 'assistant', text: assistantText })
      }
    }
    return items
  }, [session])

  const handleCapture = useCallback(async () => {
    const value = captureText.trim()
    if (value === '' || captureBusy) return
    setCaptureBusy(true)
    setError(null)
    try {
      await capture(isUrl(value) ? { url: value } : { content: value })
      setCaptureText('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setCaptureBusy(false)
    }
  }, [capture, captureText, captureBusy])

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file === undefined || captureBusy) return
    setCaptureBusy(true)
    setError(null)
    try {
      if (isTextFile(file)) {
        const content = await file.text()
        await capture({ content, fileName: file.name })
      } else {
        await capture({ file })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setCaptureBusy(false)
    }
  }, [capture, captureBusy])

  const handleAnalyze = useCallback(async () => {
    const value = question.trim()
    if (selectedId === null || detail === null || value === '' || analysisBusy) return
    setAnalysisBusy(true)
    setError(null)
    try {
      await analyze({ id: selectedId, title: detail.title }, value)
      setQuestion('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setAnalysisBusy(false)
    }
  }, [analyze, analysisBusy, detail, question, selectedId])

  const handleDeepRead = useCallback(async (mode: string) => {
    const instruction = DEEPREAD_MODES[mode]
    if (detail === null || instruction === undefined || analysisBusy) return
    setAnalysisBusy(true)
    setError(null)
    try {
      await analyze({ id: detail.id, title: detail.title }, instruction)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setAnalysisBusy(false)
    }
  }, [analyze, analysisBusy, detail])

  const browserClip = useCallback((text: string): void => {
    setCaptureText(text)
    setBrowserOpen(false)
    requestAnimationFrame(() => {
      captureInputRef.current?.focus()
    })
  }, [])

  const openSource = useCallback((url: string | undefined) => {
    if (url === undefined) return
    setBrowserUrl(url)
    setBrowserOpen(true)
  }, [])

  return (
    <div className={css.app} data-testid="trellis-home">
      <header className={css.header}>
        <div>
          <h1 className={css.title}>{t('title')}</h1>
          <p className={css.subtitle}>{t('subtitle')}</p>
        </div>
        <div className={css.headerRight}>
          <div className={css.stats}>
            <span>{payload?.stats.totalDocuments ?? 0} {t('documents')}</span>
            <span>{payload?.stats.totalRelations ?? 0} {t('relations')}</span>
            <span>{payload?.stats.totalTags ?? 0} {t('tags')}</span>
            {loading && <span className={css.muted}>{t('status.syncing')}</span>}
          </div>
          <div className={css.viewToggle} role="group" aria-label="视图切换">
            <button
              type="button"
              className={`${css.viewButton} ${viewMode === 'list' ? css.viewButtonActive : ''}`}
              onClick={() => { setViewMode('list') }}
            >
              {t('view.list')}
            </button>
            <button
              type="button"
              className={`${css.viewButton} ${viewMode === 'canvas' ? css.viewButtonActive : ''}`}
              onClick={() => { setViewMode('canvas') }}
            >
              {t('view.canvas')}
            </button>
          </div>
          <button
            type="button"
            className={css.browserButton}
            onClick={() => { setBrowserUrl(undefined); setBrowserOpen(true) }}
          >
            {t('browser.open')}
          </button>
          <span data-dph-taskboard-mount className={css.taskboardMount} />
        </div>
      </header>

      <div
        className={css.capture}
        onDragOver={(event) => { event.preventDefault() }}
        onDrop={(event) => { void handleDrop(event) }}
      >
        <input
          ref={captureInputRef}
          className={css.captureInput}
          value={captureText}
          onChange={(event) => { setCaptureText(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCapture()
          }}
          placeholder={t('capture.placeholder')}
          aria-label={t('capture.placeholder')}
        />
        <button
          type="button"
          className={css.captureButton}
          onClick={() => { void handleCapture() }}
          disabled={captureBusy || captureText.trim() === ''}
        >
          {captureBusy ? t('capture.running') : t('capture.action')}
        </button>
      </div>

      {error !== null && <div className={css.error} role="alert">{error}</div>}

      <div className={css.body}>
        {viewMode === 'list' ? (
          <main className={css.list}>
            <input
              className={css.search}
              value={search}
              onChange={(event) => { setSearch(event.target.value) }}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
            />
            {filteredDocs.length === 0 ? (
              <p className={css.empty}>{t('empty.documents')}</p>
            ) : (
              <ul className={css.docList}>
                {filteredDocs.map(doc => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className={`${css.docItem} ${doc.id === selectedId ? css.docItemActive : ''}`}
                      onClick={() => { setSelectedId(doc.id) }}
                    >
                      <span className={css.docTitle}>{doc.title}</span>
                      <span className={css.docSummary}>{doc.summary}</span>
                      <span className={css.docMeta}>
                        {doc.kind} · {doc.tags.slice(0, 3).join(', ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </main>
        ) : (
          <main className={css.canvasPane}>
            <KnowledgeCanvas
              documents={payload?.documents ?? []}
              edges={canvasEdges}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id) }}
            />
          </main>
        )}

        <aside className={css.detail}>
          {detail === null ? (
            <p className={css.empty}>{t('empty.detail')}</p>
          ) : (
            <>
              <div className={css.detailHeader}>
                <div>
                  <h2 className={css.detailTitle}>{detail.title}</h2>
                  <p className={css.detailMeta}>
                    {t('detail.source')}: {detail.source.url ?? detail.source.name ?? detail.source.type}
                    {' · '}
                    {t('detail.created')}: {detail.createdAt.slice(0, 10)}
                  </p>
                </div>
                <button
                  type="button"
                  className={css.closeButton}
                  onClick={() => { setSelectedId(null) }}
                  aria-label={t('detail.close')}
                >
                  {t('detail.close')}
                </button>
              </div>

              <div className={css.detailTags}>
                {detail.tags.map(tag => (
                  <span key={tag} className={css.tag}>{tag}</span>
                ))}
              </div>

              {detail.source.url !== undefined && (
                <button
                  type="button"
                  className={css.sourceButton}
                  onClick={() => { openSource(detail.source.url) }}
                >
                  {t('source.open')}
                </button>
              )}

              <div className={css.content}>{detail.content || detail.summary}</div>

              <div className={css.analysis}>
                <div className={css.deepread}>
                  <span className={css.deepreadLabel}>{t('deepread.title')}</span>
                  <div className={css.deepreadModes}>
                    <button type="button" className={css.deepreadButton} onClick={() => { void handleDeepRead('quick') }}>{t('deepread.quick')}</button>
                    <button type="button" className={css.deepreadButton} onClick={() => { void handleDeepRead('deep') }}>{t('deepread.deep')}</button>
                    <button type="button" className={css.deepreadButton} onClick={() => { void handleDeepRead('map') }}>{t('deepread.map')}</button>
                    <button type="button" className={css.deepreadButton} onClick={() => { void handleDeepRead('feynman') }}>{t('deepread.feynman')}</button>
                    <button type="button" className={css.deepreadButton} onClick={() => { void handleDeepRead('book') }}>{t('deepread.book')}</button>
                  </div>
                </div>

                <textarea
                  className={css.analysisInput}
                  value={question}
                  onChange={(event) => { setQuestion(event.target.value) }}
                  placeholder={t('detail.analysis.placeholder')}
                  rows={3}
                />
                <button
                  type="button"
                  className={css.captureButton}
                  onClick={() => { void handleAnalyze() }}
                  disabled={analysisBusy || question.trim() === ''}
                >
                  {analysisBusy ? t('capture.running') : t('detail.analysis.action')}
                </button>

                {analysisItems.length === 0 ? (
                  <p className={css.empty}>{t('analysis.empty')}</p>
                ) : (
                  <div className={css.transcript}>
                    {analysisItems.map((item, index) => (
                      <div key={`${item.role}-${index}`} className={item.role === 'user' ? css.userLine : css.assistantLine}>
                        {item.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {browserOpen && (
        <div className={css.browserBackdrop} data-testid="trellis-browser-drawer">
          <div className={css.browserDrawer}>
            <div className={css.browserHeader}>
              <h2 className={css.browserTitle}>{t('browser.title')}</h2>
              <button
                type="button"
                className={css.closeButton}
                onClick={() => { setBrowserOpen(false) }}
                aria-label={t('browser.close')}
              >
                ✕
              </button>
            </div>
            <div className={css.browserBody}>
              <CompanionBrowser
                t={t}
                initialUrl={browserUrl}
                onClip={browserClip}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
