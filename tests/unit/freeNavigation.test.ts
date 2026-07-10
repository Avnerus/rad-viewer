import { describe, it, expect, vi } from 'vitest'
import {
  computeMoveDirection,
  isNavKey,
  shouldHandleKeyEvent,
  applyMovement,
  applyLook,
  updateLookAngles,
  applyZoom,
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
  it('returns false for text input elements', () => {
    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: input })
    expect(shouldHandleKeyEvent(event)).toBe(false)
    document.body.removeChild(input)
  })

  it('returns false for password input elements', () => {
    const input = document.createElement('input')
    input.type = 'password'
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: input })
    expect(shouldHandleKeyEvent(event)).toBe(false)
    document.body.removeChild(input)
  })

  it('returns true for checkbox input elements', () => {
    const input = document.createElement('input')
    input.type = 'checkbox'
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: input })
    expect(shouldHandleKeyEvent(event)).toBe(true)
    document.body.removeChild(input)
  })

  it('returns true for radio input elements', () => {
    const input = document.createElement('input')
    input.type = 'radio'
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'w' })
    Object.defineProperty(event, 'target', { value: input })
    expect(shouldHandleKeyEvent(event)).toBe(true)
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

describe('updateLookAngles', () => {
  it('accumulates yaw across calls', () => {
    let yaw = 0
    let pitch = 0

    ;[yaw, pitch] = updateLookAngles(yaw, pitch, 0.5, 0, -1, 1)
    expect(yaw).toBeCloseTo(0.5)

    ;[yaw, pitch] = updateLookAngles(yaw, pitch, 0.3, 0, -1, 1)
    expect(yaw).toBeCloseTo(0.8)

    ;[yaw, pitch] = updateLookAngles(yaw, pitch, -0.2, 0, -1, 1)
    expect(yaw).toBeCloseTo(0.6)
  })

  it('accumulates and clamps pitch', () => {
    let yaw = 0
    let pitch = 0
    const maxPitch = Math.PI / 2 - 0.01
    const minPitch = -Math.PI / 2 + 0.01

    // Pitch up to max
    ;[yaw, pitch] = updateLookAngles(yaw, pitch, 0, 1, minPitch, maxPitch)
    expect(pitch).toBeCloseTo(1)

    // Try to exceed max
    ;[yaw, pitch] = updateLookAngles(yaw, pitch, 0, Math.PI, minPitch, maxPitch)
    expect(pitch).toBeLessThanOrEqual(maxPitch)

    // Reset and pitch down to min
    pitch = 0
    ;[yaw, pitch] = updateLookAngles(yaw, pitch, 0, -1, minPitch, maxPitch)
    expect(pitch).toBeCloseTo(-1)

    // Try to exceed min
    ;[yaw, pitch] = updateLookAngles(yaw, pitch, 0, -Math.PI, minPitch, maxPitch)
    expect(pitch).toBeGreaterThanOrEqual(minPitch)
  })

  it('handles simultaneous yaw and pitch deltas', () => {
    let yaw = 0
    let pitch = 0

    ;[yaw, pitch] = updateLookAngles(yaw, pitch, 0.5, 0.3, -1, 1)
    expect(yaw).toBeCloseTo(0.5)
    expect(pitch).toBeCloseTo(0.3)
  })
})

describe('applyLook', () => {
  it('sets camera quaternion from yaw and pitch', () => {
    const copyFn = vi.fn()
    const camera = {
      quaternion: { copy: copyFn },
    } as unknown as Parameters<typeof applyLook>[0]

    applyLook(camera, 0.5, 0.3)
    expect(copyFn).toHaveBeenCalled()
  })

  it('applies identity for zero yaw and pitch', () => {
    const camera = {
      quaternion: {
        _x: 0, _y: 0, _z: 0, _w: 0,
        copy(q: { x: number; y: number; z: number; w: number }) {
          this._x = q.x; this._y = q.y; this._z = q.z; this._w = q.w
        },
        get x() { return this._x },
        get y() { return this._y },
        get z() { return this._z },
        get w() { return this._w },
      },
    } as unknown as Parameters<typeof applyLook>[0]

    applyLook(camera, 0, 0)
    // Identity quaternion: w=1, x=y=z=0
    expect(camera.quaternion.w).toBeCloseTo(1)
    expect(camera.quaternion.x).toBeCloseTo(0)
    expect(camera.quaternion.y).toBeCloseTo(0)
    expect(camera.quaternion.z).toBeCloseTo(0)
  })
})

describe('applyZoom', () => {
  it('increases FOV on negative delta (scroll up / zoom out)', () => {
    const updateFn = vi.fn()
    const camera = {
      fov: 60,
      updateProjectionMatrix: updateFn,
    } as unknown as Parameters<typeof applyZoom>[0]

    // newFov = 60 - (-10)*3 = 90
    const newFov = applyZoom(camera, -10, 3, 10, 90)
    expect(newFov).toBeCloseTo(90)
    expect(updateFn).toHaveBeenCalled()
  })

  it('decreases FOV on positive delta (scroll down / zoom in)', () => {
    const updateFn = vi.fn()
    const camera = {
      fov: 60,
      updateProjectionMatrix: updateFn,
    } as unknown as Parameters<typeof applyZoom>[0]

    // newFov = 60 - 10*3 = 30
    const newFov = applyZoom(camera, 10, 3, 10, 90)
    expect(newFov).toBeCloseTo(30)
    expect(updateFn).toHaveBeenCalled()
  })

  it('clamps to min FOV', () => {
    const camera = {
      fov: 15,
      updateProjectionMatrix: vi.fn(),
    } as unknown as Parameters<typeof applyZoom>[0]

    // Large positive delta drives FOV way below min
    // 15 - 100*3 = -285, clamped to 10
    const newFov = applyZoom(camera, 100, 3, 10, 90)
    expect(newFov).toBeCloseTo(10)
  })

  it('clamps to max FOV', () => {
    const camera = {
      fov: 85,
      updateProjectionMatrix: vi.fn(),
    } as unknown as Parameters<typeof applyZoom>[0]

    const newFov = applyZoom(camera, -100, 3, 10, 90)
    // 85 - (-100)*3 = 385, clamped to 90
    expect(newFov).toBeCloseTo(90)
  })

  it('uses default config values', () => {
    const camera = {
      fov: 60,
      updateProjectionMatrix: vi.fn(),
    } as unknown as Parameters<typeof applyZoom>[0]

    const newFov = applyZoom(
      camera,
      5,
      DEFAULT_FREE_NAV_CONFIG.zoomSensitivity,
      DEFAULT_FREE_NAV_CONFIG.minFov,
      DEFAULT_FREE_NAV_CONFIG.maxFov,
    )
    // 60 - 5*3 = 45
    expect(newFov).toBeCloseTo(45)
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
    expect(DEFAULT_FREE_NAV_CONFIG.zoomSensitivity).toBeGreaterThan(0)
    expect(DEFAULT_FREE_NAV_CONFIG.minFov).toBeGreaterThan(0)
    expect(DEFAULT_FREE_NAV_CONFIG.maxFov).toBeLessThan(180)
    expect(DEFAULT_FREE_NAV_CONFIG.minFov).toBeLessThan(DEFAULT_FREE_NAV_CONFIG.maxFov)
  })
})
