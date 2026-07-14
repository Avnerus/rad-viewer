import { describe, it, expect } from 'vitest'
import {
  clampPercentage,
  roundPercentage,
  canonicalizeKeyframes,
  upsertKeyframe,
  deleteKeyframe,
  bracketKeyframes,
  sampleKeyframes,
  scrollToPercentage,
  percentageToScroll,
  PERCENTAGE_DECIMALS,
} from '$lib/spark/scrollAnimation'
import type { ScrollKeyframe } from '$lib/spark/scrollAnimation'

describe('roundPercentage', () => {
  it('rounds to configured decimal places', () => {
    expect(roundPercentage(33.333333)).toBe(33.33)
    expect(roundPercentage(50.005)).toBe(50.01)
    expect(roundPercentage(0)).toBe(0)
    expect(roundPercentage(100)).toBe(100)
  })

  it('uses 2 decimal precision', () => {
    expect(PERCENTAGE_DECIMALS).toBe(2)
  })
})

describe('clampPercentage', () => {
  it('clamps below 0 to 0', () => {
    expect(clampPercentage(-10)).toBe(0)
    expect(clampPercentage(-0.001)).toBe(0)
  })

  it('clamps above 100 to 100', () => {
    expect(clampPercentage(110)).toBe(100)
    expect(clampPercentage(100.009)).toBe(100)
  })

  it('passes through valid values with rounding', () => {
    expect(clampPercentage(50.5555)).toBe(50.56)
    expect(clampPercentage(25.123)).toBe(25.12)
  })
})

describe('canonicalizeKeyframes', () => {
  it('returns a deep copy', () => {
    const original: ScrollKeyframe[] = [
      { scroll: 50, position: [1, 2, 3], rotation: [0.1, 0.2, 0.3] },
    ]
    const result = canonicalizeKeyframes(original)
    expect(result).not.toBe(original)
    expect(result[0]).not.toBe(original[0])
    expect(result[0].position).not.toBe(original[0].position)
    expect(result[0].rotation).not.toBe(original[0].rotation)
  })

  it('sorts by scroll ascending', () => {
    const input: ScrollKeyframe[] = [
      { scroll: 50, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 100, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 25, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = canonicalizeKeyframes(input)
    expect(result.map((kf) => kf.scroll)).toEqual([0, 25, 50, 100])
  })

  it('clamps percentages', () => {
    const input: ScrollKeyframe[] = [
      { scroll: -5, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 105, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = canonicalizeKeyframes(input)
    expect(result[0].scroll).toBe(0)
    expect(result[1].scroll).toBe(100)
  })

  it('handles empty array', () => {
    expect(canonicalizeKeyframes([])).toEqual([])
  })
})

describe('upsertKeyframe', () => {
  it('adds a new keyframe', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = upsertKeyframe(existing, 50, [1, 2, 3], [0.1, 0.2, 0.3])
    expect(result).toHaveLength(2)
    expect(result[1].scroll).toBe(50)
    expect(result[1].position).toEqual([1, 2, 3])
    expect(result[1].rotation).toEqual([0.1, 0.2, 0.3])
  })

  it('replaces at same normalized percentage', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 50, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = upsertKeyframe(existing, 50.001, [5, 5, 5], [1, 1, 1])
    expect(result).toHaveLength(1)
    expect(result[0].position).toEqual([5, 5, 5])
  })

  it('does not mutate the input array', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    upsertKeyframe(existing, 50, [1, 2, 3], [0, 0, 0])
    expect(existing).toHaveLength(1)
  })

  it('returns sorted result', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 100, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = upsertKeyframe(existing, 50, [1, 2, 3], [0, 0, 0])
    expect(result.map((kf) => kf.scroll)).toEqual([0, 50, 100])
  })
})

