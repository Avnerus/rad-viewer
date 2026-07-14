import { describe, it, expect, vi, afterEach } from 'vitest'
import { ScrollAnimatorRuntime } from '$lib/studio/scroll-animator/scrollAnimatorRuntime'
import type { ScrollTriggerInstance } from 'gsap/ScrollTrigger'

function makeMockTrigger(overrides: Partial<ScrollTriggerInstance> = {}): ScrollTriggerInstance {
  return {
    kill: vi.fn(),
    start: 0,
    end: 1000,
    progress: 0,
    scroll: vi.fn(),
    ...overrides,
  }
}

describe('ScrollAnimatorRuntime', () => {
  let runtime: ScrollAnimatorRuntime
  afterEach(() => {
    // Reset state after each test
    runtime = new ScrollAnimatorRuntime()
  })

  it('starts with percentage 0', () => {
    runtime = new ScrollAnimatorRuntime()
    let value = -1
    const unsub = runtime.percentage.subscribe((v) => { value = v })
    expect(value).toBe(0)
    unsub()
  })

  it('attach sets trigger and updates percentage from progress', () => {
    runtime = new ScrollAnimatorRuntime()
    const trigger = makeMockTrigger({ progress: 0.5 })
    runtime.attach(trigger)

    expect(runtime.trigger).toBe(trigger)
    let value = -1
    const unsub = runtime.percentage.subscribe((v) => { value = v })
    expect(value).toBe(50)
    unsub()
  })

  it('updateProgress updates the reactive percentage', () => {
    runtime = new ScrollAnimatorRuntime()
    const values: number[] = []
    const unsub = runtime.percentage.subscribe((v) => { values.push(v) })

    runtime.updateProgress(0)
    runtime.updateProgress(0.25)
    runtime.updateProgress(1)

    expect(values).toEqual([0, 25, 100])
    unsub()
  })

  it('jumpToPercentage uses trigger start/end/scroll', () => {
    runtime = new ScrollAnimatorRuntime()
    const trigger = makeMockTrigger({ start: 0, end: 1000 })
    runtime.attach(trigger)

    runtime.jumpToPercentage(50)
    expect(trigger.scroll).toHaveBeenCalledWith(500)

    runtime.jumpToPercentage(0)
    expect(trigger.scroll).toHaveBeenCalledWith(0)

    runtime.jumpToPercentage(100)
    expect(trigger.scroll).toHaveBeenCalledWith(1000)
  })

  it('jumpToPercentage is no-op when no trigger attached', () => {
    runtime = new ScrollAnimatorRuntime()
    // No crash, no-op
    runtime.jumpToPercentage(50)
  })

  it('detach removes the trigger', () => {
    runtime = new ScrollAnimatorRuntime()
    const trigger = makeMockTrigger({ progress: 0.5 })
    runtime.attach(trigger)
    runtime.detach(trigger)

    expect(runtime.trigger).toBeNull()
    let value = -1
    const unsub = runtime.percentage.subscribe((v) => { value = v })
    expect(value).toBe(0)
    unsub()
  })

  it('detach with wrong trigger is no-op', () => {
    runtime = new ScrollAnimatorRuntime()
    const trigger1 = makeMockTrigger({ progress: 0.5 })
    const trigger2 = makeMockTrigger({ progress: 0.3 })
    runtime.attach(trigger1)
    runtime.detach(trigger2)

    expect(runtime.trigger).toBe(trigger1)
  })

  it('replacing trigger via attach works', () => {
    runtime = new ScrollAnimatorRuntime()
    const trigger1 = makeMockTrigger({ progress: 0.5 })
    const trigger2 = makeMockTrigger({ progress: 0.8 })
    runtime.attach(trigger1)
    runtime.attach(trigger2)

    expect(runtime.trigger).toBe(trigger2)
    let value = -1
    const unsub = runtime.percentage.subscribe((v) => { value = v })
    expect(value).toBe(80)
    unsub()
  })

  it('handles zero-length range', () => {
    runtime = new ScrollAnimatorRuntime()
    const trigger = makeMockTrigger({ start: 500, end: 500 })
    runtime.attach(trigger)

    runtime.jumpToPercentage(50)
    expect(trigger.scroll).toHaveBeenCalledWith(500)
  })

  it('clamps percentage for jump', () => {
    runtime = new ScrollAnimatorRuntime()
    const trigger = makeMockTrigger({ start: 0, end: 1000 })
    runtime.attach(trigger)

    runtime.jumpToPercentage(-10)
    expect(trigger.scroll).toHaveBeenCalledWith(0)

    runtime.jumpToPercentage(110)
    expect(trigger.scroll).toHaveBeenCalledWith(1000)
  })
})
