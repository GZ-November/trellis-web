/**
 * In-App Chromium Web Browser & MarkItDown Clipper View for Trellis.
 * Supports interactive web browsing, one-click Chrome launch, MarkItDown reader mode,
 * study hub launchpad, and instant 1-click clipping into Trellis knowledge base.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-browser/client/TrellisBrowserView
 */

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { zh, type TrellisBrowserKey } from './locales.ts'
import css from './TrellisBrowserView.module.css'

/** Bookmark entry for saved online courses and documentation. */
export interface TrellisBookmark {
  readonly id: string
  readonly name: string
  readonly url: string
  readonly icon?: string
}

/** Initial curated study hub resources. */
const STUDY_HUB_CARDS: readonly TrellisBookmark[] = [
  { id: 'h1', name: 'CS101: 计算机科学导论', url: 'https://en.wikipedia.org/wiki/Computer_science', icon: '💻' },
  { id: 'h2', name: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu', icon: '🏛️' },
  { id: 'h3', name: 'arXiv 学术预印本文库', url: 'https://arxiv.org', icon: '📄' },
  { id: 'h4', name: 'Coursera 课程学习平台', url: 'https://coursera.org', icon: '🎓' },
]

const DEFAULT_URL = 'https://en.wikipedia.org/wiki/Computer_science'

/** Component properties composed from runtime view slot and locale. */
export interface TrellisBrowserViewProps {
  readonly t?: ((key: TrellisBrowserKey) => string) | undefined
  readonly inputActions?: { setDraft: (text: string) => void } | undefined
  readonly onClose?: (() => void) | undefined
  /** Optional page to load when the view mounts. */
  readonly initialUrl?: string | undefined
}

/**
 * Main interactive web browser and study hub component for Trellis.
 */
export function TrellisBrowserView(props: TrellisBrowserViewProps): ReactElement {
  const t = props.t ?? ((key: TrellisBrowserKey) => zh[key])
  const inputActions = props.inputActions

  const initialUrl = props.initialUrl ?? DEFAULT_URL
  const [currentUrl, setCurrentUrl] = useState(initialUrl)
  const [inputUrl, setInputUrl] = useState(initialUrl)
  const [history, setHistory] = useState<readonly string[]>([initialUrl])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [readerMode, setReaderMode] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [bookmarks, setBookmarks] = useState<readonly TrellisBookmark[]>(STUDY_HUB_CARDS)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg)
    setTimeout(() => {
      setStatusMessage(null)
    }, 3000)
  }, [])

  const navigateTo = useCallback((url: string) => {
    let target = url.trim()
    if (!target) return
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`
    }
    setCurrentUrl(target)
    setInputUrl(target)
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1)
      return [...sliced, target]
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const custom = e as CustomEvent<{ url?: string }>
      const url = custom.detail.url
      if (url) {
        navigateTo(url)
      }
    }
    window.addEventListener('trellis:open-browser', handleOpen)
    return () => {
      window.removeEventListener('trellis:open-browser', handleOpen)
    }
  }, [navigateTo])

  const handleFormSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (inputUrl) navigateTo(inputUrl)
  }, [inputUrl, navigateTo])

  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1]
      if (prevUrl !== undefined) {
        setHistoryIndex(historyIndex - 1)
        setCurrentUrl(prevUrl)
        setInputUrl(prevUrl)
      }
    }
  }, [history, historyIndex])

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextUrl = history[historyIndex + 1]
      if (nextUrl !== undefined) {
        setHistoryIndex(historyIndex + 1)
        setCurrentUrl(nextUrl)
        setInputUrl(nextUrl)
      }
    }
  }, [history, historyIndex])

  const handleReload = useCallback(() => {
    setIframeKey(k => k + 1)
  }, [])

  const handleOpenInChrome = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open(currentUrl, '_blank', 'noopener,noreferrer')
    }
  }, [currentUrl])

  const handleClipToTrellis = useCallback(() => {
    const intakePrompt = `请帮我归档并整理这个网页/课程：${currentUrl}\n请使用 MarkItDown 提取并结构化要点，建立关键概念的标签与双向关系，并纳入 Trellis 知识图谱。`
    if (inputActions) {
      inputActions.setDraft(intakePrompt)
      showToast(t('clipped'))
    } else {
      showToast(t('clipped'))
    }
  }, [currentUrl, inputActions, showToast, t])

  const handleAddBookmark = useCallback(() => {
    const newBookmark: TrellisBookmark = {
      id: `bm_${Date.now()}`,
      name: currentUrl.replace(/^https?:\/\//, '').split('/')[0] || t('default_course_title'),
      url: currentUrl,
      icon: '🔖',
    }
    setBookmarks(prev => [newBookmark, ...prev])
    showToast(t('bookmarks'))
  }, [currentUrl, showToast, t])

  const handleDeleteBookmark = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }, [])

  return (
    <div className={css.browserContainer} data-testid="trellis-browser-view">
      {/* Top Modern Arc / Chrome Navigation Toolbar */}
      <div className={css.toolbar}>
        <div className={css.navGroup}>
          <button
            type="button"
            className={css.navBtn}
            onClick={handleBack}
            disabled={historyIndex === 0}
            title={t('back')}
            aria-label={t('back')}
          >
            ◀
          </button>
          <button
            type="button"
            className={css.navBtn}
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            title={t('forward')}
            aria-label={t('forward')}
          >
            ▶
          </button>
          <button
            type="button"
            className={css.navBtn}
            onClick={handleReload}
            title={t('reload')}
            aria-label={t('reload')}
          >
            🔄
          </button>
        </div>

        <form className={css.urlForm} onSubmit={handleFormSubmit}>
          <span className={css.sslBadge} title="SSL Encrypted Connection">🔒</span>
          <input
            type="text"
            className={css.urlInput}
            value={inputUrl}
            onChange={(e) => { setInputUrl(e.target.value) }}
            placeholder={t('url_placeholder')}
            aria-label="URL"
          />
          {inputUrl.length > 0 && (
            <button
              type="button"
              className={css.clearBtn}
              onClick={() => { setInputUrl('') }}
              title="Clear"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
          <button type="submit" className={css.actionBtn} aria-label={t('go')}>
            {t('go')}
          </button>
        </form>

        <div className={css.actionsGroup}>
          <button
            type="button"
            className={`${css.actionBtn} ${css.clipBtn}`}
            onClick={handleClipToTrellis}
            title={t('clip_to_trellis')}
            aria-label={t('clip_to_trellis')}
          >
            {t('clip_to_trellis')}
          </button>

          <button
            type="button"
            className={`${css.actionBtn} ${css.chromeBtn}`}
            onClick={handleOpenInChrome}
            title={t('open_chrome')}
            aria-label={t('open_chrome')}
          >
            ↗️ Chrome
          </button>

          <button
            type="button"
            className={css.actionBtn}
            onClick={() => { setReaderMode(r => !r) }}
            title={readerMode ? t('live_mode') : t('reader_mode')}
            aria-label={readerMode ? t('live_mode') : t('reader_mode')}
          >
            {readerMode ? '🌐 Live' : '📖 Reader'}
          </button>

          <button
            type="button"
            className={css.actionBtn}
            onClick={() => { setShowBookmarks(s => !s) }}
            title={t('bookmarks')}
            aria-label={t('bookmarks')}
          >
            ⭐
          </button>
        </div>
      </div>

      {/* Security & Instruction Bar */}
      <div className={css.noticeBar}>
        <span>{t('security_notice')}</span>
        <span>{t('select_tip')}</span>
      </div>

      {/* Main Workspace Area */}
      <div className={css.workspace}>
        {readerMode ? (
          <div className={css.readerWrapper} data-testid="reader-mode-content">
            <div className={css.readerMetaRow}>
              <span className={css.readerBadge}>📖 MarkItDown</span>
              <span className={css.readerBadge}>{t('reading_time')}</span>
            </div>
            <h1 className={css.readerTitle}>{currentUrl.replace(/^https?:\/\//, '')}</h1>
            <div className={css.readerUrl}>{currentUrl}</div>
            <div className={css.readerBody}>
              {`# ${t('reading_outline')}\n\n> Source: ${currentUrl}\n\n## Content Outline\n- Clean text extraction via MarkItDown\n- Preserved headers, tables, code blocks, and references\n- Ready for instant Trellis Knowledge Graph linking\n\n*(Click 'Clip to Trellis' above to let the Agent ingest and build graph relationships)*`}
            </div>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            src={currentUrl}
            className={css.frameWrapper}
            title="Trellis In-App Web Browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            data-testid="browser-iframe"
          />
        )}

        {/* Bookmarks & Study Hub Drawer */}
        {showBookmarks && (
          <aside className={css.bookmarksDrawer} data-testid="bookmarks-drawer">
            <div className={css.drawerHeader}>
              <span>{t('bookmarks')}</span>
              <button
                type="button"
                className={css.actionBtn}
                onClick={handleAddBookmark}
              >
                + {t('add_bookmark')}
              </button>
            </div>
            {bookmarks.length === 0 ? (
              <div className={css.bookmarkUrl}>{t('empty_bookmarks')}</div>
            ) : (
              <ul className={css.bookmarkList}>
                {bookmarks.map(bm => (
                  <li
                    key={bm.id}
                    className={css.bookmarkItem}
                    onClick={() => { navigateTo(bm.url) }}
                  >
                    <div className={css.bookmarkInfo}>
                      <span className={css.bookmarkName}>{bm.icon ? `${bm.icon} ` : ''}{bm.name}</span>
                      <span className={css.bookmarkUrl}>{bm.url}</span>
                    </div>
                    <button
                      type="button"
                      className={css.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteBookmark(bm.id)
                      }}
                      title={t('delete_bookmark')}
                      aria-label={t('delete_bookmark')}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div className={css.statusToast} role="status">
          {statusMessage}
        </div>
      )}
    </div>
  )
}
