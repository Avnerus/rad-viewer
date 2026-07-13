import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { SparkRenderer } from '@sparkjsdev/spark'
import type { SparkRendererOptions } from '@sparkjsdev/spark'
import { createSparkStudioRenderer } from '$lib/spark/createSparkStudioRenderer'

/** Build a minimal mock WebGLRenderer. */
function makeMockRenderer(): THREE.WebGLRenderer {
  return {
    render: vi.fn(),
    domElement: {} as HTMLCanvasElement,
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    setScissorTest: vi.fn(),
    setScissor: vi.fn(),
    setViewport: vi.fn(),
    info: { render: { frame: 0 } },
    capabilities: { maxTextureSize: 4096 },
  } as unknown as THREE.WebGLRenderer
}

/** Build a minimal mock scene. */
function makeMockScene(): THREE.Scene {
  return {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
  } as unknown as THREE.Scene
}

/** Base Spark options used by most tests. */
function makeBaseOptions(renderer: THREE.WebGLRenderer): SparkRendererOptions {
  return {
    renderer,
    pagedExtSplats: true,
    lodSplatScale: 1,
    lodRenderScale: 1,
    maxStdDev: 8,
    maxPagedSplats: 1_048_576,
    coneFov0: 0.2,
    coneFov: 1,
    coneFoveate: 0.2,
    behindFoveate: 0.1,
  }
}

