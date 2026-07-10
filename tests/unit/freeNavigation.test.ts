import { describe, it, expect, vi } from 'vitest'
import {
  computeMoveDirection,
  isNavKey,
  shouldHandleKeyEvent,
  applyMovement,
  applyLookAt,
  extractYawPitch,
  NAV_KEYS,
  DEFAULT_FREE_NAV_CONFIG,
} from '$lib/spark/freeNavigation'

describe('NAV_KEYS', () => {
  it('contains WASD', () => {
    for (const k of ['w', 'a', 's', 'd']) {
      expect(NAV_KEYS.has(k)).toBe(true)
    }
  })

  it('contains arrow keys', () => {
    for (const k of ['arrowup', 'arrowdown', 'arrowleft', 'arrowright']) {
      expect(NAV_KEYS.has(k)).toBe(true)
    }
  })
})

describe('isNavKey', () => {
  it('returns true for WASD', () => {
    expect(isNavKey('w')).toBe(true)
    expect(isNavKey('a')).toBe(true)
    expect(isNavKey('s')).toBe(true)
    expect(isNavKey('d')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isNavKey('W')).toBe(true)
    expect(isNavKey('D')).toBe(true)
  })

  it('returns true for arrow keys', () => {
    expect(isNavKey('ArrowUp')).toBe(true)
    expect(isNavKey('ArrowDown')).toBe(true)
    expect(isNavKey('ArrowLeft')).toBe(true)
    expect(isNavKey('ArrowRight')).toBe(true)
  })

  it('returns false for non-nav keys', () => {
    expect(isNavKey('escape')).toBe(false)
    expect(isNavKey('tab')).toBe(false)
    expect(isNavKey('x')).toBe(false)
  })
})

describe('shouldHandleKeyEvent', () => {
  it('returns false for input elements', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: input })
    expect(shouldHandleKeyEvent(event)).toBe(false)
    document.body.removeChild(input)
  })

  it('returns false for textarea elements', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: ta })
    expect(shouldHandleKeyEvent(event)).toBe(false)
    document.body.removeChild(ta)
  })

  it('returns true for body element', () => {
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: document.body })
    expect(shouldHandleKeyEvent(event)).toBe(true)
  })

  it('returns true for window target', () => {
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: window })
    expect(shouldHandleKeyEvent(event)).toBe(true)
  })

  it('returns true for document target', () => {
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: document })
    expect(shouldHandleKeyEvent(event)).toBe(true)
  })
})

describe('computeMoveDirection', () => {
  it('returns zero vector when no keys pressed', () => {
    expect(computeMoveDirection(new Set())).toEqual([0, 0, 0])
  })

  it('returns forward direction for W', () => {
    const dir = computeMoveDirection(new Set(['w']))
    expect(dir[0]).toBeCloseTo(0)
    expect(dir[1]).toBeCloseTo(0)
    expect(dir[2]).toBeCloseTo(-1)
  })

  it('returns backward direction for S', () => {
    const dir = computeMoveDirection(new Set(['s']))
    expect(dir[0]).toBeCloseTo(0)
    expect(dir[1]).toBeCloseTo(0)
    expect(dir[2]).toBeCloseTo(1)
  })

  it('returns left direction for A', () => {
    const dir = computeMoveDirection(new Set(['a']))
    expect(dir[0]).toBeCloseTo(-1)
    expect(dir[1]).toBeCloseTo(0)
    expect(dir[2]).toBeCloseTo(0)
  })

  it('returns right direction for D', () => {
    const dir = computeMoveDirection(new Set(['d']))
    expect(dir[0]).toBeCloseTo(1)
    expect(dir[1]).toBeCloseTo(0)
    expect(dir[2]).toBeCloseTo(0)
  })

  it('normalises diagonal movement', () => {
    const dir = computeMoveDirection(new Set(['w', 'd']))
    const sqrt2inv = 1 / Math.sqrt(2)
    expect(dir[0]).toBeCloseTo(sqrt2inv)
    expect(dir[2]).toBeCloseTo(-sqrt2inv)
  })

  it('works with arrow keys', () => {
    const up = computeMoveDirection(new Set(['arrowup']))
    expect(up[0]).toBeCloseTo(0)
    expect(up[2]).toBeCloseTo(-1)

    const down = computeMoveDirection(new Set(['arrowdown']))
    expect(down[0]).toBeCloseTo(0)
    expect(down[2]).toBeCloseTo(1)

    const left = computeMoveDirection(new Set(['arrowleft']))
    expect(left[0]).toBeCloseTo(-1)
    expect(left[2]).toBeCloseTo(0)

    const right = computeMoveDirection(new Set(['arrowright']))
    expect(right[0]).toBeCloseTo(1)
    expect(right[2]).toBeCloseTo(0)
  })
})

