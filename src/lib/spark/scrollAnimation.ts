/**
 * Pure, serializable keyframe model and interpolation helpers for ScrollAnimator.
 *
 * Percentages are stored with 2-decimal precision to avoid wheel-scroll noise
 * creating near-duplicate frames. Deep copies are always returned so callers
 * never alias internal state.
 */
import { Vector3, Quaternion, Euler } from 'three'

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** Three-element number tuple for serializable vectors. */
export type Vec3Tuple = [number, number, number]

/**
 * A single scroll keyframe. Stored as plain data for source serialization.
 */
export interface ScrollKeyframe {
  /** Percentage in the inclusive range 0..100, rounded to 2 decimals. */
  scroll: number
  /** Local position as [x, y, z]. */
  position: Vec3Tuple
  /** Local XYZ Euler rotation in radians. */
  rotation: Vec3Tuple
}

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

/** Decimal precision for percentage values (avoids near-duplicate frames). */
export const PERCENTAGE_DECIMALS = 2

/**
 * Round a percentage to the configured precision.
 */
export function roundPercentage(value: number): number {
  return Math.round(value * 10 ** PERCENTAGE_DECIMALS) / 10 ** PERCENTAGE_DECIMALS
}

/**
 * Clamp a percentage to the inclusive range 0..100 and round.
 */
export function clampPercentage(value: number): number {
  return roundPercentage(Math.max(0, Math.min(100, value)))
}

/* ------------------------------------------------------------------ */
/* Canonicalization                                                     */
/* ------------------------------------------------------------------ */

/**
 * Deep-copy and canonicalize a keyframe array:
 * - Clone every entry
 * - Clamp and round each percentage
 * - Sort ascending by percentage
 * - Deduplicate: when multiple entries normalize to the same percentage,
 *   the last one wins (deterministic last-write-wins).
 * @returns A new canonical array (never aliases the input).
 */
export function canonicalizeKeyframes(raw: ScrollKeyframe[]): ScrollKeyframe[] {
  const clamped = raw.map((kf) => ({
    scroll: clampPercentage(kf.scroll),
    position: [...kf.position] as Vec3Tuple,
    rotation: [...kf.rotation] as Vec3Tuple,
  }))
  clamped.sort((a, b) => a.scroll - b.scroll)

  // Deduplicate: last-write-wins for equal percentages
  const deduped: ScrollKeyframe[] = []
  for (const kf of clamped) {
    if (deduped.length > 0 && deduped[deduped.length - 1].scroll === kf.scroll) {
      deduped[deduped.length - 1] = kf
    } else {
      deduped.push(kf)
    }
  }
  return deduped
}

/* ------------------------------------------------------------------ */
/* Mutations                                                            */
/* ------------------------------------------------------------------ */

/**
 * Upsert a keyframe at the given percentage.
 * If a frame at the same normalized percentage exists it is replaced.
 * @returns A new canonical array (never mutates the input).
 */
export function upsertKeyframe(
  keyframes: ScrollKeyframe[],
  scroll: number,
  position: Vec3Tuple,
  rotation: Vec3Tuple,
): ScrollKeyframe[] {
  const normalized = clampPercentage(scroll)
  const existing = keyframes.findIndex((kf) => kf.scroll === normalized)
  const entry: ScrollKeyframe = {
    scroll: normalized,
    position: [...position],
    rotation: [...rotation],
  }
  if (existing >= 0) {
    const copy = [...keyframes]
    copy[existing] = entry
    return canonicalizeKeyframes(copy)
  }
  return canonicalizeKeyframes([...keyframes, entry])
}

/**
 * Delete the keyframe at the given normalized percentage (if any).
 * @returns A new array (never mutates the input).
 */
export function deleteKeyframe(
  keyframes: ScrollKeyframe[],
  scroll: number,
): ScrollKeyframe[] {
  const normalized = clampPercentage(scroll)
  const filtered = keyframes.filter((kf) => kf.scroll !== normalized)
  return canonicalizeKeyframes(filtered)
}

/* ------------------------------------------------------------------ */
/* Sampling                                                             */
/* ------------------------------------------------------------------ */

