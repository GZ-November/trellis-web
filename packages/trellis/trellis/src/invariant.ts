/**
 * Package-owned invariant companion for `@trellis/trellis`.
 * @module @trellis/trellis/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { DomainChanged } from '@deepseek-ai/dsh-storage-domain'
import type {} from './knowledge.ts'

const PACKAGE_NAME = '@trellis/trellis'

/** Cordis companion plugin name. */
export const name = 'trellis-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Check every package-owned directed relation against the current document set. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  const check = (): void => {
    const problem = ctx.trellisKnowledge.diagnose()
    if (problem !== undefined) fail(problem)
  }
  check()
  ctx.on('domain/changed', (change: DomainChanged) => {
    if (change.domain === 'trellis' && change.table === 'knowledge_documents') check()
  }, { global: true })
}, { inject: ['trellisKnowledge'] })

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