describe('applyMovement', () => {
  it('moves camera when direction is non-zero', () => {
    const camera = {
      position: { x: 0, y: 5, z: 0 },
    } as unknown as Parameters<typeof applyMovement>[0]

    // Forward direction with yaw=0
    applyMovement(camera, [0, 0, -1], 0, 1, 5)
    // With yaw=0: worldDz = -cos(0)*(-1) = 1, so z += 5
    expect(camera.position.z).toBeCloseTo(5)
    expect(camera.position.x).toBeCloseTo(0)
  })

  it('does not move when direction is zero', () => {
    const camera = {
      position: { x: 10, y: 5, z: 20 },
    } as unknown as Parameters<typeof applyMovement>[0]

    applyMovement(camera, [0, 0, 0], 0, 1, 5)
    expect(camera.position.x).toBe(10)
    expect(camera.position.z).toBe(20)
  })

  it('respects delta time', () => {
    const camera = {
      position: { x: 0, y: 5, z: 0 },
    } as unknown as Parameters<typeof applyMovement>[0]

    // delta=0.5, speed=10 => dist=5
    applyMovement(camera, [0, 0, -1], 0, 0.5, 10)
    expect(camera.position.z).toBeCloseTo(5)
  })

  it('applies yaw rotation to movement', () => {
    const camera = {
      position: { x: 0, y: 5, z: 0 },
    } as unknown as Parameters<typeof applyMovement>[0]

    // Yaw = PI/2 (looking along +X)
    // Forward with yaw=PI/2: worldDx = cos(PI/2)*0 - sin(PI/2)*(-1) = 1
    // worldDz = -sin(PI/2)*0 - cos(PI/2)*(-1) = 0
    applyMovement(camera, [0, 0, -1], Math.PI / 2, 1, 5)
    expect(camera.position.x).toBeCloseTo(5)
    expect(camera.position.z).toBeCloseTo(0)
  })
})

describe('applyLookAt', () => {
  it('clamps pitch to max', () => {
    const camera = {
      quaternion: { copy: vi.fn() },
    } as unknown as Parameters<typeof applyLookAt>[0]

    const newPitch = applyLookAt(
      camera,
      0,
      Math.PI, // large pitch up
      0,
      DEFAULT_FREE_NAV_CONFIG.maxPitch,
      DEFAULT_FREE_NAV_CONFIG.minPitch,
    )
    expect(newPitch).toBeLessThanOrEqual(DEFAULT_FREE_NAV_CONFIG.maxPitch)
  })

  it('clamps pitch to min', () => {
    const camera = {
      quaternion: { copy: vi.fn() },
    } as unknown as Parameters<typeof applyLookAt>[0]

    const newPitch = applyLookAt(
      camera,
      0,
      -Math.PI, // large pitch down
      0,
      DEFAULT_FREE_NAV_CONFIG.maxPitch,
      DEFAULT_FREE_NAV_CONFIG.minPitch,
    )
    expect(newPitch).toBeGreaterThanOrEqual(DEFAULT_FREE_NAV_CONFIG.minPitch)
  })
})

describe('extractYawPitch', () => {
  it('returns [0, 0] for identity orientation', () => {
    const identityQuat = {
      _x: 0,
      _y: 0,
      _z: 0,
      _w: 1,
      get x() { return this._x },
      get y() { return this._y },
      get z() { return this._z },
      get w() { return this._w },
    }
    const camera = {
      quaternion: identityQuat,
    } as unknown as Parameters<typeof extractYawPitch>[0]

    const [yaw, pitch] = extractYawPitch(camera)
    expect(yaw).toBeCloseTo(0)
    expect(pitch).toBeCloseTo(0)
  })
})

describe('DEFAULT_FREE_NAV_CONFIG', () => {
  it('has reasonable defaults', () => {
    expect(DEFAULT_FREE_NAV_CONFIG.moveSpeed).toBeGreaterThan(0)
    expect(DEFAULT_FREE_NAV_CONFIG.mouseSensitivity).toBeGreaterThan(0)
    expect(DEFAULT_FREE_NAV_CONFIG.maxPitch).toBeLessThan(Math.PI / 2)
    expect(DEFAULT_FREE_NAV_CONFIG.minPitch).toBeGreaterThan(-Math.PI / 2)
  })
})
