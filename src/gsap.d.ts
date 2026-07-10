declare module 'gsap/ScrollTrigger' {
  export const ScrollTrigger: {
    create(config: {
      trigger?: string | HTMLElement
      start?: string
      end?: string
      scrub?: boolean | number
      onUpdate?: (self: { progress: number }) => void
    }): { kill(): void }
  }
}

declare module 'gsap' {
  export function registerPlugin(...plugins: unknown[]): void
}
