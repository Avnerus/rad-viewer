import * as THREE from 'three'
import { SparkRenderer } from '@sparkjsdev/spark'
import type { SparkRendererOptions } from '@sparkjsdev/spark'

/**
 * Manages the dual-SparkRenderer architecture required for Threlte Studio
 * editor-camera safety.
 *
 * - **Editor renderer**: `enableLod: true`, `enableDriveLod: false`. Added to
 *   the Three scene so it receives `onBeforeRender` calls for every render pass.
 *   It sorts splats for the editor camera's view but never drives LOD fetching
 *   or pager updates.
 *
 * - **Real-camera renderer**: `enableLod: true`, `enableDriveLod: true`. Never
 *   added to the scene. Drives LOD selection from the application's real camera.
 *   Its `lodInstances` map is shared with the editor renderer before each
 *   editor render.
 *
 * The custom Three `render` function routes by `camera.userData.editorCamera`:
 *   - Editor camera → copy real renderer's lodInstances → sparkOverride = editorRenderer → render
 *   - Real/default camera → sparkOverride = realRenderer → render → share lodInstances for next editor frame
 */
export interface SparkStudioRendererHandle {
  /**
   * Attach this handle to a scene/renderer pair.
   * Safe to call multiple times (idempotent — no-op if already attached).
   */
  attach(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void

  /**
   * Dispose both Spark renderers and clean up. Safe to call multiple times.
   * After disposal all exposed references are nulled.
   */
  dispose(): void

  /** The editor (non-driving) SparkRenderer — added to scene. */
  editorRenderer: SparkRenderer | null

  /** The real-camera (driving) SparkRenderer — not added to scene. */
  realRenderer: SparkRenderer | null
}

/**
 * Factory to create a dual-SparkRenderer setup for Studio-safe LOD rendering.
 *
 * @param sparkOptions - Base Spark options derived from the device profile.
 *                       Must include `renderer` (supplied by Threlte Canvas).
 * @returns A handle controlling attach / dispose lifecycle.
 */
export function createSparkStudioRenderer(
  sparkOptions: SparkRendererOptions,
): SparkStudioRendererHandle {
  let editorRenderer: SparkRenderer | null = null
  let realRenderer: SparkRenderer | null = null
  let attachedScene: THREE.Scene | null = null
  let attachedRenderer: THREE.WebGLRenderer | null = null
  let originalRender: ((scene: THREE.Scene, camera: THREE.Camera) => void) | null = null
  let disposed = false

  function createRenderers(): void {
    if (disposed) return
    if (editorRenderer || realRenderer) return // idempotent

    const baseOptions = { ...sparkOptions }

    // Editor renderer: LOD enabled but not driving
    const editorOptions: SparkRendererOptions = {
      ...baseOptions,
      enableLod: true,
      enableDriveLod: false,
    }
    editorRenderer = new SparkRenderer(editorOptions)

    // Real-camera renderer: full LOD driving
    const realOptions: SparkRendererOptions = {
      ...baseOptions,
      enableLod: true,
      enableDriveLod: true,
    }
    realRenderer = new SparkRenderer(realOptions)
  }

  function shareLodInstances(): void {
    if (!realRenderer || !editorRenderer) return
    editorRenderer.lodInstances.clear()
    for (const [mesh, data] of realRenderer.lodInstances) {
      editorRenderer.lodInstances.set(mesh, data)
    }
  }

  function renderWithOverride(
    override: SparkRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    rawRender: (scene: THREE.Scene, camera: THREE.Camera) => void,
  ): void {
    const previous = SparkRenderer.sparkOverride
    try {
      SparkRenderer.sparkOverride = override
      rawRender(scene, camera)
    } finally {
      SparkRenderer.sparkOverride = previous
    }
  }

  function buildCustomRender(): void {
    if (!attachedRenderer || !realRenderer || !editorRenderer) return

    // Capture the original render method reference to avoid recursion through the overridden method
    originalRender = attachedRenderer.render as (scene: THREE.Scene, camera: THREE.Camera) => void

    attachedRenderer.render = (scene: THREE.Scene, camera: THREE.Camera): void => {
      if (camera.userData.editorCamera === true) {
        // Editor camera: share LOD from real renderer, render through editorRenderer (no LOD driving)
        shareLodInstances()
        renderWithOverride(editorRenderer!, scene, camera, originalRender!)
      } else {
        // Real/default camera: render through realRenderer (drives LOD), then share for next editor frame
        renderWithOverride(realRenderer!, scene, camera, originalRender!)
        shareLodInstances()
      }
    }
  }

  function restoreOriginalRender(): void {
    if (attachedRenderer && originalRender) {
      attachedRenderer.render = originalRender
      originalRender = null
    }
  }

  function attach(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
    if (disposed) return
    if (attachedScene === scene && attachedRenderer === renderer) return // idempotent

    createRenderers()
    if (!editorRenderer || !realRenderer) return

    attachedScene = scene
    attachedRenderer = renderer

    // Add only the editor renderer to the scene
    scene.add(editorRenderer)

    buildCustomRender()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true

    restoreOriginalRender()

    // Remove only the scene-owned editor renderer
    if (editorRenderer && attachedScene) {
      attachedScene.remove(editorRenderer)
    }

    // Dispose both Spark renderers
    editorRenderer?.dispose()
    realRenderer?.dispose()

    // Clear references
    editorRenderer = null
    realRenderer = null
    attachedScene = null
    attachedRenderer = null
  }

  return {
    attach,
    dispose,
    get editorRenderer() {
      return editorRenderer
    },
    get realRenderer() {
      return realRenderer
    },
  }
}
