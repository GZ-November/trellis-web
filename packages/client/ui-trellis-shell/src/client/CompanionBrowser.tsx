/**
 * Compact in-app companion browser for the Trellis workbench shell.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-shell/client/CompanionBrowser
 */

import { useCallback, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { TrellisShellKey } from './locales.ts'
import css from './CompanionBrowser.module.css'

const DEFAULT_URL = 'https://en.wikipedia.org/wiki/Computer_science'

export interface CompanionBrowserProps {
  readonly t: (key: TrellisShellKey) => string
  readonly initialUrl?: string | undefined
  readonly onClip: (text: string) => void
}

function normalizeUrl(value: string): string {
  const target = value.trim()
  if (target === '') return DEFAULT_URL
  if (/^https?:\/\//i.test(target)) return target
  return `https://${target}`
}

/**
 * A lightweight browser panel: navigate, reload, open externally, and clip
 * the current page back into the shell capture bar.
 */
export function CompanionBrowser(props: CompanionBrowserProps): ReactElement {
  const { t, initialUrl, onClip } = props
  const startUrl = initialUrl ?? DEFAULT_URL
  const [currentUrl, setCurrentUrl] = useState(startUrl)
  const [inputUrl, setInputUrl] = useState(startUrl)
  const [history, setHistory] = useState<readonly string[]>([startUrl])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [iframeKey, setIframeKey] = useState(0)
  const [clipped, setClipped] = useState(false)

  const navigateTo = useCallback((value: string) => {
    const target = normalizeUrl(value)
    setCurrentUrl(target)
    setInputUrl(target)
    setHistory((prev) => {
      const next = [...prev.slice(0, historyIndex + 1), target]
      return next
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const handleBack = useCallback(() => {
    if (historyIndex <= 0) return
    const target = history[historyIndex - 1]
    if (target === undefined) return
    setHistoryIndex(historyIndex - 1)
    setCurrentUrl(target)
    setInputUrl(target)
  }, [history, historyIndex])

  const handleForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const target = history[historyIndex + 1]
    if (target === undefined) return
    setHistoryIndex(historyIndex + 1)
    setCurrentUrl(target)
    setInputUrl(target)
  }, [history, historyIndex])

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault()
    navigateTo(inputUrl)
  }, [inputUrl, navigateTo])

  const handleClip = useCallback(() => {
    onClip(`请帮我归档并整理这个网页：${currentUrl}\n请使用 MarkItDown 提取并结构化要点，建立关键概念的标签与双向关系，并纳入 Trellis 知识图谱。`)
    setClipped(true)
    window.setTimeout(() => { setClipped(false) }, 2500)
  }, [currentUrl, onClip])

  return (
    <div className={css.root} data-testid="companion-browser">
      <form className={css.toolbar} onSubmit={handleSubmit}>
        <button type="button" onClick={handleBack} disabled={historyIndex <= 0} aria-label={t('browser.back')}>{t('browser.back')}</button>
        <button type="button" onClick={handleForward} disabled={historyIndex >= history.length - 1} aria-label={t('browser.forward')}>{t('browser.forward')}</button>
        <button type="button" onClick={() => { setIframeKey(key => key + 1) }} aria-label={t('browser.reload')}>{t('browser.reload')}</button>
        <input
          className={css.urlInput}
          value={inputUrl}
          onChange={(event) => { setInputUrl(event.target.value) }}
          placeholder={t('browser.urlPlaceholder')}
          aria-label="URL"
        />
        <button type="submit">{t('browser.go')}</button>
        <button type="button" onClick={() => { window.open(currentUrl, '_blank', 'noopener,noreferrer') }}>{t('browser.openExternal')}</button>
        <button type="button" className={css.clipButton} onClick={handleClip}>{t('browser.clip')}</button>
        {clipped && <span className={css.clipped} role="status">{t('browser.clipped')}</span>}
      </form>
      <iframe
        className={css.frame}
        key={iframeKey}
        src={currentUrl}
        title={t('browser.title')}
      />
    </div>
  )
}
