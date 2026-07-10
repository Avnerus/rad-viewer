import { describe, it, expect, vi } from 'vitest'
import {
  getCameraPose,
  applyCameraPose,
  defaultPerspectivePose,
  defaultTopDownPose,
} from '$lib/spark/cameraTween'
import type { CameraPose } from '$lib/types'

describe('getCameraPose', () => {
  it('returns start pose at progress 0', () => {
    const pose = getCameraPose(0, defaultPerspectivePose, defaultTopDownPose)
    expect(pose.position).toEqual(defaultPerspectivePose.position)
    expect(pose.target).toEqual(defaultPerspectivePose.target)
  })

  it('returns end pose at progress 1', () => {
    const pose = getCameraPose(1, defaultPerspectivePose, defaultTopDownPose)
    expect(pose.position).toEqual(defaultTopDownPose.position)
    expect(pose.target).toEqual(defaultTopDownPose.target)
  })

  it('returns midpoint at progress 0.5', () => {
    const pose = getCameraPose(0.5, defaultPerspectivePose, defaultTopDownPose)
    expect(pose.position[0]).toBe((defaultPerspectivePose.position[0] + defaultTopDownPose.position[0]) / 2)
    expect(pose.position[1]).toBe((defaultPerspectivePose.position[1] + defaultTopDownPose.position[1]) / 2)
    expect(pose.position[2]).toBe((defaultPerspectivePose.position[2] + defaultTopDownPose.position[2]) / 2)
  })

  it('clamps progress below 0 to 0', () => {
    const pose = getCameraPose(-0.5, defaultPerspectivePose, defaultTopDownPose)
    expect(pose.position).toEqual(defaultPerspectivePose.position)
  })

  it('clamps progress above 1 to 1', () => {
    const pose = getCameraPose(1.5, defaultPerspectivePose, defaultTopDownPose)
    expect(pose.position).toEqual(defaultTopDownPose.position)
  })

  it('keeps target fixed when both poses share the same target', () => {
    const start: CameraPose = { position: [5, 5, 5], target: [0, 0, 0] }
    const end: CameraPose = { position: [0, 20, 0], target: [0, 0, 0] }

    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const pose = getCameraPose(p, start, end)
      expect(pose.target).toEqual([0, 0, 0])
    }
  })
})

describe('applyCameraPose', () => {
  it('sets camera position and lookAt target', () => {
    const setPosition = vi.fn()
    const lookAt = vi.fn()
    const camera = {
      position: { set: setPosition },
      lookAt,
    }

    const pose: CameraPose = { position: [3, 4, 5], target: [1, 2, 3] }
    applyCameraPose(camera as unknown as Parameters<typeof applyCameraPose>[0], pose)

    expect(setPosition).toHaveBeenCalledWith(3, 4, 5)
    expect(lookAt).toHaveBeenCalledWith(1, 2, 3)
  })
})

describe('default poses', () => {
  it('perspective pose is angled view', () => {
    expect(defaultPerspectivePose.position[0]).not.toBe(0)
    expect(defaultPerspectivePose.position[1]).toBeGreaterThan(0)
    expect(defaultPerspectivePose.position[2]).not.toBe(0)
    expect(defaultPerspectivePose.target).toEqual([0, 0, 0])
  })

  it('top-down pose looks straight down', () => {
    expect(defaultTopDownPose.position[0]).toBe(0)
    expect(defaultTopDownPose.position[1]).toBeGreaterThan(0)
    expect(defaultTopDownPose.position[2]).toBe(0)
    expect(defaultTopDownPose.target).toEqual([0, 0, 0])
  })
})
