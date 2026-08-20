/**
 * Bare observable source that follows the current session's conversation
 * snapshot. This is the registrant-private reactive fact delivered through
 * the inject `hooks` compartment, so the shell component receives it as a
 * framework-bound `useTrellisSession` selector hook.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-shell/client/session-source
 */

import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ConversationSnapshot,
  ISessions,
  SessionFace,
  SessionId,
} from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Observable wrapper over the current session's conversation snapshot.
 * Emits when the selected session changes or that session publishes a new
 * snapshot. Returns `null` while no session is current.
 */
export class TrellisSessionSource implements HostObservable<ConversationSnapshot | null> {
  private readonly listeners = new Set<() => void>()
  private current: SessionId | undefined
  private session: SessionFace | undefined
  private unlistenList: (() => void) | undefined
  private unlistenSession: (() => void) | undefined

  /**
   * @param sessions - sessions service whose list and bindings this source follows.
   */
  constructor(private readonly sessions: ISessions) {
    this.current = sessions.list.getSnapshot().current
    this.session = this.resolve(this.current)
  }

  /** @returns the current conversation snapshot, or null when no session is selected. */
  getSnapshot(): ConversationSnapshot | null {
    return this.session?.getSnapshot() ?? null
  }

  /**
   * Subscribe to snapshot changes.
   * @param fn - listener invoked after the selected session or its snapshot changes.
   * @returns unsubscribe function.
   */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    if (this.listeners.size === 1) this.attach()
    return () => {
      this.listeners.delete(fn)
      if (this.listeners.size === 0) this.detach()
    }
  }

  private resolve(id: SessionId | undefined): SessionFace | undefined {
    return id === undefined ? undefined : this.sessions.binding(id)?.session
  }

  private attach(): void {
    this.unlistenList = this.sessions.list.subscribe(() => {
      this.sync()
    })
    this.attachSession()
  }

  private detach(): void {
    this.unlistenList?.()
    this.unlistenList = undefined
    this.unlistenSession?.()
    this.unlistenSession = undefined
    this.session = undefined
  }

  private sync(): void {
    const next = this.sessions.list.getSnapshot().current
    if (next === this.current) return
    this.current = next
    this.attachSession()
    for (const listener of [...this.listeners]) listener()
  }

  private attachSession(): void {
    this.unlistenSession?.()
    this.unlistenSession = undefined
    this.session = this.resolve(this.current)
    if (this.session !== undefined) {
      this.unlistenSession = this.session.subscribe(() => {
        for (const listener of [...this.listeners]) listener()
      })
    }
  }
}
