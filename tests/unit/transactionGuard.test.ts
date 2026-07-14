import { describe, it, expect } from 'vitest'
import { isScrollAnimator, guardScrollAnimatorTransactions } from '$lib/studio/scroll-animator/transactionGuard'
import { ScrollAnimator } from '$lib/spark/ScrollAnimator'
import type { Transaction } from '@threlte/studio/extensions/transactions/TransactionQueue/TransactionQueue.svelte'

describe('isScrollAnimator', () => {
  it('returns true for ScrollAnimator instances', () => {
    expect(isScrollAnimator(new ScrollAnimator())).toBe(true)
  })

  it('returns false for plain objects', () => {
    expect(isScrollAnimator({})).toBe(false)
    expect(isScrollAnimator(null)).toBe(false)
    expect(isScrollAnimator(undefined)).toBe(false)
  })

  it('returns false for objects with isScrollAnimator: false', () => {
    expect(isScrollAnimator({ isScrollAnimator: false })).toBe(false)
  })
})

describe('guardScrollAnimatorTransactions', () => {
  function makeTransaction(
    object: unknown,
    attributeName: string,
  ): Transaction<any, any> {
    return {
      object,
      value: 'test',
      read: () => 'test',
      write: () => {},
      sync: { attributeName, componentIndex: 0, moduleId: 'test' },
    }
  }

  it('suppresses sync for position on ScrollAnimator', () => {
    const animator = new ScrollAnimator()
    const txs: Transaction<any, any>[] = [makeTransaction(animator, 'position')]
    guardScrollAnimatorTransactions(txs)
    expect(txs[0].sync).toBeUndefined()
  })

  it('suppresses sync for rotation on ScrollAnimator', () => {
    const animator = new ScrollAnimator()
    const txs: Transaction<any, any>[] = [makeTransaction(animator, 'rotation')]
    guardScrollAnimatorTransactions(txs)
    expect(txs[0].sync).toBeUndefined()
  })

  it('suppresses sync for scale on ScrollAnimator', () => {
    const animator = new ScrollAnimator()
    const txs: Transaction<any, any>[] = [makeTransaction(animator, 'scale')]
    guardScrollAnimatorTransactions(txs)
    expect(txs[0].sync).toBeUndefined()
  })

  it('allows sync for keyframes on ScrollAnimator', () => {
    const animator = new ScrollAnimator()
    const txs: Transaction<any, any>[] = [makeTransaction(animator, 'keyframes')]
    guardScrollAnimatorTransactions(txs)
    expect(txs[0].sync).toBeDefined()
    expect(txs[0].sync!.attributeName).toBe('keyframes')
  })

  it('leaves non-ScrollAnimator transactions untouched', () => {
    const obj = { isScrollAnimator: false }
    const txs: Transaction<any, any>[] = [makeTransaction(obj, 'position')]
    guardScrollAnimatorTransactions(txs)
    expect(txs[0].sync).toBeDefined()
  })

  it('handles mixed transactions', () => {
    const animator = new ScrollAnimator()
    const other = { name: 'other' }
    const txs: Transaction<any, any>[] = [
      makeTransaction(animator, 'position'),
      makeTransaction(other, 'position'),
      makeTransaction(animator, 'keyframes'),
    ]
    guardScrollAnimatorTransactions(txs)
    expect(txs[0].sync).toBeUndefined() // animator position suppressed
    expect(txs[1].sync).toBeDefined() // other object preserved
    expect(txs[2].sync).toBeDefined() // animator keyframes preserved
  })

  it('handles transactions without sync', () => {
    const animator = new ScrollAnimator()
    const tx: Transaction<any, any> = {
      object: animator,
      value: 'test',
      read: () => 'test',
      write: () => {},
      sync: undefined,
    }
    guardScrollAnimatorTransactions([tx])
    expect(tx.sync).toBeUndefined()
  })
})
