<script lang="ts">
  import { Canvas } from '@threlte/core'
  import { Studio } from '@threlte/studio'
  import { onMount } from 'svelte'
  import { WebGLRenderer } from 'three'
  import { validateRadUrl } from '$lib/spark/radUrl'
  import { getDeviceProfile } from '$lib/spark/deviceProfile'
  import RadViewerScene from '$lib/components/RadViewerScene.svelte'
  import type { DeviceProfile } from '$lib/types'

  const SAMPLE_URL = 'https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad'

  let appState: 'landing' | 'viewer' = $state('landing')
  let urlInput = $state(SAMPLE_URL)
  let activeUrl = $state('')
  let errorMsg = $state('')
  let loading = $state(false)
  let freeNavEnabled = $state(false)
  let profile: DeviceProfile = getDeviceProfile()

  // Check for URL in query string on mount
  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const urlParam = params.get('url')
    if (urlParam) {
      const result = validateRadUrl(urlParam)
      if (result.ok) {
        urlInput = result.url
      }
    }
  })

  function handleSubmit(e: Event) {
    e.preventDefault()
    handleStart()
  }

  function handleStart() {
    const result = validateRadUrl(urlInput)
    if (!result.ok) {
      errorMsg = result.error
      return
    }

    errorMsg = ''
    activeUrl = result.url
    loading = true
    appState = 'viewer'

    // Update URL in address bar for reloadability
    const url = new URL(window.location.href)
    url.searchParams.set('url', activeUrl)
    window.history.replaceState({}, '', url.toString())
  }

  function handleBack() {
    appState = 'landing'
    loading = false
    activeUrl = ''
    freeNavEnabled = false
  }

  function handleReady() {
    loading = false
  }

  function handleFreeNavToggle(e: Event) {
    freeNavEnabled = (e.target as HTMLInputElement).checked
  }
</script>

{#if appState === 'landing'}
  <div class="landing">
    <h1>RAD Viewer</h1>
    <p>
      View Spark 2.x streaming LOD Gaussian splats from a RAD file URL.
      Paste a <code>.rad</code> URL below and click Start.
    </p>

    <form class="url-form" onsubmit={handleSubmit}>
      <input
        type="text"
        class="url-input"
        placeholder="https://example.com/model-lod.rad"
        bind:value={urlInput}
        aria-label="RAD file URL"
      />
      <button type="submit" class="start-btn">Start</button>
      {#if errorMsg}
        <span class="error-msg" role="alert">{errorMsg}</span>
      {/if}
    </form>
  </div>
{:else}
  <!-- Fixed UI overlay -->
  <div class="viewer-header">
    <button class="back-btn" onclick={handleBack} aria-label="Go back">← Back</button>
    <span class="url-label" title={activeUrl}>{activeUrl}</span>
  </div>

  <!-- Fixed canvas stage -->
  <div class="viewer-stage">
    <Canvas
      renderMode="always"
      dpr={profile.dpr}
      createRenderer={(canvas) =>
        new WebGLRenderer({
          canvas,
          antialias: false,
          alpha: false,
          powerPreference: 'default',
        })
      }
    >

      <!--Studio-->
        <RadViewerScene
          url={activeUrl}
          {profile}
          {freeNavEnabled}
          onReady={handleReady}
        />
      <!--/Studio-->
    </Canvas>

    {#if loading}
      <div class="loading-overlay">
        <div class="spinner"></div>
        <span>Loading splats…</span>
      </div>
    {/if}
  </div>

  <!-- Free navigation toggle — outside Canvas so it renders as normal HTML -->
  <div class="free-nav-toggle">
    <label class="free-nav-label">
      <input
        type="checkbox"
        class="free-nav-checkbox"
        checked={freeNavEnabled}
        tabindex={-1}
        onchange={handleFreeNavToggle}
        onblur={() => document.body.focus()}
        aria-label="Free navigation"
      />
      Free navigation
    </label>
    {#if freeNavEnabled}
      <span class="free-nav-hint">WASD / Arrows to move · Mouse to look · Scroll to zoom</span>
    {/if}
  </div>

  <!-- Scroll spacer — in document flow, provides scroll height -->
  <div class="scroll-spacer"></div>
{/if}
