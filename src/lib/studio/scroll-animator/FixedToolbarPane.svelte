<script lang="ts">
  import { onMount, onDestroy, type Snippet } from 'svelte'
  import { ToolbarButton, ToolbarItem } from '@threlte/studio/extend'
  import { computePosition, offset, flip, shift, type ComputePositionReturn } from '@floating-ui/dom'

  let { children }: { children?: Snippet } = $props()

  let anchorEl = $state<HTMLElement>()
  let panelEl = $state<HTMLElement>()
  let open = $state(false)
  let rafId: number | undefined
  let resizeObserver: ResizeObserver | undefined

  /** Simple portal action: moves element to document.body on mount, removes on destroy */
  function portal(node: HTMLElement): { destroy: () => void } {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }

  function openPanel(): void {
    open = true
    requestAnimationFrame(() => {
      if (!anchorEl || !panelEl) return
      positionPanel()
      // Watch for resize only (anchor is in a fixed container, doesn't move on scroll)
      if (resizeObserver) resizeObserver.disconnect()
      resizeObserver = new ResizeObserver(() => {
        if (!anchorEl || !panelEl) return
        positionPanel()
      })
      resizeObserver.observe(anchorEl)
    })
  }

  function closePanel(): void {
    open = false
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = undefined
    }
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId)
      rafId = undefined
    }
  }

  function togglePanel(): void {
    if (open) closePanel()
    else openPanel()
  }

  function positionPanel(): void {
    if (!anchorEl || !panelEl) return
    computePosition(anchorEl, panelEl, {
      strategy: 'fixed',
      placement: 'bottom',
      middleware: [offset(2), flip(), shift({ padding: 6 })],
    }).then((pos: ComputePositionReturn) => {
      if (panelEl) {
        Object.assign(panelEl.style, {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
        })
      }
    })
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) closePanel()
  }

  function handlePointerDown(e: PointerEvent): void {
    if (!open) return
    if (!anchorEl || !panelEl) return
    if (anchorEl.contains(e.target as Node)) return
    if (panelEl.contains(e.target as Node)) return
    closePanel()
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('pointerdown', handlePointerDown, true)
  })

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('pointerdown', handlePointerDown, true)
    if (resizeObserver) resizeObserver.disconnect()
    if (rafId !== undefined) cancelAnimationFrame(rafId)
    closePanel()
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
    role="menu"
    aria-label="Scroll Animator"
  >
    <h2 class="sa-heading">Scroll Animator</h2>
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
