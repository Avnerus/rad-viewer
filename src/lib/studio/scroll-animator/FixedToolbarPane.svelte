<script lang="ts">
  import { onMount, onDestroy, tick, type Snippet } from 'svelte'
  import { ToolbarButton, ToolbarItem } from '@threlte/studio/extend'
  import { autoUpdate, computePosition, flip, offset, shift, type ComputePositionReturn } from '@floating-ui/dom'

  let { children }: { children?: Snippet } = $props()

  let anchorEl = $state<HTMLElement>()
  let panelEl = $state<HTMLElement>()
  let open = $state(false)
  let stopAutoUpdate: (() => void) | undefined

  /** Simple portal action: moves element to document.body on mount, removes on destroy */
  function portal(node: HTMLElement): { destroy: () => void } {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }

  /**
   * Position the panel with a stale-result guard.
   * Captures current anchor/panel references so a resolved promise from
   * a previous open cycle cannot write stale coords onto a new panel.
   */
  function updatePosition(): void {
    const anchor = anchorEl
    const panel = panelEl
    if (!anchor || !panel) return
    computePosition(anchor, panel, {
      strategy: 'fixed',
      placement: 'bottom',
      middleware: [offset(2), flip(), shift({ padding: 6 })],
    }).then((pos: ComputePositionReturn) => {
      // Only apply if this is still the current open panel (same identity)
      if (panelEl === panel && open) {
        Object.assign(panelEl.style, {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
        })
      }
    })
  }

  async function openPanel(): Promise<void> {
    open = true
    await tick() // let Svelte render the panel element in the portal
    if (!open || !anchorEl || !panelEl) return
    stopAutoUpdate?.()
    stopAutoUpdate = autoUpdate(anchorEl, panelEl, updatePosition)
  }

  function closePanel(): void {
    open = false
    stopAutoUpdate?.()
    stopAutoUpdate = undefined
  }

  function togglePanel(): void {
    if (open) closePanel()
    else openPanel()
  }

  // Focus the actual toolbar button inside the anchor wrapper
  function focusToggle(): void {
    anchorEl?.querySelector<HTMLButtonElement>('button')?.focus()
  }

  // Close on Escape — return focus to the toggle button
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) {
      closePanel()
      focusToggle()
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown)
    stopAutoUpdate?.()
    stopAutoUpdate = undefined
  })
</script>

<ToolbarItem position="left">
  <div class="scroll-animator-extension">
    <div bind:this={anchorEl} class="sa-anchor-wrapper">
      <ToolbarButton
        icon="mdiAnimationOutline"
        label="Scroll Animator"
        active={open}
        onclick={togglePanel}
      />
    </div>
  </div>
</ToolbarItem>

{#if open}
  <div
    bind:this={panelEl}
    use:portal
    class="sa-panel-tooltip"
    role="dialog"
    aria-modal="false"
    aria-labelledby="sa-panel-heading"
  >
    <h2 id="sa-panel-heading" class="sa-heading">Scroll Animator</h2>
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}

<style>
  .sa-anchor-wrapper {
    display: inline-block;
  }

  :global(.sa-panel-tooltip) {
    position: fixed;
    top: 0;
    left: 0;
    min-width: 200px;
    max-height: 80vh;
    overflow-y: auto;
    background: #222;
    color: #e0e0e0;
    padding: 4px;
    border-radius: 3px;
    font-size: 11px;
    z-index: 1000;
  }
</style>
