/**
 * Client plugin for the Trellis In-App Web Browser and MarkItDown Clipper.
 * Registers the browser view tab into the conversation view slot.
 *
 * @module @deepseek-ai/dsh-client-ui-trellis-browser/client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row must be in the program.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, NS, zh } from './locales.ts'
import { TrellisBrowserDrawer } from './TrellisBrowserDrawer.tsx'

export { NS } from './locales.ts'
export { TrellisBrowserView } from './TrellisBrowserView.tsx'
export { TrellisBrowserDrawer } from './TrellisBrowserDrawer.tsx'
export type { TrellisBookmark, TrellisBrowserViewProps } from './TrellisBrowserView.tsx'
export type { TrellisBrowserDrawerProps } from './TrellisBrowserDrawer.tsx'

/** Required services: the slot service and locale. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the browser drawer into header utilities.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-trellis-browser: dictionaries')

  ctx.slots.inject(
    'conversation.session.header.utilities',
    () => ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'trellis_browser_drawer',
      order: 10,
      locale: NS,
    }, TrellisBrowserDrawer),
  )
}
