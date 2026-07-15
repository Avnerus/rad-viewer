/**
 * Future-facing bridge for tuning Studio editor CameraControls parameters.
 *
 * Studio's `CameraControls.svelte` constructs its own `camera-controls`
 * instance internally and does not expose it through any supported public API.
 * This module defines the desired tuning surface and a narrow assignment
 * helper so that, when an upstream public hook or an owned editor-camera
 * extension becomes available, the connection can be made in one place.
 *
 * Current state: **unattached by default**. No production integration in this
 * app currently attaches an instance, so `getCurrentControls()` returns `null`
 * until a future supported owner calls `attachControls()`.
 *
 * To connect in the future:
 * 1. Find or create a supported public path to the CameraControls instance
 *    (e.g. an upstream hook in `@threlte/studio` or a replacement
 *    editor-camera extension).
 * 2. Call `attachControls(controls)` with the real instance.
 * 3. Call `applyCurrentTuning()` or `applyEditorCameraControlsTuning()` to
 *    push the desired defaults.
 */

/* ------------------------------------------------------------------ */
/* Structural interface (avoids importing Studio internals)            */
/* ------------------------------------------------------------------ */

/**
 * Narrow structural type for the CameraControls instance.
 * Matches the public API of `camera-controls` (the `CC` import).
 */
export interface EditorCameraControlsLike {
  smoothTime: number
  draggingSmoothTime: number
  dollyToCursor: boolean
}

/* ------------------------------------------------------------------ */
/* Tuning configuration                                               */
/* ------------------------------------------------------------------ */

/**
 * Desired tuning values for the Studio editor CameraControls.
 * Matches the current Studio defaults as of the last verification.
 */
export interface EditorCameraControlsTuning {
  /**
   * Smooth time for orbiting / dolly / tracking (seconds).
   * Lower = snappier, higher = smoother.
   */
  smoothTime: number

  /**
   * Smooth time while actively dragging (seconds).
   * Typically lower than `smoothTime` for more responsive drag.
   */
  draggingSmoothTime: number

  /**
   * When true, dolly zoom targets the cursor position instead of the
   * look-at target. Useful for precise framing.
   */
  dollyToCursor: boolean
}

/**
 * Default tuning values. Match the installed Studio defaults
 * (`@threlte/studio/dist/extensions/editor-camera/CameraControls.svelte`):
 * `smoothTime = 0.05`, `draggingSmoothTime = 0.05`, `dollyToCursor = true`.
 */
export const DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING: EditorCameraControlsTuning = {
  smoothTime: 0.05,
  draggingSmoothTime: 0.05,
  dollyToCursor: true,
}

/* ------------------------------------------------------------------ */
/* Apply helper                                                        */
/* ------------------------------------------------------------------ */

/**
 * Apply tuning values to a CameraControls instance.
 * Narrow assignment — only writes the three known properties.
 *
 * @param controls - A live CameraControls instance (structural type).
 * @param tuning - The desired tuning values.
 */
export function applyEditorCameraControlsTuning(
  controls: EditorCameraControlsLike,
  tuning: EditorCameraControlsTuning,
): void {
  controls.smoothTime = tuning.smoothTime
  controls.draggingSmoothTime = tuning.draggingSmoothTime
  controls.dollyToCursor = tuning.dollyToCursor
}

/* ------------------------------------------------------------------ */
/* Bridge state (currently unattached)                                 */
/* ------------------------------------------------------------------ */

let currentControls: EditorCameraControlsLike | null = null
let currentTuning: EditorCameraControlsTuning = { ...DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING }

/**
 * Attach a CameraControls instance to the bridge.
 * After attaching, call `applyCurrentTuning()` to push defaults.
 *
 * @param controls - The live CameraControls instance from Studio's editor camera.
 */
export function attachControls(controls: EditorCameraControlsLike): void {
  currentControls = controls
}

/**
 * Detach the current CameraControls instance.
 */
export function detachControls(): void {
  currentControls = null
}

/**
 * Get the currently attached CameraControls instance, or `null` if none.
 * Returns `null` by default (no production integration attaches one).
 * Returns the attached object after an explicit `attachControls()` call.
 */
export function getCurrentControls(): EditorCameraControlsLike | null {
  return currentControls
}

/**
 * Update the desired tuning values.
 * If a controls instance is attached, the new values are applied immediately.
 *
 * @param tuning - The new tuning values.
 */
export function updateTuning(tuning: EditorCameraControlsTuning): void {
  currentTuning = { ...tuning }
  if (currentControls) {
    applyEditorCameraControlsTuning(currentControls, currentTuning)
  }
}

/**
 * Apply the current tuning to the attached controls (if any).
 * No-op when no controls are attached.
 */
export function applyCurrentTuning(): void {
  if (currentControls) {
    applyEditorCameraControlsTuning(currentControls, currentTuning)
  }
}

/**
 * Get the current tuning values (read-only copy).
 */
export function getCurrentTuning(): EditorCameraControlsTuning {
  return { ...currentTuning }
}
