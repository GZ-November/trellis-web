/**
 * Browser registration for the dedicated `trellis_graph` tool view.
 * @module @deepseek-ai/dsh-client-ui-trellis-graph/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { TrellisGraphRow } from './TrellisGraphRow.tsx'
import { en, NS, zh, type TrellisGraphKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Interactive Trellis graph copy. */
    trellisGraph: TrellisGraphKey
  }
}

/** Services required by the Trellis graph renderer. */
export const inject = ['slots', 'locale']

/**
 * Register dictionaries and replace the generic row for `trellis_graph`.
 * @param ctx - browser root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-trellis-graph: dictionaries')
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'trellis_graph', locale: NS },
    TrellisGraphRow,
  ))
}
