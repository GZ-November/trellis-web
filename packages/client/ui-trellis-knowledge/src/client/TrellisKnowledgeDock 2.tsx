/**
 * Quick Knowledge Hub & Companion Browser Action Dock for Trellis.
 * Renders directly above the composer input box, providing 1-click access to
 * the transparent Knowledge Hub, Obsidian Graph, Companion Browser, and quick capture tips.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-knowledge/client/TrellisKnowledgeDock
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './TrellisKnowledgeDock.module.css'

export type TrellisKnowledgeDockProps = Partial<PropsRuntime<'conversation.input.dock'>> & Partial<PropsLocale<'ui-trellis-knowledge'>>

interface KnowledgeStats {
  readonly totalDocuments: number
  readonly totalRelations: number
  readonly totalTags: number
}

/**
 * Interactive Knowledge Hub Dock above the input bar.
 */
export function TrellisKnowledgeDock(_props: TrellisKnowledgeDockProps): ReactElement {
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
      <div className={css.dockHeader}>
        <div className={css.dockTitleCluster}>
          <span className={css.dockBadge}>Trellis</span>
          <h4 className={css.dockTitle}>📚 个人透明知识库</h4>
        </div>
        <span className={css.dockStats}>
          {stats.totalDocuments} 篇文档 · {stats.totalRelations} 条关联 · {stats.totalTags} 个概念
        </span>
      </div>

      <div className={css.actionsRow}>
        <button
          type="button"
          className={css.primaryBtn}
          onClick={handleOpenKnowledge}
          title="查看全部文档台账、证据链与 Obsidian 全景图谱"
        >
          📚 查看知识库与图谱
        </button>
        <button
          type="button"
          className={css.secondaryBtn}
          onClick={handleOpenBrowser}
          title="打开右侧伴学浏览器，支持一边查阅资料一边一键剪藏"
        >
          🌐 伴学浏览器
        </button>
      </div>

      <div className={css.tipsList}>
        <span className={css.tipItem}>📥 粘贴网页链接自动 MarkItDown 剪藏</span>
        <span className={css.tipItem}>📄 拖入 PDF/文档提取概念关联</span>
        <span className={css.tipItem}>✍️ 随手记录闪念想法</span>
      </div>
    </aside>
  )
}
