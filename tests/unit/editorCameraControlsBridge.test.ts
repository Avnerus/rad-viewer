import { describe, it, expect, beforeEach } from 'vitest'
import {
  applyEditorCameraControlsTuning,
  attachControls,
  detachControls,
  getCurrentControls,
  updateTuning,
  applyCurrentTuning,
  getCurrentTuning,
  DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING,
  type EditorCameraControlsLike,
  type EditorCameraControlsTuning,
} from '$lib/studio/editor-camera/editorCameraControlsBridge'

function makeMockControls(overrides: Partial<EditorCameraControlsLike> = {}): EditorCameraControlsLike {
  return {
    smoothTime: 0.05,
    draggingSmoothTime: 0.05,
    dollyToCursor: true,
    ...overrides,
  }
}

describe('editorCameraControlsBridge', () => {
  beforeEach(() => {
    // Reset bridge state before each test
    detachControls()
    updateTuning(DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING)
  })

  describe('DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING', () => {
    it('matches installed Studio defaults (0.05, 0.05, true)', () => {
      expect(DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING.smoothTime).toBe(0.05)
      expect(DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING.draggingSmoothTime).toBe(0.05)
      expect(DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING.dollyToCursor).toBe(true)
    })
  })

  describe('applyEditorCameraControlsTuning', () => {
    it('applies tuning to a controls instance', () => {
      const controls = makeMockControls()
      const tuning: EditorCameraControlsTuning = {
        smoothTime: 0.5,
        draggingSmoothTime: 0.1,
        dollyToCursor: true,
      }
      applyEditorCameraControlsTuning(controls, tuning)

      expect(controls.smoothTime).toBe(0.5)
      expect(controls.draggingSmoothTime).toBe(0.1)
      expect(controls.dollyToCursor).toBe(true)
    })
  })

  describe('attach/detach', () => {
    it('starts with no controls attached', () => {
      expect(getCurrentControls()).toBeNull()
    })

    it('attach sets the current controls', () => {
      const controls = makeMockControls()
      attachControls(controls)
      expect(getCurrentControls()).toBe(controls)
    })

    it('detach clears the current controls', () => {
      const controls = makeMockControls()
      attachControls(controls)
      detachControls()
      expect(getCurrentControls()).toBeNull()
    })

    it('attach replaces previous controls', () => {
      const controls1 = makeMockControls({ smoothTime: 0.1 })
      const controls2 = makeMockControls({ smoothTime: 0.9 })
      attachControls(controls1)
      attachControls(controls2)
      expect(getCurrentControls()).toBe(controls2)
    })
  })

  describe('tuning', () => {
    it('getCurrentTuning returns a copy of defaults after reset', () => {
      const tuning = getCurrentTuning()
      expect(tuning).toEqual(DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING)
      // Should be a copy, not the same reference
      expect(tuning).not.toBe(DEFAULT_EDITOR_CAMERA_CONTROLS_TUNING)
    })

    it('updateTuning updates stored tuning', () => {
      const newTuning: EditorCameraControlsTuning = {
        smoothTime: 0.8,
        draggingSmoothTime: 0.3,
        dollyToCursor: true,
      }
      updateTuning(newTuning)
      expect(getCurrentTuning()).toEqual(newTuning)
    })

    it('updateTuning applies immediately when controls are attached', () => {
      const controls = makeMockControls()
      attachControls(controls)

      updateTuning({
        smoothTime: 0.6,
        draggingSmoothTime: 0.2,
        dollyToCursor: true,
      })

      expect(controls.smoothTime).toBe(0.6)
      expect(controls.draggingSmoothTime).toBe(0.2)
      expect(controls.dollyToCursor).toBe(true)
    })

    it('updateTuning does not throw when no controls attached', () => {
      // No controls attached — should be no-op
      expect(() => {
        updateTuning({
          smoothTime: 0.9,
          draggingSmoothTime: 0.5,
          dollyToCursor: true,
        })
      }).not.toThrow()
    })
  })

  describe('applyCurrentTuning', () => {
    it('applies current tuning to attached controls', () => {
      const controls = makeMockControls({ smoothTime: 0.1 })
      attachControls(controls)

      updateTuning({
        smoothTime: 0.7,
        draggingSmoothTime: 0.4,
        dollyToCursor: true,
      })

      // Tuning was already applied by updateTuning, but applyCurrentTuning should also work
      applyCurrentTuning()
      expect(controls.smoothTime).toBe(0.7)
      expect(controls.draggingSmoothTime).toBe(0.4)
      expect(controls.dollyToCursor).toBe(true)
    })

    it('is no-op when no controls attached', () => {
      updateTuning({
        smoothTime: 0.9,
        draggingSmoothTime: 0.5,
        dollyToCursor: true,
      })
      // Should not throw
      expect(() => applyCurrentTuning()).not.toThrow()
    })
  })
})
