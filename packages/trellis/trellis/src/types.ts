/**
 * Public identifiers for Trellis knowledge documents and relations.
 * @module @trellis/trellis/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one archived Trellis knowledge document. */
export type TrellisDocumentId = Branded<'TrellisDocumentId'>

/** Stable identity of one directed relation between two Trellis documents. */
export type TrellisRelationId = Branded<'TrellisRelationId'>
