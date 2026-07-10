import type { CameraPose } from '$lib/types'
import type { PerspectiveCamera } from 'three'

/**
 * Interpolate between two camera poses by progress (0..1).
 */
export function getCameraPose(
  progress: number,
  start: CameraPose,
  end: CameraPose,
): CameraPose {
  const clamped = Math.max(0, Math.min(1, progress))

  const position: [number, number, number] = [
    lerp(start.position[0], end.position[0], clamped),
    lerp(start.position[1], end.position[1], clamped),
    lerp(start.position[2], end.position[2], clamped),
  ]

  const target: [number, number, number] = [
    lerp(start.target[0], end.target[0], clamped),
    lerp(start.target[1], end.target[1], clamped),
    lerp(start.target[2], end.target[2], clamped),
  ]

  return { position, target }
}

/**
 * Apply a camera pose to a Three.js PerspectiveCamera.
 * Always calls `camera.lookAt(target)` to keep the look target fixed.
 */
export function applyCameraPose(
  camera: PerspectiveCamera,
  pose: CameraPose,
): void {
  camera.position.set(pose.position[0], pose.position[1], pose.position[2])
  camera.lookAt(pose.target[0], pose.target[1], pose.target[2])
}

/**
 * Default perspective pose (angled view of the scene).
 */
export const defaultPerspectivePose: CameraPose = {
  position: [11, 8, 11],
  target: [0, 0, 0],
}

/**
 * Default top-down pose (looking straight down at the scene center).
 */
export const defaultTopDownPose: CameraPose = {
  position: [0, 30, 0],
  target: [0, 0, 0],
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                     */
/* ------------------------------------------------------------------ */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
