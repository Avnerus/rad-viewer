/** Result type for RAD URL validation */
export type ValidationResult = SuccessResult | ErrorResult

export interface SuccessResult {
  ok: true
  url: string
}

export interface ErrorResult {
  ok: false
  error: string
}

/** Camera pose for scroll-driven tweening */
export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

/** Spark renderer performance profile options */
export interface SparkRendererOptions {
  lodSplatScale: number
  lodRenderScale: number
  maxStdDev: number
  maxPagedSplats: number
  coneFov0: number
  coneFov: number
  coneFoveate: number
  behindFoveate: number
}

/** Device profile for Spark / renderer settings */
export interface DeviceProfile {
  isMobile: boolean
  dpr: number
  sparkRenderer: SparkRendererOptions
}
