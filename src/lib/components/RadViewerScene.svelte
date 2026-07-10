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
  let scrollTrigger: { kill(): void } | null = null
  let loaded = $state(false)

  // Camera debug state for e2e tests
  let cameraProgress = $state(0)
  let cameraPosition = $state<[number, number, number]>([...defaultPerspectivePose.position])
  const fixedTarget: [number, number, number] = [...defaultPerspectivePose.target]

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

    // Use the .scroll-spacer element (in document flow) as the trigger.
    // It provides the scroll height (400vh) while the canvas stays fixed.
    const spacer = document.querySelector<HTMLElement>('.scroll-spacer')
    if (!spacer) return

    scrollTrigger = ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        cameraProgress = self.progress
        const pose = getCameraPose(self.progress, defaultPerspectivePose, defaultTopDownPose)
        cameraPosition = [...pose.position]
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

<SparkSplats
  {url} 
  {profile} 
/>

<!-- Visually hidden debug element for e2e tests -->
<div
  class="camera-debug"
  data-testid="camera-state"
  data-progress={cameraProgress.toFixed(3)}
  data-x={cameraPosition[0].toFixed(3)}
  data-y={cameraPosition[1].toFixed(3)}
  data-z={cameraPosition[2].toFixed(3)}
  data-target={fixedTarget.join(',')}
  aria-hidden="true"
></div>

{#if !loaded}
  <div class="scroll-hint">Scroll to change view</div>
{/if}
