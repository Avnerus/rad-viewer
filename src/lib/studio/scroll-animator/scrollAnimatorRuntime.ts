/**
 * Shared runtime bridge between RadViewerScene (ScrollTrigger owner) and
 * the ScrollAnimator Studio extension.
 *
 * Provides:
 * - Reactive current percentage from ScrollTrigger progress (via a Svelte store)
 * - Jump-to-percentage using the trigger's measured start/end range
 * - Attach/detach lifecycle tied to trigger identity
 *
 * A single module-level instance is shared across the scene and extension.
 */
import { writable, type Writable } from 'svelte/store'
import type { ScrollTriggerInstance } from 'gsap/ScrollTrigger'
import { clampPercentage, percentageToScroll } from '$lib/spark/scrollAnimation'

export class ScrollAnimatorRuntime {
  /** Reactive Svelte store for the current percentage (0..100). */
  readonly percentage: Writable<number> = writable(0)

  private _trigger: ScrollTriggerInstance | null = null

  get trigger(): ScrollTriggerInstance | null {
    return this._trigger
  }

  /**
   * Attach the ScrollTrigger instance. Replaces any prior trigger.
   * Immediately updates the reactive percentage from the trigger's current progress.
   */
  attach(trigger: ScrollTriggerInstance): void {
    this._trigger = trigger
    this.updateProgress(trigger.progress)
  }

  /**
   * Detach the specific ScrollTrigger instance.
   * No-op if the given trigger is not the currently attached one.
   */
  detach(trigger: ScrollTriggerInstance): void {
    if (this._trigger === trigger) {
      this._trigger = null
      this.percentage.set(0)
    }
  }

  /**
   * Update the reactive percentage from a 0..1 progress value.
   * Called from ScrollTrigger's onUpdate callback and initial setup.
   */
  updateProgress(progress: number): void {
    this.percentage.set(clampPercentage(progress * 100))
  }

  /**
   * Jump to a percentage (0..100) using the active trigger's measured
   * start/end range and its scroll() method.
   * No-op if no trigger is attached.
   */
  jumpToPercentage(percent: number): void {
    if (!this._trigger) return
    const target = percentageToScroll(percent, this._trigger.start, this._trigger.end)
    this._trigger.scroll(target)
  }
}

/** Module-level singleton shared by the scene and extension. */
export const scrollAnimatorRuntime = new ScrollAnimatorRuntime()
