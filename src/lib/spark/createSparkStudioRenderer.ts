import * as THREE from 'three'
import { SparkRenderer } from '@sparkjsdev/spark'
import type { SparkRendererOptions } from '@sparkjsdev/spark'

/**
 * Manages the dual-SparkRenderer architecture required for Threlte Studio
 * editor-camera safety.
 *
 * - **Editor renderer**: `enableLod: true`, `enableDriveLod: false`. Added to
 *   the Three scene so it receives `onBeforeRender` calls for every render pass.
 *   It sorts splats for the current camera's view but never drives LOD fetching
 *   or pager updates.
 *
 * - **Real-camera renderer**: `enableLod: true`, `enableDriveLod: true`. Never
 *   added to the scene. Drives LOD selection from the application's real camera.
 *   Its `lodInstances` map is shared with the editor renderer so that editor
 *   renders display the same LOD selection.
 *
 * The editor renderer's `onBeforeRender` is wrapped to detect editor cameras
 * (`camera.userData.editorCamera === true`). Both branches pin their intended
 * Spark override for the duration of the original `onBeforeRender` callback
 * and restore the prior override in `try/finally`:
 *   - Editor camera → share LOD → sparkOverride = editorRenderer → call → restore
 *   - Real/default camera → sparkOverride = realRenderer → call → restore → share LOD
 */
export interface SparkStudioRendererHandle {
  /**
   * Attach this handle to a scene/renderer pair.
   * Safe to call multiple times (idempotent — no-op if already attached).
   */
  attach(scene: THREE.Scene): void

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

  function wrapOnBeforeRender(): void {
    if (!editorRenderer || !realRenderer) return

    const originalOnBeforeRender = editorRenderer.onBeforeRender.bind(editorRenderer)

    editorRenderer.onBeforeRender = (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera,
    ): void => {
      const callWithOverride = (spark: SparkRenderer): void => {
        const previous = SparkRenderer.sparkOverride
        try {
          SparkRenderer.sparkOverride = spark
          originalOnBeforeRender(renderer, scene, camera)
        } finally {
          SparkRenderer.sparkOverride = previous
        }
      }

      if (camera.userData.editorCamera === true) {
        // Editor camera: share LOD from real renderer, pin override to editorRenderer
        shareLodInstances()
        callWithOverride(editorRenderer!)
      } else {
        // Real/default camera: pin override to realRenderer (drives LOD), then share
        callWithOverride(realRenderer!)
        shareLodInstances()
      }
    }
  }

  function attach(scene: THREE.Scene): void {
    if (disposed) return
    if (attachedScene === scene) return // idempotent

    createRenderers()
    if (!editorRenderer || !realRenderer) return

    attachedScene = scene

    // Add only the editor renderer to the scene
    scene.add(editorRenderer)

    // Wrap onBeforeRender to route LOD driving by camera type
    wrapOnBeforeRender()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true

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
