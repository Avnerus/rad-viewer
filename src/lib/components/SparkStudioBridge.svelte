<script lang="ts">
  import { useThrelte } from '@threlte/core'
  import { onMount, onDestroy } from 'svelte'
  import { createSparkStudioRenderer } from '$lib/spark/createSparkStudioRenderer'
  import type { DeviceProfile } from '$lib/types'
  import type { SparkRendererOptions } from '@sparkjsdev/spark'

  let { profile }: { profile: DeviceProfile } = $props()

  const threlte = useThrelte()
  let handle = $state<{ dispose: () => void } | null>(null)

  onMount(() => {
    const { scene, renderer, invalidate } = threlte
    if (!scene || !renderer) return

    // Build SparkRenderer options from device profile
    const sparkOptions: SparkRendererOptions = {
      renderer,
      onDirty: invalidate,
      pagedExtSplats: true,
      lodSplatScale: profile.sparkRenderer.lodSplatScale as number,
      lodRenderScale: profile.sparkRenderer.lodRenderScale as number,
      maxStdDev: profile.sparkRenderer.maxStdDev as number,
      maxPagedSplats: profile.sparkRenderer.maxPagedSplats as number,
      coneFov0: profile.sparkRenderer.coneFov0 as number,
      coneFov: profile.sparkRenderer.coneFov as number,
      coneFoveate: profile.sparkRenderer.coneFoveate as number,
      behindFoveate: profile.sparkRenderer.behindFoveate as number,
    }

    const studioHandle = createSparkStudioRenderer(sparkOptions)
    studioHandle.attach(scene, renderer)
    handle = { dispose: studioHandle.dispose }
  })

  onDestroy(() => {
    handle?.dispose()
    handle = null
  })
</script>

<!-- No DOM output — this component manages Spark renderer lifecycle only -->
