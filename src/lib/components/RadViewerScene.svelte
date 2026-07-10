<script lang="ts">
  import { useThrelte, useCamera } from '@threlte/core'
  import { onMount, onDestroy } from 'svelte'
  import { PerspectiveCamera } from 'three'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import { gsap } from 'gsap'
  import { getCameraPose, applyCameraPose, defaultPerspectivePose, defaultTopDownPose } from '$lib/spark/cameraTween'
  import type { DeviceProfile } from '$lib/types'
  import SparkSplats from './SparkSplats.svelte'

  interface Props {
    url: string
    profile: DeviceProfile
    onReady?: () => void
  }

  let { url, profile, onReady }: Props = $props()
  let scrollTrackRef = $state<HTMLElement | null>(null)
  let scrollTrigger: { kill(): void } | null = null
  let loaded = $state(false)

  const threlte = useThrelte()
  const cameraContext = useCamera()

  // Create the camera
  const camera = new PerspectiveCamera(60, 1, 0.1, 10_000)
  camera.position.set(
    defaultPerspectivePose.position[0],
    defaultPerspectivePose.position[1],
    defaultPerspectivePose.position[2],
  )
  camera.lookAt(
    defaultPerspectivePose.target[0],
    defaultPerspectivePose.target[1],
    defaultPerspectivePose.target[2],
  )

  onMount(() => {
    if (typeof window === 'undefined') return

    // Register camera with Threlte context
    threlte.camera.set(camera)
    cameraContext.makeDefaultCameras.add(camera)

    // Register GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger)

    if (!scrollTrackRef) return

    // Create the ScrollTrigger
    scrollTrigger = ScrollTrigger.create({
      trigger: scrollTrackRef,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        const pose = getCameraPose(self.progress, defaultPerspectivePose, defaultTopDownPose)
        applyCameraPose(camera, pose)
      },
    })

    // Mark as loaded once the scene is mounted
    loaded = true
    onReady?.()
  })

  onDestroy(() => {
    if (scrollTrigger) {
      scrollTrigger.kill()
      scrollTrigger = null
    }
  })
</script>

<div class="scroll-track" bind:this={scrollTrackRef}></div>

<SparkSplats {url} {profile} />

{#if !loaded}
  <div class="scroll-hint">Scroll to change view</div>
{/if}
