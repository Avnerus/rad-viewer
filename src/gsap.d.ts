declare module 'gsap/ScrollTrigger' {
  export interface ScrollTriggerInstance {
    kill(): void
    start: number
    end: number
    progress: number
    scroll(scrollY: number): void
  }

  export const ScrollTrigger: {
    create(config: {
      trigger?: string | HTMLElement
      start?: string
      end?: string
      scrub?: boolean | number
      onUpdate?: (self: ScrollTriggerInstance) => void
    }): ScrollTriggerInstance
    maxScroll(window: Window): { y: number }
    refresh(): void
  }
}

declare module 'gsap' {
  export function registerPlugin(...plugins: unknown[]): void
}
