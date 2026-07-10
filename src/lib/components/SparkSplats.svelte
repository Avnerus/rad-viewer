<script lang="ts">
  import { T, useThrelte } from '@threlte/core'
  import { onMount, onDestroy } from 'svelte'
  import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'
  import type { DeviceProfile } from '$lib/types'

  interface Props {
    url: string
    profile: DeviceProfile
  }

  let { url, profile }: Props = $props()

  const { renderer, scene } = useThrelte()

  // Build SparkRenderer options from profile
  const sparkOptions = {
    renderer,
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

  let spark: SparkRenderer | null = $state(null)
  let mesh: SplatMesh | null = $state(null)

  onMount(() => {
    // Create SparkRenderer
    spark = new SparkRenderer(sparkOptions)
    scene.add(spark!)

    // Create SplatMesh
    if (url) {
      mesh = new SplatMesh({
        url,
        paged: true,
        raycastable: false,
      })
      scene.add(mesh!)
    }
  })

  onDestroy(() => {
    mesh?.dispose()
    spark?.dispose()
  })
</script>

<!-- SparkRenderer is added to scene imperatively; T is for SplatMesh -->
{#if mesh}
  <T is={mesh} />
{/if}
