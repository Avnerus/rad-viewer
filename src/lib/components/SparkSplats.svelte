<script lang="ts">
  import { T } from '@threlte/core'
  import { onMount, onDestroy } from 'svelte'
  import { SplatMesh } from '@sparkjsdev/spark'

  let {
    url,
  } = $props()

  let mesh: SplatMesh | null = $state(null)

  onMount(() => {
    // Create SplatMesh — owned by Threlte <T> below for declarative transforms.
    // SparkRenderer lifecycle is managed by SparkStudioBridge.
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
  })
</script>

<!-- SplatMesh is owned by Threlte <T> for declarative transforms. SparkRenderer is managed by SparkStudioBridge. -->
{#if mesh}
  <T is={mesh} />
{/if}
