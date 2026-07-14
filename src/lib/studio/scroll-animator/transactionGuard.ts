/**
 * Transaction guard helper: suppress source sync for ScrollAnimator transform
 * attributes while allowing `keyframes` through.
 *
 * For Studio 0.4.3, `onTransaction` callbacks fire before sync requests are
 * enqueued. We clear `transaction.sync` for any non-keyframe attribute on a
 * branded ScrollAnimator.
 */
import type { Transaction } from '@threlte/studio/extensions/transactions/TransactionQueue/TransactionQueue.svelte'

/**
 * Check if an object is a branded ScrollAnimator.
 */
export function isScrollAnimator(obj: unknown): boolean {
  return obj !== null && typeof obj === 'object' && (obj as Record<string, unknown>).isScrollAnimator === true
}

/**
 * Given a set of transactions, suppress source sync for any transaction
 * whose object is a ScrollAnimator and the attribute is not `keyframes`.
 *
 * Mutates the transaction array in place (called from onTransaction callbacks).
 */
export function guardScrollAnimatorTransactions(
  transactions: Transaction<any, any>[],
): void {
  for (const tx of transactions) {
    if (!isScrollAnimator(tx.object)) continue
    const sync = tx.sync
    if (!sync) continue
    // Only allow source sync for `keyframes` attribute
    if (sync.attributeName !== 'keyframes') {
      tx.sync = undefined
    }
  }
}
