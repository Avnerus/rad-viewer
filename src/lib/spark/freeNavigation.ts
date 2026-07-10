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
  /** Scroll zoom sensitivity (FOV change per scroll tick) */
  zoomSensitivity: number
  /** Minimum camera FOV (zoomed in) */
  minFov: number
  /** Maximum camera FOV (zoomed out) */
  maxFov: number
}

/**
 * Default free-navigation configuration.
 */
export const DEFAULT_FREE_NAV_CONFIG: FreeNavConfig = {
  moveSpeed: 8,
  mouseSensitivity: 0.002,
  maxPitch: Math.PI / 2 - 0.01,
  minPitch: -Math.PI / 2 + 0.01,
  zoomSensitivity: 3,
  minFov: 10,
  maxFov: 90,
}

/**
 * Set of keys that are tracked for movement.
 */
export const NAV_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

/**
 * Check whether a key event should be handled by free navigation.
 * Ignores text-input form elements (text inputs, textareas, contenteditable).
 * Allows checkboxes, radio buttons, and non-form targets.
 */
export function shouldHandleKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  // Allow window/document targets (e.g. when no element has focus)
  if (target === window || target === document) return true
  const el = target as HTMLElement
  const tag = el.tagName
  if (!tag) return true // non-element nodes are safe
  const tagLower = tag.toLowerCase()

  // Block text-input elements only
  if (tagLower === 'textarea') return false
  if (tagLower === 'input') {
    const inputType = ((target as Node as HTMLInputElement).type || 'text').toLowerCase()
    // Allow checkbox, radio, and non-text input types
    if (inputType === 'checkbox' || inputType === 'radio') return true
    // Block text-like inputs
    if (['text', 'password', 'search', 'email', 'url', 'tel', 'number', ''].includes(inputType)) return false
    // Allow other types (range, color, date, file, etc.)
    return true
  }
  if (el.isContentEditable) return false
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
 * Update yaw and pitch angles from deltas.
 * Pure math: takes current angles and deltas, returns new clamped angles.
 *
 * @param currentYaw Current yaw in radians.
 * @param currentPitch Current pitch in radians.
 * @param deltaYaw Change in yaw in radians.
 * @param deltaPitch Change in pitch in radians.
 * @param minPitch Minimum allowed pitch (clamped).
 * @param maxPitch Maximum allowed pitch (clamped).
 * @returns [newYaw, newPitch] with pitch clamped.
 */
export function updateLookAngles(
  currentYaw: number,
  currentPitch: number,
  deltaYaw: number,
  deltaPitch: number,
  minPitch: number,
  maxPitch: number,
): [number, number] {
  const newYaw = currentYaw + deltaYaw
  let newPitch = currentPitch + deltaPitch
  newPitch = Math.max(minPitch, Math.min(maxPitch, newPitch))
  return [newYaw, newPitch]
}

/**
 * Apply absolute yaw and pitch to the camera orientation.
 * Uses YXZ Euler order: yaw rotates around world Y axis,
 * pitch rotates around the camera's local X axis.
 *
 * @param camera The Three.js camera.
 * @param yaw Absolute yaw angle in radians.
 * @param pitch Absolute pitch angle in radians.
 */
export function applyLook(
  camera: PerspectiveCamera,
  yaw: number,
  pitch: number,
): void {
  const euler = new Euler(pitch, yaw, 0, 'YXZ')
  camera.quaternion.copy(new Quaternion().setFromEuler(euler))
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

/**
 * Apply scroll-wheel zoom to the camera FOV.
 * Positive delta (scroll down) zooms out (increases FOV).
 * Negative delta (scroll up) zooms in (decreases FOV).
 *
 * @param camera The Three.js PerspectiveCamera.
 * @param scrollDelta Mouse wheel delta (negative = scroll up / zoom in).
 * @param sensitivity FOV change per unit of scroll delta.
 * @param minFov Minimum FOV in degrees (most zoomed in).
 * @param maxFov Maximum FOV in degrees (most zoomed out).
 * @returns The new clamped FOV value.
 */
export function applyZoom(
  camera: PerspectiveCamera,
  scrollDelta: number,
  sensitivity: number,
  minFov: number,
  maxFov: number,
): number {
  const newFov = camera.fov - scrollDelta * sensitivity
  const clamped = Math.max(minFov, Math.min(maxFov, newFov))
  camera.fov = clamped
  camera.updateProjectionMatrix()
  return clamped
}
