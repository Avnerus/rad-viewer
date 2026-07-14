/**
 * Transaction guard helper: suppress source sync for ScrollAnimator transform
 * attributes while allowing `keyframes` through.
 *
 * For Studio 0.4.3, `onTransaction` callbacks fire before sync requests are
 * enqueued. We clear `transaction.sync` for any non-keyframe attribute on a
 * branded ScrollAnimator.
 */

/**
 * Narrow structural transaction type for the guard.
 * Avoids importing the private Transaction type from Studio internals.
 */
export interface GuardTransaction {
  object: unknown
  sync?: {
    attributeName: string
  } | null
}

/**
 * Check if an object is a branded ScrollAnimator (HMR-safe structural check).
 */
export function isScrollAnimator(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'isScrollAnimator' in obj &&
    (obj as Record<string, unknown>).isScrollAnimator === true &&
    typeof (obj as Record<string, unknown>).applyScrollPercentage === 'function'
  )
}

/**
 * Check whether a transaction's attribute name targets `keyframes`.
 * Handles both root attribute ('keyframes') and path-prefixed ('keyframes.xxx').
 */
function isKeyframesAttribute(attributeName: string): boolean {
  return attributeName === 'keyframes' || attributeName.startsWith('keyframes.')
}

/**
 * Given a set of transactions, suppress source sync for any transaction
 * whose object is a ScrollAnimator and the attribute is not `keyframes`.
 *
 * Mutates the transaction array in place (called from onTransaction callbacks).
 */
export function guardScrollAnimatorTransactions(
  transactions: GuardTransaction[],
): void {
  for (const tx of transactions) {
    if (!isScrollAnimator(tx.object)) continue
    const sync = tx.sync
    if (!sync) continue
    // Only allow source sync for `keyframes` attribute
    if (!isKeyframesAttribute(sync.attributeName)) {
      tx.sync = undefined
    }
  }
}