/**
 * Find the bracketing keyframes for a given percentage.
 * Returns `{ lower, upper }` where `lower.scroll <= percent <= upper.scroll`.
 * If percent is before the first frame, both are the first.
 * If percent is after the last frame, both are the last.
 * Returns `null` when the array is empty.
 */
export function bracketKeyframes(
  keyframes: ScrollKeyframe[],
  percent: number,
): { lower: ScrollKeyframe; upper: ScrollKeyframe } | null {
  if (keyframes.length === 0) return null

  const clamped = Math.max(0, Math.min(100, percent))

  // If before first keyframe, clamp to first
  if (clamped <= keyframes[0].scroll) {
    return { lower: keyframes[0], upper: keyframes[0] }
  }

  // If after last keyframe, clamp to last
  const last = keyframes[keyframes.length - 1]
  if (clamped >= last.scroll) {
    return { lower: last, upper: last }
  }

  // Find the bracket: lower <= clamped < upper
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].scroll <= clamped && keyframes[i + 1].scroll > clamped) {
      // Exact match on lower
      if (keyframes[i].scroll === clamped) {
        return { lower: keyframes[i], upper: keyframes[i] }
      }
      return { lower: keyframes[i], upper: keyframes[i + 1] }
    }
  }

  // Should not reach here, but fallback to last
  return { lower: last, upper: last }
}

/**
 * Sample the transform at a given percentage.
 * - Zero keyframes: returns `null` (do not mutate).
 * - One keyframe: returns that keyframe's transform.
 * - Otherwise: interpolates between bracketing keyframes.
 *
 * Position uses linear interpolation; rotation uses shortest-path quaternion
 * slerp (converting the stored Euler endpoints to quaternions).
 *
 * @returns `{ position, quaternion }` or `null`.
 */
export function sampleKeyframes(
  keyframes: ScrollKeyframe[],
  percent: number,
): { position: Vector3; quaternion: Quaternion } | null {
  if (keyframes.length === 0) return null

  const bracket = bracketKeyframes(keyframes, percent)
  if (!bracket) return null

  const { lower, upper } = bracket

  // Single keyframe or exact match
  if (lower.scroll === upper.scroll) {
    return {
      position: new Vector3(...lower.position),
      quaternion: eulerToQuaternion(...lower.rotation),
    }
  }

  // Interpolation factor within the bracket
  const range = upper.scroll - lower.scroll
  const t = range > 0 ? (percent - lower.scroll) / range : 0

  // Position: linear lerp
  const pos = new Vector3()
  pos.x = lower.position[0] + (upper.position[0] - lower.position[0]) * t
  pos.y = lower.position[1] + (upper.position[1] - lower.position[1]) * t
  pos.z = lower.position[2] + (upper.position[2] - lower.position[2]) * t

  // Rotation: quaternion slerp (shortest path)
  const qLower = eulerToQuaternion(...lower.rotation)
  const qUpper = eulerToQuaternion(...upper.rotation)
  const quat = new Quaternion().slerpQuaternions(qLower, qUpper, t)

  return { position: pos, quaternion: quat }
}

/**
 * Convert Euler XYZ radians to a Quaternion.
 */
function eulerToQuaternion(x: number, y: number, z: number): Quaternion {
  return new Quaternion().setFromEuler(new Euler(x, y, z, 'XYZ'))
}

/* ------------------------------------------------------------------ */
/* ScrollTrigger range helpers                                          */
/* ------------------------------------------------------------------ */

/**
 * Convert a ScrollTrigger's measured start/end range to a percentage
 * for a given scroll offset.
 */
export function scrollToPercentage(scrollY: number, start: number, end: number): number {
  const range = end - start
  if (range === 0) return 0
  return clampPercentage(((scrollY - start) / range) * 100)
}

/**
 * Convert a percentage (0..100) to a scroll offset within a ScrollTrigger range.
 */
export function percentageToScroll(percent: number, start: number, end: number): number {
  const clamped = clampPercentage(percent)
  const range = end - start
  if (range === 0) return start
  return start + (clamped / 100) * range
}
