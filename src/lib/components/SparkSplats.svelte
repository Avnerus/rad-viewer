<script lang="ts">
  import { T, useThrelte } from '@threlte/core'
  import { onMount, onDestroy } from 'svelte'
  import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'

  let {
    url,
    profile,
    position = [0, 0, 0] as [number, number, number],
    rotation = [0, 0, 0] as [number, number, number],
    scale = 1 as number | [number, number, number],
  } = $props()

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
  let mesh: SplatMesh | null = $state(null)

  onMount(() => {
    // Create SparkRenderer — added imperatively to the scene (renderer infrastructure)
    spark = new SparkRenderer(sparkOptions)
    scene.add(spark)

    // Create SplatMesh — owned by Threlte <T> below for declarative transforms
    if (url) {
      mesh = new SplatMesh({
        url,
        paged: true,
        raycastable: false,
      })
    }
  })

  onDestroy(() => {
    mesh?.dispose()
    spark?.parent?.remove(spark)
    spark?.dispose()
  })
</script>

<!-- SparkRenderer is added imperatively above. SplatMesh is owned by Threlte <T> for declarative transforms. -->
{#if mesh}
  <T is={mesh} {position} {rotation} {scale} />
{/if}
