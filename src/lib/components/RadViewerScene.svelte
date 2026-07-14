<script lang="ts">
  import { T, useThrelte, useCamera } from '@threlte/core'
  import { onMount, onDestroy } from 'svelte'
  import { PerspectiveCamera, Object3D, Vector3 } from 'three'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import { gsap } from 'gsap'
  import { ScrollAnimator } from '$lib/spark/ScrollAnimator'
  import type { ScrollKeyframe } from '$lib/spark/scrollAnimation'
  import type { DeviceProfile } from '$lib/types'
  import SparkSplats from './SparkSplats.svelte'
  import SparkStudioBridge from './SparkStudioBridge.svelte'

  interface Props {
    url: string
    profile: DeviceProfile
    onReady?: () => void
  }

  let { url, profile, onReady }: Props = $props()

  // Camera debug state for e2e tests (world-space)
  let cameraProgress = $state(0)
  let cameraWorldX = $state(0)
  let cameraWorldY = $state(0)
  let cameraWorldZ = $state(0)
  let targetWorldX = $state(0)
  let targetWorldY = $state(0)
  let targetWorldZ = $state(0)

  let loaded = $state(false)
  let scrollTrigger: ReturnType<typeof ScrollTrigger.create> | null = null

  const threlte = useThrelte()
  const cameraContext = useCamera()

  // Real camera
  const camera = new PerspectiveCamera(60, 1, 0.1, 10_000)

  // CameraTarget — an Object3D that the camera always looks at (world position)
  const cameraTarget = new Object3D()
  cameraTarget.name = 'CameraTarget'

  // ScrollAnimators
  const cameraAnimator = new ScrollAnimator()
  cameraAnimator.name = 'Camera ScrollAnimator'
  cameraAnimator.keyframes = [
    { scroll: 0, position: [0, 0, -1], rotation: [0, 0, 0] },
    { scroll: 100, position: [0, 30, -1], rotation: [0, 0, 0] },
  ] as ScrollKeyframe[]

  const targetAnimator = new ScrollAnimator()
  targetAnimator.name = 'Camera Target ScrollAnimator'
  targetAnimator.keyframes = [
    { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
  ] as ScrollKeyframe[]

  // Apply initial poses
  cameraAnimator.applyScrollPercentage(0)
  targetAnimator.applyScrollPercentage(0)

  // ScrollTrigger update handler
  function applyScrollAnimators(percent: number): void {
    cameraAnimator.applyScrollPercentage(percent)
    targetAnimator.applyScrollPercentage(percent)
    cameraProgress = percent
    updateDebugState()
  }

  // Update camera look-at target and debug state
  function updateCameraLookAt(): void {
    const targetWorld = new Vector3()
    cameraTarget.getWorldPosition(targetWorld)
    camera.lookAt(targetWorld)
  }

  function updateDebugState(): void {
    const camWorld = new Vector3()
    camera.getWorldPosition(camWorld)
    cameraWorldX = camWorld.x
    cameraWorldY = camWorld.y
    cameraWorldZ = camWorld.z

    const targetWorld = new Vector3()
    cameraTarget.getWorldPosition(targetWorld)
    targetWorldX = targetWorld.x
    targetWorldY = targetWorld.y
    targetWorldZ = targetWorld.z
  }

  onMount(() => {
    if (typeof window === 'undefined') return

    // Register camera with Threlte context
    threlte.camera.set(camera)
    cameraContext.makeDefaultCameras.add(camera)

    // Register GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger)

    // Use the .scroll-spacer element as the trigger
    const spacer = document.querySelector<HTMLElement>('.scroll-spacer')
    if (!spacer) return

    scrollTrigger = ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        const percent = self.progress * 100
        applyScrollAnimators(percent)
      },
    })

    // Apply initial pose from the current ScrollTrigger progress
    if (scrollTrigger) {
      applyScrollAnimators(scrollTrigger.progress * 100)
    }

    // Render task: update camera look-at target every frame
    // We wrap the WebGLRenderer.render to inject look-at before each frame
    const { renderer } = threlte
    if (renderer) {
      const originalRender = renderer.render.bind(renderer)
      renderer.render = function (scene: Parameters<typeof originalRender>[0], cam: Parameters<typeof originalRender>[1]) {
        updateCameraLookAt()
        return originalRender(scene, cam)
      }
    }

    // Mark as loaded
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

<!-- Camera ScrollAnimator with real camera as child -->
<T
  is={cameraAnimator}
  name="Camera ScrollAnimator"
  keyframes={[
    { scroll: 0, position: [0, 0, -1], rotation: [0, 0, 0] },
    { scroll: 100, position: [0, 30, -1], rotation: [0, 0, 0] },
  ]}
>
  <T is={camera} name="PerspectiveCamera" />
</T>

<!-- Camera Target ScrollAnimator with CameraTarget as child -->
<T
  is={targetAnimator}
  name="Camera Target ScrollAnimator"
  keyframes={[
    { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
  ]}
>
  <T is={cameraTarget} name="CameraTarget" />
</T>

<SparkStudioBridge {profile} />

<SparkSplats
  {url}
  position={[5,-6,-5]}
/>

<!-- Visually hidden debug element for e2e tests -->
<div
  class="camera-debug"
  data-testid="camera-state"
  data-progress={cameraProgress.toFixed(3)}
  data-x={cameraWorldX.toFixed(3)}
  data-y={cameraWorldY.toFixed(3)}
  data-z={cameraWorldZ.toFixed(3)}
  data-target-x={targetWorldX.toFixed(3)}
  data-target-y={targetWorldY.toFixed(3)}
  data-target-z={targetWorldZ.toFixed(3)}
  aria-hidden="true"
></div>

{#if !loaded}
  <div class="scroll-hint">Scroll to change view</div>
{/if}
