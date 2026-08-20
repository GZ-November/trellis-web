/**
 * Package-owned invariant companion for the Transparent Trellis Knowledge Hub.
 * @module @deepseek-ai/dsh-client-ui-trellis-knowledge/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-trellis-knowledge'

/** Cordis companion plugin name. */
export const name = 'client-ui-trellis-knowledge-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the locale and conversation view tab registrations are
 * registry-owned, and transparent knowledge inspection state is component-local.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - context carrying the invariant registry.
 * @returns the registration disposer after setup.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
