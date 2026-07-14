<script lang="ts">
  import { onMount, onDestroy, type Snippet } from 'svelte'
  import { useStudio, ToolbarItem, DropDownPane } from '@threlte/studio/extend'
  // Internal Studio modules — types provided by studio-types.d.ts
  import { useObjectSelection } from '@threlte/studio/extensions/object-selection/useObjectSelection.svelte'
  import { useTransactions } from '@threlte/studio/extensions/transactions/useTransactions'
  import { vitePluginEnabled } from '@threlte/studio/extensions/transactions/vitePluginEnabled'
  import { getThrelteStudioUserData } from '@threlte/studio/internal/getThrelteStudioUserData'
  import type { Object3D } from 'three'
  import { ScrollAnimator } from '$lib/spark/ScrollAnimator'
  import type { ScrollKeyframe } from '$lib/spark/scrollAnimation'
  import {
    clampPercentage,
    upsertKeyframe,
    deleteKeyframe,
    canonicalizeKeyframes,
  } from '$lib/spark/scrollAnimation'
  import { guardScrollAnimatorTransactions, isScrollAnimator } from './transactionGuard'

  let { children }: { children?: Snippet } = $props()

  const { createExtension } = useStudio()
  const objectSelection = useObjectSelection()
  const transactions = useTransactions()

  // Extension state
  const extension = createExtension({
    scope: 'scroll-animator',
    state: ({ persist }) => ({
      currentPercentage: persist<number>(0),
      paneVisible: persist<boolean>(true),
    }),
    actions: {},
  })

  // Transaction guard: suppress source sync for ScrollAnimator transforms
  let unsubscribeGuard: (() => void) | undefined

  // Reactive derived values
  const selectedObjects = $derived(objectSelection.selectedObjects ?? [])
  const singleAnimator = $derived<Object3D | null>(
    selectedObjects.length === 1 && isScrollAnimator(selectedObjects[0])
      ? selectedObjects[0]
      : null,
  )

  // Mutable state held in a plain object to allow $effect reassignment
  let uiState = $state({
    animator: null as Object3D | null,
    keyframes: [] as ScrollKeyframe[],
    percentageInput: '0',
  })

  // Keep animator/keyframes in sync with selection
  $effect(() => {
    const sa = singleAnimator
    uiState.animator = sa
    if (sa && sa instanceof ScrollAnimator) {
      uiState.keyframes = [...sa.keyframes]
    } else {
      uiState.keyframes = []
    }
  })

  // Read the current scroll percentage from the document
  function readCurrentPercentage(): number {
    if (typeof window === 'undefined') return 0
    const spacer = document.querySelector<HTMLElement>('.scroll-spacer')
    if (!spacer) return 0

    const spacerTop = spacer.getBoundingClientRect().top + window.scrollY
    const spacerHeight = spacer.scrollHeight
    const scrollY = window.scrollY
    const progress = Math.max(0, Math.min(1, (scrollY - spacerTop) / (spacerHeight - window.innerHeight)))
    return clampPercentage(progress * 100)
  }

  // Sync percentage display periodically
  let syncInterval: number | null = null

  onMount(() => {
    // Guard transactions
    unsubscribeGuard = transactions.onTransaction((txs: unknown[]) => {
      guardScrollAnimatorTransactions(txs as Parameters<typeof guardScrollAnimatorTransactions>[0])
    })

    // Periodically sync the percentage display
    syncInterval = window.setInterval(() => {
      const pct = readCurrentPercentage()
      extension.state.currentPercentage = pct
      uiState.percentageInput = pct.toFixed(2)
    }, 100)
  })

  onDestroy(() => {
    unsubscribeGuard?.()
    if (syncInterval !== null) {
      window.clearInterval(syncInterval)
      syncInterval = null
    }
  })

  // Get the source metadata for a ScrollAnimator
  function getSourceMetadata(obj: Object3D) {
    const meta = getThrelteStudioUserData(obj)
    if (!meta) return null
    return {
      moduleId: meta.moduleId,
      componentIndex: meta.index,
    }
  }

  // Jump to a percentage
  function jumpToPercentage(percent: number): void {
    const clamped = clampPercentage(percent)
    const spacer = document.querySelector<HTMLElement>('.scroll-spacer')
    if (!spacer) return

    const spacerTop = spacer.getBoundingClientRect().top + window.scrollY
    const spacerHeight = spacer.scrollHeight
    const viewHeight = window.innerHeight
    const range = spacerHeight - viewHeight
    const targetScroll = spacerTop + (clamped / 100) * range
    window.scrollTo(0, targetScroll)
  }

  // Handle percentage input
  function handlePercentageInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    uiState.percentageInput = val
  }

  function handlePercentageCommit() {
    const parsed = parseFloat(uiState.percentageInput)
    if (isNaN(parsed)) {
      uiState.percentageInput = extension.state.currentPercentage.toFixed(2)
      return
    }
    const clamped = clampPercentage(parsed)
    uiState.percentageInput = clamped.toFixed(2)
    jumpToPercentage(clamped)
  }

  // Insert/save keyframe
  function handleInsertKeyframe(): void {
    const animator = uiState.animator
    if (!animator || !(animator instanceof ScrollAnimator)) return
    if (!vitePluginEnabled) return

    const currentPct = extension.state.currentPercentage
    const normalized = clampPercentage(currentPct)

    // Read local position and Euler rotation from the animator
    const pos = [
      Math.round(animator.position.x * 10000) / 10000,
      Math.round(animator.position.y * 10000) / 10000,
      Math.round(animator.position.z * 10000) / 10000,
    ] as [number, number, number]

    const euler = animator.rotation.toArray()
    const rot = [
      Math.round(euler[0] * 10000) / 10000,
      Math.round(euler[1] * 10000) / 10000,
      Math.round(euler[2] * 10000) / 10000,
    ] as [number, number, number]

    const newKeyframes = upsertKeyframe(animator.keyframes, normalized, pos, rot)

    // Commit as a transaction with source sync
    const meta = getSourceMetadata(animator)
    if (!meta) return

    const historicKeyframes = canonicalizeKeyframes(animator.keyframes)

    const tx = transactions.buildTransaction({
      object: animator,
      propertyPath: 'keyframes',
      value: newKeyframes,
      historicValue: historicKeyframes,
      createHistoryRecord: true,
      sync: true,
    })

    // Override sync metadata to target the correct source location
    tx.sync = {
      attributeName: 'keyframes',
      componentIndex: meta.componentIndex,
      moduleId: meta.moduleId,
      precision: 4,
    }

    transactions.commit([tx])

    // Update local state immediately
    animator.keyframes = newKeyframes
    uiState.keyframes = [...newKeyframes]
  }

  // Delete keyframe
  function handleDeleteKeyframe(scroll: number): void {
    const animator = uiState.animator
    if (!animator || !(animator instanceof ScrollAnimator)) return
    if (!vitePluginEnabled) return

    const newKeyframes = deleteKeyframe(animator.keyframes, scroll)

    const meta = getSourceMetadata(animator)
    if (!meta) return

    const historicKeyframes = canonicalizeKeyframes(animator.keyframes)

    const tx = transactions.buildTransaction({
      object: animator,
      propertyPath: 'keyframes',
      value: newKeyframes,
      historicValue: historicKeyframes,
      createHistoryRecord: true,
      sync: true,
    })

    tx.sync = {
      attributeName: 'keyframes',
      componentIndex: meta.componentIndex,
      moduleId: meta.moduleId,
      precision: 4,
    }

    transactions.commit([tx])

    // Update local state immediately
    animator.keyframes = newKeyframes
    uiState.keyframes = [...newKeyframes]
  }

  // Jump to keyframe percentage
  function handleJumpToKeyframe(scroll: number): void {
    jumpToPercentage(scroll)
  }