describe('deleteKeyframe', () => {
  it('removes the matching keyframe', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 50, position: [1, 2, 3], rotation: [0, 0, 0] },
      { scroll: 100, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = deleteKeyframe(existing, 50)
    expect(result).toHaveLength(2)
    expect(result.map((kf) => kf.scroll)).toEqual([0, 100])
  })

  it('does nothing when percentage not found', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = deleteKeyframe(existing, 50)
    expect(result).toHaveLength(1)
  })

  it('allows deleting the last frame', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const result = deleteKeyframe(existing, 0)
    expect(result).toHaveLength(0)
  })

  it('does not mutate the input array', () => {
    const existing: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 50, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    deleteKeyframe(existing, 50)
    expect(existing).toHaveLength(2)
  })
})

describe('bracketKeyframes', () => {
  const frames: ScrollKeyframe[] = [
    { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
    { scroll: 50, position: [0, 10, 0], rotation: [0, 0, 0] },
    { scroll: 100, position: [0, 20, 0], rotation: [0, 0, 0] },
  ]

  it('returns null for empty array', () => {
    expect(bracketKeyframes([], 50)).toBeNull()
  })

  it('returns first frame for percent before first', () => {
    const bracket = bracketKeyframes(frames, -10)
    expect(bracket).not.toBeNull()
    expect(bracket!.lower.scroll).toBe(0)
    expect(bracket!.upper.scroll).toBe(0)
  })

  it('returns last frame for percent after last', () => {
    const bracket = bracketKeyframes(frames, 110)
    expect(bracket).not.toBeNull()
    expect(bracket!.lower.scroll).toBe(100)
    expect(bracket!.upper.scroll).toBe(100)
  })

  it('returns exact match when on a keyframe', () => {
    const bracket = bracketKeyframes(frames, 50)
    expect(bracket).not.toBeNull()
    expect(bracket!.lower.scroll).toBe(50)
    expect(bracket!.upper.scroll).toBe(50)
  })

  it('returns bracketing frames for between keyframes', () => {
    const bracket = bracketKeyframes(frames, 25)
    expect(bracket).not.toBeNull()
    expect(bracket!.lower.scroll).toBe(0)
    expect(bracket!.upper.scroll).toBe(50)
  })

  it('handles single keyframe', () => {
    const single: ScrollKeyframe[] = [
      { scroll: 50, position: [0, 0, 0], rotation: [0, 0, 0] },
    ]
    const bracket = bracketKeyframes(single, 25)
    expect(bracket).not.toBeNull()
    expect(bracket!.lower.scroll).toBe(50)
    expect(bracket!.upper.scroll).toBe(50)
  })
})

describe('sampleKeyframes', () => {
  it('returns null for empty keyframes', () => {
    expect(sampleKeyframes([], 50)).toBeNull()
  })

  it('returns the single keyframe transform for any percentage', () => {
    const single: ScrollKeyframe[] = [
      { scroll: 50, position: [3, 4, 5], rotation: [0.1, 0.2, 0.3] },
    ]
    const result = sampleKeyframes(single, 0)
    expect(result).not.toBeNull()
    expect(result!.position.x).toBeCloseTo(3)
    expect(result!.position.y).toBeCloseTo(4)
    expect(result!.position.z).toBeCloseTo(5)

    const result100 = sampleKeyframes(single, 100)
    expect(result100).not.toBeNull()
    expect(result100!.position.x).toBeCloseTo(3)
  })

  it('returns exact keyframe at endpoints', () => {
    const frames: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, -1], rotation: [0, 0, 0] },
      { scroll: 100, position: [0, 30, -1], rotation: [0, 0, 0] },
    ]
    const at0 = sampleKeyframes(frames, 0)
    expect(at0).not.toBeNull()
    expect(at0!.position.x).toBeCloseTo(0)
    expect(at0!.position.y).toBeCloseTo(0)
    expect(at0!.position.z).toBeCloseTo(-1)

    const at100 = sampleKeyframes(frames, 100)
    expect(at100).not.toBeNull()
    expect(at100!.position.y).toBeCloseTo(30)
  })

  it('linearly interpolates position between keyframes', () => {
    const frames: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 100, position: [0, 20, 0], rotation: [0, 0, 0] },
    ]
    const at50 = sampleKeyframes(frames, 50)
    expect(at50).not.toBeNull()
    expect(at50!.position.y).toBeCloseTo(10)

    const at25 = sampleKeyframes(frames, 25)
    expect(at25!.position.y).toBeCloseTo(5)
  })

  it('clamps to endpoints when outside range', () => {
    const frames: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 100, position: [0, 20, 0], rotation: [0, 0, 0] },
    ]
    const atNeg = sampleKeyframes(frames, -10)
    expect(atNeg!.position.y).toBeCloseTo(0)

    const at110 = sampleKeyframes(frames, 110)
    expect(at110!.position.y).toBeCloseTo(20)
  })

  it('uses quaternion slerp for rotation', () => {
    // 180-degree yaw rotation to test shortest path
    const frames: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
      { scroll: 100, position: [0, 0, 0], rotation: [0, Math.PI, 0] },
    ]
    const at50 = sampleKeyframes(frames, 50)
    expect(at50).not.toBeNull()
    // At midpoint, the quaternion should represent a 90-degree rotation
    // The slerp should take the shortest path
    const quat = at50!.quaternion
    // A 90-degree Y rotation has w = cos(45°) ≈ 0.707
    expect(Math.abs(quat.w)).toBeCloseTo(0.707, 2)
  })

  it('handles rotation across ±π boundary correctly', () => {
    // Two rotations that are very close but differ in Euler representation
    // euler [0, 3.14, 0] vs [0, -3.14, 0] are nearly the same quaternion
    const frames: ScrollKeyframe[] = [
      { scroll: 0, position: [0, 0, 0], rotation: [0, Math.PI - 0.1, 0] },
      { scroll: 100, position: [0, 0, 0], rotation: [0, -Math.PI + 0.1, 0] },
    ]
    const at50 = sampleKeyframes(frames, 50)
    expect(at50).not.toBeNull()
    // The slerp should take the short path (these are nearly the same rotation)
    // so the midpoint quaternion should be close to the endpoints
    const quat = at50!.quaternion
    // Dot product with endpoint should be high (close to 1 = same rotation)
    const qStart = sampleKeyframes(frames, 0)!.quaternion
    const dot = quat.dot(qStart!)
    expect(dot).toBeGreaterThan(0.9) // Short path means high dot product
  })
})

