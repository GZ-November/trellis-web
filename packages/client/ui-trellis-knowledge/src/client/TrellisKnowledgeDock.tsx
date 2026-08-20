/**
 * Compact Trellis Knowledge Dock above the composer.
 *
 * Chat-first collection surface: it advertises the live knowledge stats and
 * opens the knowledge hub / companion browser, while the composer below stays
 * the single place where links and documents are captured.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-knowledge/client/TrellisKnowledgeDock
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { zh, type TrellisKnowledgeKey } from './locales.ts'
import css from './TrellisKnowledgeDock.module.css'

export type TrellisKnowledgeDockProps = Partial<PropsRuntime<'conversation.input.dock'>> & Partial<PropsLocale<'ui-trellis-knowledge'>>

interface KnowledgeStats {
  readonly totalDocuments: number
  readonly totalRelations: number
  readonly totalTags: number
}

/**
 * Interactive knowledge strip above the input bar.
 */
export function TrellisKnowledgeDock(props: TrellisKnowledgeDockProps): ReactElement {
  const t = props.t ?? ((key: TrellisKnowledgeKey) => zh[key])
  const [stats, setStats] = useState<KnowledgeStats>({
    totalDocuments: 0,
    totalRelations: 0,
    totalTags: 0,
  })

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/trellis/knowledge')
        if (!res.ok) return
        const data = (await res.json()) as { ok: boolean; stats?: KnowledgeStats }
        if (!cancelled && data.ok && data.stats) {
          setStats(data.stats)
        }
      } catch {
        // quiet fallback
      }
    }
    void fetchStats()
    const timer = window.setInterval(fetchStats, 6000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const handleOpenKnowledge = () => {
    window.dispatchEvent(new CustomEvent('trellis:switch-view', { detail: { view: 'trellis_knowledge' } }))
  }

  const handleOpenBrowser = () => {
    window.dispatchEvent(new CustomEvent('trellis:open-browser', {}))
  }

  return (
    <aside className={css.dockRoot} data-testid="trellis-knowledge-dock">
      <div className={css.dockMain}>
        <span className={css.dockBadge}>Trellis</span>
        <span className={css.dockTitle}>{t('dock.title')}</span>
        <span className={css.dockStats}>
          {stats.totalDocuments} {t('dock.documents')}
          <span className={css.dockDot}>·</span>
          {stats.totalRelations} {t('dock.relations')}
          <span className={css.dockDot}>·</span>
          {stats.totalTags} {t('dock.tags')}
        </span>
        <span className={css.dockSpacer} />
        <button
          type="button"
          className={css.primaryBtn}
          onClick={handleOpenKnowledge}
          title={t('dock.open')}
        >
          {t('dock.open')}
        </button>
        <button
          type="button"
          className={css.secondaryBtn}
          onClick={handleOpenBrowser}
          title={t('dock.browser')}
        >
          {t('dock.browser')}
        </button>
      </div>
      <p className={css.dockHint}>{t('dock.hint')}</p>
    </aside>
  )
}