</script>

<ToolbarItem position="left">
  <DropDownPane
    title="Scroll Animator"
    visible={extension.state.paneVisible}
    toggle={() => {
      extension.state.paneVisible = !extension.state.paneVisible
    }}
  >
    {#if !uiState.animator}
      <div class="sa-no-selection">Select one ScrollAnimator</div>
    {:else if !vitePluginEnabled}
      <div class="sa-no-sync">
        <div class="sa-animator-name">{uiState.animator.name || 'ScrollAnimator'}</div>
        <div class="sa-warning">Studio source sync unavailable</div>
        <div class="sa-keyframes">
          {#each uiState.keyframes as kf}
            <div class="sa-kf-row">
              <button
                class="sa-kf-pct"
                type="button"
                onclick={() => handleJumpToKeyframe(kf.scroll)}
              >
                {kf.scroll.toFixed(2)}%
              </button>
              <span class="sa-kf-pos">[{kf.position.map((v) => v.toFixed(2)).join(', ')}]</span>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="sa-panel">
        <div class="sa-animator-name">{uiState.animator.name || 'ScrollAnimator'}</div>

        <!-- Current percentage -->
        <div class="sa-percent-row">
          <label class="sa-label" for="sa-percent-input">Percentage:</label>
          <input
            id="sa-percent-input"
            type="number"
            class="sa-percent-input"
            min="0"
            max="100"
            step="0.01"
            value={uiState.percentageInput}
            oninput={handlePercentageInput}
            onkeydown={(e) => {
              if (e.key === 'Enter') handlePercentageCommit()
            }}
            onblur={handlePercentageCommit}
          />
          <span class="sa-percent-display">{extension.state.currentPercentage.toFixed(2)}%</span>
        </div>

        <!-- Keyframe list -->
        <div class="sa-keyframes">
          {#each uiState.keyframes as kf}
            <div class="sa-kf-row">
              <button
                class="sa-kf-pct"
                onclick={() => handleJumpToKeyframe(kf.scroll)}
                title="Jump to {kf.scroll.toFixed(2)}%"
              >
                {kf.scroll.toFixed(2)}%
              </button>
              <span class="sa-kf-pos">[{kf.position.map((v) => v.toFixed(2)).join(', ')}]</span>
              <button
                class="sa-kf-delete"
                onclick={() => handleDeleteKeyframe(kf.scroll)}
                title="Delete keyframe"
                aria-label="Delete keyframe at {kf.scroll.toFixed(2)}%"
              >
                ✕
              </button>
            </div>
          {/each}
        </div>

        <!-- Insert keyframe button -->
        <button class="sa-insert-btn" onclick={handleInsertKeyframe}>
          Insert/save scroll keyframe
        </button>
      </div>
    {/if}
  </DropDownPane>
</ToolbarItem>

{@render children?.()}

<style>
  .sa-no-selection {
    padding: 8px;
    color: #888;
    font-size: 12px;
  }

  .sa-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px;
  }

  .sa-animator-name {
    font-weight: 600;
    font-size: 12px;
    color: #ccc;
    margin-bottom: 2px;
  }

  .sa-no-sync {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px;
  }

  .sa-warning {
    color: #f0ad4e;
    font-size: 11px;
    font-style: italic;
  }

  .sa-percent-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .sa-label {
    color: #999;
    white-space: nowrap;
  }

  .sa-percent-input {
    width: 60px;
    padding: 2px 4px;
    font-size: 11px;
    background: #333;
    color: #e0e0e0;
    border: 1px solid #555;
    border-radius: 3px;
  }

  .sa-percent-display {
    color: #6366f1;
    font-weight: 600;
  }

  .sa-keyframes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow-y: auto;
  }

  .sa-kf-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 11px;
    background: #2a2a2a;
  }

  .sa-kf-pct {
    color: #6366f1;
    cursor: pointer;
    font-weight: 600;
    min-width: 50px;
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    text-align: left;
  }

  .sa-kf-pct:hover {
    text-decoration: underline;
  }

  .sa-kf-pos {
    color: #888;
    flex: 1;
    font-family: monospace;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sa-kf-delete {
    color: #f87171;
    cursor: pointer;
    background: none;
    border: none;
    font-size: 12px;
    padding: 0 4px;
    line-height: 1;
  }

  .sa-kf-delete:hover {
    color: #ff4444;
  }

  .sa-insert-btn {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    border: none;
    border-radius: 4px;
    background: #6366f1;
    color: #fff;
    cursor: pointer;
    margin-top: 4px;
  }

  .sa-insert-btn:hover {
    background: #4f46e5;
  }
</style>
