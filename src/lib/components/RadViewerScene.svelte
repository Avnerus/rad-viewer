<script lang="ts">
  import { useThrelte, useCamera } from '@threlte/core'
  import { onMount, onDestroy } from 'svelte'
  import { PerspectiveCamera } from 'three'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import { gsap } from 'gsap'
  import { getCameraPose, applyCameraPose, defaultPerspectivePose, defaultTopDownPose } from '$lib/spark/cameraTween'
  import {
    applyMovement,
    applyLook,
    updateLookAngles,
    applyZoom,
    extractYawPitch,
    computeMoveDirection,
    shouldHandleKeyEvent,
    isNavKey,
    DEFAULT_FREE_NAV_CONFIG,
  } from '$lib/spark/freeNavigation'
  import type { DeviceProfile } from '$lib/types'
  import SparkSplats from './SparkSplats.svelte'

  interface Props {
    url: string
    profile: DeviceProfile
    freeNavEnabled: boolean
    onReady?: () => void
  }

  let { url, profile, freeNavEnabled: initialFreeNav, onReady }: Props = $props()
  let scrollTrigger: { kill(): void } | null = null
  let loaded = $state(false)

  // Camera debug state for e2e tests
  let cameraProgress = $state(0)
  let cameraPosition = $state<[number, number, number]>([...defaultPerspectivePose.position])
  let cameraYaw = $state(0)
  let cameraPitch = $state(0)
  let cameraZoom = $state(60) // default FOV
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

  // Free navigation state
  let navYaw = $state(0)
  let navPitch = $state(0)
  let pressedKeys = new Set<string>()
  let lastMouseX = $state(0)
  let lastMouseY = $state(0)
  let lastTime = $state(0)
  let rafId: number | null = null

  // Track whether we are actively in free nav mode internally
  let freeNavActive = $state(false)

  // Store the last scroll-driven pose so we can restore it when exiting free nav
  let lastScrollPose: { position: [number, number, number]; target: [number, number, number] } | null = null

  $effect(() => {
    // React to external freeNavEnabled changes
    if (initialFreeNav && !freeNavActive) {
      // Entering free nav
      freeNavActive = true
      ;[navYaw, navPitch] = extractYawPitch(camera)
      cameraYaw = navYaw
      cameraPitch = navPitch
      cameraZoom = camera.fov
      if (scrollTrigger) {
        scrollTrigger.kill()
        scrollTrigger = null
      }
    } else if (!initialFreeNav && freeNavActive) {
      // Exiting free nav
      freeNavActive = false
      restoreScrollPose()
      recreateScrollTrigger()
    }
  })

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

    scrollTrigger = createScrollTrigger()

    // Keyboard event listeners
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Mouse move listener on the document (works when canvas is focused)
    document.addEventListener('mousemove', handleMouseMove)

    // Mouse wheel listener for zoom in free nav mode
    document.addEventListener('wheel', handleWheel, { passive: false })

    // Start the free-navigation render loop
    lastTime = performance.now()
    rafId = requestAnimationFrame(freeNavLoop)

    // Mark as loaded once the scene is mounted
    loaded = true
    onReady?.()
  })

  onDestroy(() => {
    if (scrollTrigger) {
      scrollTrigger.kill()
      scrollTrigger = null
    }
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('wheel', handleWheel)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  })

  function createScrollTrigger() {
    const spacer = document.querySelector<HTMLElement>('.scroll-spacer')
    if (!spacer) return null

    return ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        cameraProgress = self.progress
        const pose = getCameraPose(self.progress, defaultPerspectivePose, defaultTopDownPose)
        cameraPosition = [...pose.position]
        lastScrollPose = { position: [...pose.position], target: [...pose.target] }

        if (!freeNavActive) {
          applyCameraPose(camera, pose)
        }
      },
    })
  }

  function restoreScrollPose() {
    if (lastScrollPose) {
      applyCameraPose(camera, lastScrollPose)
    } else {
      applyCameraPose(camera, defaultPerspectivePose)
    }
    // Reset FOV to default on exit
    camera.fov = 60
    camera.updateProjectionMatrix()
  }

  function recreateScrollTrigger() {
    if (typeof window === 'undefined') return
    scrollTrigger = createScrollTrigger()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!freeNavActive || !shouldHandleKeyEvent(e) || !isNavKey(e.key)) return
    e.preventDefault()
    pressedKeys.add(e.key.toLowerCase())
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!isNavKey(e.key)) return
    pressedKeys.delete(e.key.toLowerCase())
  }

  function handleMouseMove(e: MouseEvent) {
    if (!freeNavActive) return

    const dx = e.clientX - lastMouseX
    const dy = e.clientY - lastMouseY
    lastMouseX = e.clientX
    lastMouseY = e.clientY

    if (dx === 0 && dy === 0) return

    const deltaYaw = -dx * DEFAULT_FREE_NAV_CONFIG.mouseSensitivity
    const deltaPitch = -dy * DEFAULT_FREE_NAV_CONFIG.mouseSensitivity

    // Update cumulative yaw and pitch using the new pure-math helper
    ;[navYaw, navPitch] = updateLookAngles(
      navYaw,
      navPitch,
      deltaYaw,
      deltaPitch,
      DEFAULT_FREE_NAV_CONFIG.minPitch,
      DEFAULT_FREE_NAV_CONFIG.maxPitch,
    )

    // Apply absolute yaw/pitch to the camera
    applyLook(camera, navYaw, navPitch)

    // Update debug state
    cameraYaw = navYaw
    cameraPitch = navPitch
  }

  function handleWheel(e: WheelEvent) {
    if (!freeNavActive) return
    e.preventDefault()

    const newFov = applyZoom(
      camera,
      e.deltaY,
      DEFAULT_FREE_NAV_CONFIG.zoomSensitivity,
      DEFAULT_FREE_NAV_CONFIG.minFov,
      DEFAULT_FREE_NAV_CONFIG.maxFov,
    )
    cameraZoom = newFov
  }

  function freeNavLoop(time: number) {
    rafId = requestAnimationFrame(freeNavLoop)

    if (!freeNavActive) return

    const delta = (time - lastTime) / 1000
    lastTime = time

    if (delta <= 0 || delta > 0.5) return // skip huge gaps

    const direction = computeMoveDirection(pressedKeys)
    if (direction[0] !== 0 || direction[2] !== 0) {
      applyMovement(
        camera,
        direction,
        navYaw,
        delta,
        DEFAULT_FREE_NAV_CONFIG.moveSpeed,
      )
    }

    // Update debug state
    cameraPosition = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ]
  }
</script>

<SparkSplats
  {url}
  {profile}
  position={[12, 1, 17]}
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
  data-freenav={freeNavActive ? 'true' : 'false'}
  data-yaw={cameraYaw.toFixed(4)}
  data-pitch={cameraPitch.toFixed(4)}
  data-zoom={cameraZoom.toFixed(2)}
  aria-hidden="true"
></div>

{#if !loaded}
  <div class="scroll-hint">Scroll to change view</div>
{/if}
