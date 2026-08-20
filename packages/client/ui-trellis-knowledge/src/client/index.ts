/**
 * Client plugin for the Transparent Trellis Knowledge Hub.
 * Registers the 'trellis_knowledge' conversation.view slot tab and locale dictionaries.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-knowledge/client
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { TrellisKnowledgeView } from './TrellisKnowledgeView.tsx'
import { TrellisKnowledgeDock } from './TrellisKnowledgeDock.tsx'
import { en, NS, zh } from './locales.ts'

export { TrellisKnowledgeView } from './TrellisKnowledgeView.tsx'
export { TrellisKnowledgeDock } from './TrellisKnowledgeDock.tsx'
export type { TrellisKnowledgeViewProps } from './TrellisKnowledgeView.tsx'
export type { TrellisKnowledgeDockProps } from './TrellisKnowledgeDock.tsx'
export { NS, en, zh } from './locales.ts'
export type { TrellisKnowledgeKey } from './locales.ts'

/** Service dependencies for this client plugin. */
export const inject = ['slots', 'locale']

/**
 * Apply the client plugin: register locale dictionary and 'trellis_knowledge' conversation.view slot.
 * @param ctx - client runtime context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-trellis-knowledge: locale')

  const t = ctx.locale.bind(NS)

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'trellis_knowledge',
    order: 10,
    locale: NS,
    label: () => t('view.knowledge'),
  }, TrellisKnowledgeView))

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'trellis_knowledge_dock',
    order: 5,
    locale: NS,
  }, TrellisKnowledgeDock))
}
