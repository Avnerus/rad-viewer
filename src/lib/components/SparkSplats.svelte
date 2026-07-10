<script lang="ts">
  import { useThrelte } from '@threlte/core'
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

  let spark: SparkRenderer | null = null
  let mesh: SplatMesh | null = null

  onMount(() => {
    // Create SparkRenderer — added imperatively to the scene
    spark = new SparkRenderer(sparkOptions)
    scene.add(spark)

    // Create SplatMesh — added imperatively to the scene
    if (url) {
      mesh = new SplatMesh({
        url,
        paged: true,
        raycastable: false,
      })
      scene.add(mesh)
    }
  })

  onDestroy(() => {
    // Remove from scene and dispose
    mesh?.parent?.remove(mesh)
    mesh?.dispose()
    spark?.parent?.remove(spark)
    spark?.dispose()
  })
</script>

<!-- Both SparkRenderer and SplatMesh are added to the scene imperatively in onMount. -->
