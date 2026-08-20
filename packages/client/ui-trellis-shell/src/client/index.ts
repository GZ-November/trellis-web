/**
 * Trellis workbench shell client plugin. Registers a full-screen knowledge
 * surface into the root slot with a lower priority than the regular layout,
 * so this profile presents the chat-free workbench UI while keeping the
 * sessions/workspaces services underneath for capture and analysis.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-shell/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { TrellisHome } from './TrellisHome.tsx'
import type { TrellisCaptureInput } from './TrellisHome.tsx'
import { TrellisSessionSource } from './session-source.ts'
import { en, NS, zh } from './locales.ts'
import type { TrellisShellKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Trellis workbench shell copy. */
    'ui-trellis-shell': TrellisShellKey
  }
}

export { TrellisHome } from './TrellisHome.tsx'
export { TrellisSessionSource } from './session-source.ts'
export type { TrellisCaptureInput, TrellisHomeProps, TrellisShellInjected } from './TrellisHome.tsx'
export { NS, en, zh } from './locales.ts'
export type { TrellisShellKey } from './locales.ts'

/** Services required by the Trellis shell. */
export const inject = ['slots', 'locale', 'sessions', 'workspaces']

/**
 * Resolve the session the shell uses for capture and analysis. Reuses the
 * current session when one is open; otherwise connects the first workspace
 * and opens its blank session.
 * @param ctx - client context with sessions and workspaces.
 * @returns the session face, or undefined when no workspace exists.
 */
async function ensureSession(ctx: ClientContext): Promise<SessionFace | undefined> {
  const current = ctx.sessions.list.getSnapshot().current
  if (current !== undefined) {
    const binding = ctx.sessions.binding(current)
    if (binding !== undefined) return binding.session
  }
  const workspaces = ctx.workspaces.list.getSnapshot()
  const workspace = workspaces.items[0]
  if (workspace === undefined) return undefined
  const sessionId = await ctx.workspaces.connectWorkspace(workspace.workspaceId)
  ctx.sessions.open(sessionId)
  return ctx.sessions.binding(sessionId)?.session
}

/**
 * Apply the Trellis shell plugin: register locale and root-slot surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-trellis-shell: locale')

  const source = new TrellisSessionSource(ctx.sessions)

  const capture = async (input: TrellisCaptureInput): Promise<void> => {
    const session = await ensureSession(ctx)
    if (session === undefined) throw new Error('Trellis: no workspace available')
    let text: string
    if (input.file !== undefined) {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-file-name': encodeURIComponent(input.file.name),
          'x-session-id': session.sessionId,
        },
        body: input.file,
      })
      if (!res.ok) throw new Error(`Trellis: upload failed (HTTP ${res.status})`)
      const payload = (await res.json()) as { relativePath?: string; path?: string }
      const filePath = payload.relativePath ?? payload.path ?? input.file.name
      text = [
        '[trellis-capture]',
        `请把上传的文件（路径：${filePath}）整理进知识库。`,
        '先用 read_document 读取并转成 Markdown，再用 trellis_ingest 归档、总结、打标签、建立关联。',
      ].join('\n')
    } else {
      const lines = ['[trellis-capture]']
      if (input.url !== undefined) lines.push(`请把这条链接整理进知识库：${input.url}`)
      if (input.fileName !== undefined) lines.push(`文件名：${input.fileName}`)
      if (input.content !== undefined) lines.push(`内容：\n${input.content}`)
      text = lines.join('\n')
    }
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (!result.ok) throw new Error(result.error.message)
  }

  const analyze = async (doc: { id: string; title: string }, question: string): Promise<void> => {
    const session = await ensureSession(ctx)
    if (session === undefined) throw new Error('Trellis: no workspace available')
    const text = [
      '[trellis-analysis]',
      `请基于知识库文档《${doc.title}》(id: ${doc.id}) 做深度分析。`,
      `问题：${question}`,
      '请先用 trellis_read 获取全文，再结合 trellis_search 和 trellis_graph 查找关联资料，最后给出有依据的详细分析。',
    ].join('\n')
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (!result.ok) throw new Error(result.error.message)
  }

  ctx.effect(() => {
    const dispose = ctx.slots.register({
      name: 'root',
      priority: -1,
      locale: NS,
      inject: () => ({
        capture,
        analyze,
        hooks: { trellisSession: source },
      }),
    }, TrellisHome)
    return dispose
  }, 'ui-trellis-shell: root registration')
}