describe('scrollToPercentage', () => {
  it('maps start to 0%', () => {
    expect(scrollToPercentage(0, 0, 1000)).toBe(0)
  })

  it('maps end to 100%', () => {
    expect(scrollToPercentage(1000, 0, 1000)).toBe(100)
  })

  it('maps midpoint to 50%', () => {
    expect(scrollToPercentage(500, 0, 1000)).toBe(50)
  })

  it('handles zero-length range', () => {
    expect(scrollToPercentage(500, 500, 500)).toBe(0)
  })

  it('clamps below start to 0', () => {
    expect(scrollToPercentage(-100, 0, 1000)).toBe(0)
  })

  it('clamps above end to 100', () => {
    expect(scrollToPercentage(1100, 0, 1000)).toBe(100)
  })
})

describe('percentageToScroll', () => {
  it('maps 0% to start', () => {
    expect(percentageToScroll(0, 0, 1000)).toBe(0)
  })

  it('maps 100% to end', () => {
    expect(percentageToScroll(100, 0, 1000)).toBe(1000)
  })

  it('maps 50% to midpoint', () => {
    expect(percentageToScroll(50, 0, 1000)).toBe(500)
  })

  it('handles zero-length range', () => {
    expect(percentageToScroll(50, 500, 500)).toBe(500)
  })

  it('clamps percentage', () => {
    expect(percentageToScroll(-10, 0, 1000)).toBe(0)
    expect(percentageToScroll(110, 0, 1000)).toBe(1000)
  })
})
