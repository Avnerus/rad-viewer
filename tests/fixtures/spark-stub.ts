/**
 * Test stub for @sparkjsdev/spark.
 *
 * Used in e2e tests to avoid loading the real Spark library (which requires
 * a large remote RAD file and GPU-specific WebGL behavior).
 *
 * Activate with: VITE_E2E_STUB_SPARK=true
 */

import { Object3D } from 'three'

export class SparkRenderer extends Object3D {
  constructor(_options?: Record<string, unknown>) {
    super()
  }

  dispose(): void {
    // no-op
  }
}

export class SplatMesh extends Object3D {
  constructor(_options?: Record<string, unknown>) {
    super()
  }

  dispose(): void {
    // no-op
  }

  addEventListener(_type: string, _handler: unknown): void {
    // no-op
  }

  removeEventListener(_type: string, _handler: unknown): void {
    // no-op
  }
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}
