// Type declarations for @threlte/studio internal modules not in the package exports map.
// These are used by the ScrollAnimator extension to access object selection, transactions,
// and source metadata APIs.

declare module '@threlte/studio/extensions/object-selection/useObjectSelection.svelte' {
  import type { Object3D } from 'three'
  export const useObjectSelection: () => {
    readonly selectedObjects: Object3D[]
    readonly inUse: boolean | undefined
    selectObjects: (objects: Object3D[]) => void
    clearSelection: () => void
    addToSelection: (objects: Object3D[]) => void
    removeFromSelection: (objects: Object3D[]) => void
    toggleSelection: (objects: Object3D[]) => void
  }
}

declare module '@threlte/studio/extensions/transactions/useTransactions' {
  import type { Transaction } from '@threlte/studio/extensions/transactions/TransactionQueue/TransactionQueue.svelte'
  import type { Object3D } from 'three'
  export const useTransactions: () => {
    commit: (transactions: Transaction<any, any>[]) => void
    undo: () => void
    redo: () => void
    onTransaction: (callback: (transactions: Transaction<any, any>[]) => void) => (() => void) | undefined
    onCommit: (callback: (transactions: Transaction<any, any>[]) => void) => (() => void) | undefined
    onUndo: (callback: (transactions: Transaction<any, any>[]) => void) => (() => void) | undefined
    onRedo: (callback: (transactions: Transaction<any, any>[]) => void) => (() => void) | undefined
    openInEditor: (object: Object3D) => void
    openSelectedInEditor: () => void
    buildTransaction: <T>(opts: {
      object: any
      propertyPath: string
      value: T
      historicValue?: T
      createHistoryRecord?: boolean
      sync?: boolean
    }) => Transaction<any, any>
    vitePluginEnabled: boolean
  }
}

declare module '@threlte/studio/extensions/transactions/vitePluginEnabled' {
  export const vitePluginEnabled: boolean
}

declare module '@threlte/studio/internal/getThrelteStudioUserData' {
  import type { StudioProps } from '@threlte/studio'
  export const getThrelteStudioUserData: (object: unknown) => StudioProps | undefined
}