describe('createSparkStudioRenderer', () => {
  let renderer: THREE.WebGLRenderer
  let scene: THREE.Scene
  let baseOptions: SparkRendererOptions

  beforeEach(() => {
    vi.clearAllMocks()
    SparkRenderer.sparkOverride = undefined
    renderer = makeMockRenderer()
    scene = makeMockScene()
    baseOptions = makeBaseOptions(renderer)
  })

  describe('renderer creation and options', () => {
    it('creates two SparkRenderer instances on attach', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      expect(handle.editorRenderer).toBeNull()
      expect(handle.realRenderer).toBeNull()

      handle.attach(scene, renderer)

      expect(handle.editorRenderer).toBeInstanceOf(SparkRenderer)
      expect(handle.realRenderer).toBeInstanceOf(SparkRenderer)
    })

    it('editor renderer has enableDriveLod: false', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      expect(handle.editorRenderer!.enableDriveLod).toBe(false)
    })

    it('editor renderer has enableLod: true', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      expect(handle.editorRenderer!.enableLod).toBe(true)
    })

    it('real renderer has enableDriveLod: true', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      expect(handle.realRenderer!.enableDriveLod).toBe(true)
    })

    it('real renderer has enableLod: true', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      expect(handle.realRenderer!.enableLod).toBe(true)
    })

    it('passes device-profile Spark options through to both renderers', () => {
      const profileOptions: SparkRendererOptions = {
        ...baseOptions,
        lodSplatScale: 0.5,
        lodRenderScale: 2,
        maxStdDev: 4,
        maxPagedSplats: 262_144,
        coneFov0: 0.3,
        coneFov: 0.7,
        coneFoveate: 0.4,
        behindFoveate: 0.3,
      }
      const handle = createSparkStudioRenderer(profileOptions)
      handle.attach(scene, renderer)

      for (const label of ['editor', 'real'] as const) {
        const r = label === 'editor' ? handle.editorRenderer! : handle.realRenderer!
        expect(r.lodSplatScale).toBe(0.5)
        expect(r.lodRenderScale).toBe(2)
        expect(r.maxStdDev).toBe(4)
        expect(r.maxPagedSplats).toBe(262_144)
        expect(r.coneFov0).toBe(0.3)
        expect(r.coneFov).toBe(0.7)
        expect(r.coneFoveate).toBe(0.4)
        expect(r.behindFoveate).toBe(0.3)
      }
    })
  })

  describe('attach idempotence', () => {
    it('only adds editor renderer to scene once on repeated attach calls', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)
      handle.attach(scene, renderer)

      expect(scene.add).toHaveBeenCalledTimes(1)
      expect(scene.add).toHaveBeenCalledWith(handle.editorRenderer)
    })

    it('real renderer is never added to the scene', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      expect(scene.add).not.toHaveBeenCalledWith(handle.realRenderer)
    })
  })

  describe('camera routing', () => {
    it('sets sparkOverride to editorRenderer during editor camera render', () => {
      const originalFn = vi.fn()
      const mockRenderer = {
        ...makeMockRenderer(),
        render: originalFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: mockRenderer })
      handle.attach(scene, mockRenderer)

      const editorCamera = new THREE.PerspectiveCamera()
      editorCamera.userData.editorCamera = true

      // Observe sparkOverride INSIDE the raw render call
      originalFn.mockImplementation(() => {
        expect(SparkRenderer.sparkOverride).toBe(handle.editorRenderer)
        expect((SparkRenderer.sparkOverride as SparkRenderer).enableDriveLod).toBe(false)
      })

      mockRenderer.render(scene, editorCamera)

      // After render, override is restored
      expect(SparkRenderer.sparkOverride).toBeUndefined()
    })

    it('sets sparkOverride to realRenderer during real/default camera render', () => {
      const originalFn = vi.fn()
      const mockRenderer = {
        ...makeMockRenderer(),
        render: originalFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: mockRenderer })
      handle.attach(scene, mockRenderer)

      const realCamera = new THREE.PerspectiveCamera()
      realCamera.userData.editorCamera = false

      // Observe sparkOverride INSIDE the raw render call
      originalFn.mockImplementation(() => {
        expect(SparkRenderer.sparkOverride).toBe(handle.realRenderer)
        expect((SparkRenderer.sparkOverride as SparkRenderer).enableDriveLod).toBe(true)
      })

      mockRenderer.render(scene, realCamera)

      // After render, override is restored
      expect(SparkRenderer.sparkOverride).toBeUndefined()
    })

    it('shares lodInstances from real to editor before editor render', () => {
      const originalFn = vi.fn()
      const mockRenderer = {
        ...makeMockRenderer(),
        render: originalFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: mockRenderer })
      handle.attach(scene, mockRenderer)

      const realR = handle.realRenderer!
      const editorR = handle.editorRenderer!

      // Seed real renderer lodInstances
      const mockMesh = {} as unknown as THREE.Object3D
      const lodData = { lodId: 1, numSplats: 100, indices: new Uint32Array(100), texture: {} as THREE.DataTexture }
      realR.lodInstances.set(mockMesh, lodData)
      editorR.lodInstances.clear()

      const editorCamera = new THREE.PerspectiveCamera()
      editorCamera.userData.editorCamera = true

      mockRenderer.render(scene, editorCamera)

      // Editor should now have the shared instances
      expect(editorR.lodInstances.get(mockMesh)).toBe(lodData)
    })

    it('shares lodInstances after real camera render for next editor frame', () => {
      const originalFn = vi.fn()
      const mockRenderer = {
        ...makeMockRenderer(),
        render: originalFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: mockRenderer })
      handle.attach(scene, mockRenderer)

      const realR = handle.realRenderer!
      const editorR = handle.editorRenderer!

      const mockMesh = {} as unknown as THREE.Object3D
      const lodData = { lodId: 42, numSplats: 200, indices: new Uint32Array(200), texture: {} as THREE.DataTexture }
      realR.lodInstances.set(mockMesh, lodData)
      editorR.lodInstances.clear()

      const realCamera = new THREE.PerspectiveCamera()
      realCamera.userData.editorCamera = false

      mockRenderer.render(scene, realCamera)

      // After real render, editor should have received the shared instances
      expect(editorR.lodInstances.get(mockMesh)).toBe(lodData)
    })
  })

  describe('override restoration', () => {
    it('restores sparkOverride after successful editor render', () => {
      const originalFn = vi.fn()
      const mockRenderer = {
        ...makeMockRenderer(),
        render: originalFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: mockRenderer })
      handle.attach(scene, mockRenderer)

      const editorCamera = new THREE.PerspectiveCamera()
      editorCamera.userData.editorCamera = true

      const previousOverride = {} as unknown as SparkRenderer
      SparkRenderer.sparkOverride = previousOverride

      mockRenderer.render(scene, editorCamera)
      expect(SparkRenderer.sparkOverride).toBe(previousOverride)
    })

    it('restores sparkOverride after successful real camera render', () => {
      const originalFn = vi.fn()
      const mockRenderer = {
        ...makeMockRenderer(),
        render: originalFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: mockRenderer })
      handle.attach(scene, mockRenderer)

      const realCamera = new THREE.PerspectiveCamera()
      realCamera.userData.editorCamera = false

      const previousOverride = {} as unknown as SparkRenderer
      SparkRenderer.sparkOverride = previousOverride

      mockRenderer.render(scene, realCamera)
      expect(SparkRenderer.sparkOverride).toBe(previousOverride)
    })

    it('restores sparkOverride when editor render throws', () => {
      const throwingFn = vi.fn(() => { throw new Error('GPU error') })
      const throwingRenderer = {
        ...makeMockRenderer(),
        render: throwingFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: throwingRenderer })
      handle.attach(scene, throwingRenderer)

      const editorCamera = new THREE.PerspectiveCamera()
      editorCamera.userData.editorCamera = true

      const previousOverride = {} as unknown as SparkRenderer
      SparkRenderer.sparkOverride = previousOverride

      expect(() => throwingRenderer.render(scene, editorCamera)).toThrow('GPU error')
      expect(SparkRenderer.sparkOverride).toBe(previousOverride)
    })

    it('restores sparkOverride when real camera render throws', () => {
      const throwingFn = vi.fn(() => { throw new Error('GPU error') })
      const throwingRenderer = {
        ...makeMockRenderer(),
        render: throwingFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: throwingRenderer })
      handle.attach(scene, throwingRenderer)

      const realCamera = new THREE.PerspectiveCamera()
      realCamera.userData.editorCamera = false

      const previousOverride = {} as unknown as SparkRenderer
      SparkRenderer.sparkOverride = previousOverride

      expect(() => throwingRenderer.render(scene, realCamera)).toThrow('GPU error')
      expect(SparkRenderer.sparkOverride).toBe(previousOverride)
    })
  })

  describe('disposal', () => {
    it('disposes both Spark renderers', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      const editorDispose = vi.fn()
      const realDispose = vi.fn()
      handle.editorRenderer!.dispose = editorDispose
      handle.realRenderer!.dispose = realDispose

      handle.dispose()

      expect(editorDispose).toHaveBeenCalledTimes(1)
      expect(realDispose).toHaveBeenCalledTimes(1)
    })

    it('removes editor renderer from scene on dispose', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      const editorRef = handle.editorRenderer!
      handle.dispose()

      expect(scene.remove).toHaveBeenCalledWith(editorRef)
    })

    it('restores original render method on dispose', () => {
      const originalFn = vi.fn()
      const mockRenderer = {
        ...makeMockRenderer(),
        render: originalFn,
      } as unknown as THREE.WebGLRenderer
      const handle = createSparkStudioRenderer({ ...baseOptions, renderer: mockRenderer })
      handle.attach(scene, mockRenderer)

      // After attach, render has been overridden (bound to originalFn)
      expect(mockRenderer.render).not.toBe(originalFn)

      handle.dispose()

      // After dispose, the original is restored
      expect(mockRenderer.render).toBe(originalFn)
    })

    it('is safe to call dispose multiple times', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)

      const editorDispose = vi.fn()
      const realDispose = vi.fn()
      handle.editorRenderer!.dispose = editorDispose
      handle.realRenderer!.dispose = realDispose

      handle.dispose()
      handle.dispose()
      handle.dispose()

      expect(editorDispose).toHaveBeenCalledTimes(1)
      expect(realDispose).toHaveBeenCalledTimes(1)
    })

    it('nulls exposed references after dispose', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)
      handle.dispose()

      expect(handle.editorRenderer).toBeNull()
      expect(handle.realRenderer).toBeNull()
    })

    it('attach after dispose is a no-op', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      handle.attach(scene, renderer)
      handle.dispose()

      const newScene = makeMockScene()
      const newRenderer = makeMockRenderer()
      handle.attach(newScene, newRenderer)

      expect(newScene.add).not.toHaveBeenCalled()
      expect(handle.editorRenderer).toBeNull()
    })
  })

  describe('type contract', () => {
    it('returns a handle with the expected shape', () => {
      const handle = createSparkStudioRenderer(baseOptions)
      expect(typeof handle.attach).toBe('function')
      expect(typeof handle.dispose).toBe('function')
      expect(handle.editorRenderer).toBeNull()
      expect(handle.realRenderer).toBeNull()
    })
  })
})
