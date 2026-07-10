import type { PerspectiveCamera } from 'three'
import { Quaternion, Euler } from 'three'

/**
 * Configuration for free-navigation movement.
 */
export interface FreeNavConfig {
  /** Movement speed in world units per second */
  moveSpeed: number
  /** Mouse look sensitivity (radians per pixel) */
  mouseSensitivity: number
  /** Maximum pitch angle in radians (avoids camera flip) */
  maxPitch: number
  /** Minimum pitch angle in radians */
  minPitch: number
}

/**
 * Default free-navigation configuration.
 */
export const DEFAULT_FREE_NAV_CONFIG: FreeNavConfig = {
  moveSpeed: 8,
  mouseSensitivity: 0.002,
  maxPitch: Math.PI / 2 - 0.01,
  minPitch: -Math.PI / 2 + 0.01,
}

/**
 * Set of keys that are tracked for movement.
 */
export const NAV_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

/**
 * Check whether a key event should be handled by free navigation.
 * Ignores form inputs, textareas, and contenteditable elements.
 */
export function shouldHandleKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  // Allow window/document targets (e.g. when no element has focus)
  if (target === window || target === document) return true
  const tag = (target as HTMLElement).tagName
  if (!tag) return true // non-element nodes are safe
  const tagLower = tag.toLowerCase()
  if (tagLower === 'input' || tagLower === 'textarea') return false
  if ((target as HTMLElement).isContentEditable) return false
  return true
}

/**
 * Check whether a key is a navigation key.
 */
export function isNavKey(key: string): boolean {
  return NAV_KEYS.has(key.toLowerCase())
}

/**
 * Compute a movement direction vector from key state.
 * Returns a normalised direction in the XZ plane (forward/back)
 * and strafe (left/right).
 *
 * @param keys Set of currently pressed keys (lower-cased).
 * @returns Unit direction vector in local space (forward = -Z, right = +X).
 */
export function computeMoveDirection(keys: Set<string>): [number, number, number] {
  let forward = 0
  let right = 0

  if (keys.has('w') || keys.has('arrowup')) forward += 1
  if (keys.has('s') || keys.has('arrowdown')) forward -= 1
  if (keys.has('a') || keys.has('arrowleft')) right -= 1
  if (keys.has('d') || keys.has('arrowright')) right += 1

  if (forward === 0 && right === 0) return [0, 0, 0]

  const len = Math.sqrt(forward * forward + right * right)
  return [right / len, 0, -forward / len]
}

/**
 * Apply a movement delta to the camera position using its current yaw.
 *
 * @param camera The Three.js camera to move.
 * @param direction Local-space direction from {@link computeMoveDirection}.
 * @param yaw Current yaw angle in radians.
 * @param deltaSeconds Time delta for frame-rate independence.
 * @param speed Movement speed in world units per second.
 */
export function applyMovement(
  camera: PerspectiveCamera,
  direction: [number, number, number],
  yaw: number,
  deltaSeconds: number,
  speed: number,
): void {
  const [dx, , dz] = direction
  if (dx === 0 && dz === 0) return

  const dist = speed * deltaSeconds

  // Forward direction in world space (Y = up, Z = forward)
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)

  // Local forward = -Z, local right = +X
  // World forward = (-sinYaw, 0, -cosYaw)
  // World right = (cosYaw, 0, -sinYaw)
  const worldDx = cosYaw * dx - sinYaw * dz
  const worldDz = -sinYaw * dx - cosYaw * dz

  camera.position.x += worldDx * dist
  camera.position.z += worldDz * dist
}

/**
 * Apply yaw and pitch deltas to the camera orientation.
 * Uses a yaw-pitch convention: yaw rotates around world Y axis,
 * pitch rotates around the camera's local X axis.
 *
 * @param camera The Three.js camera.
 * @param deltaYaw Change in yaw in radians.
 * @param deltaPitch Change in pitch in radians.
 * @param currentPitch Current pitch angle (clamped internally).
 * @param maxPitch Maximum allowed pitch.
 * @param minPitch Minimum allowed pitch.
 * @returns Updated pitch angle after clamping.
 */
export function applyLookAt(
  camera: PerspectiveCamera,
  deltaYaw: number,
  deltaPitch: number,
  currentPitch: number,
  maxPitch: number,
  minPitch: number,
): number {
  let newPitch = currentPitch + deltaPitch
  newPitch = Math.max(minPitch, Math.min(maxPitch, newPitch))

  // Build orientation from yaw + pitch
  // We use the camera's current yaw by extracting it from the quaternion
  const euler = new Euler(0, 0, 0, 'YXZ')
  euler.y += deltaYaw
  euler.x = newPitch

  const quaternion = new Quaternion().setFromEuler(euler)
  camera.quaternion.copy(quaternion)

  return newPitch
}

/**
 * Initialise yaw and pitch from a camera's current orientation.
 * Extracts the yaw (rotation around Y) and pitch (rotation around local X)
 * from the camera's quaternion.
 *
 * @param camera The camera to read.
 * @returns [yaw, pitch] in radians.
 */
export function extractYawPitch(camera: PerspectiveCamera): [number, number] {
  const euler = new Euler(0, 0, 0, 'YXZ')
  euler.setFromQuaternion(camera.quaternion)
  return [euler.y, euler.x]
}
