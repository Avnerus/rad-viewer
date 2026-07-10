import { describe, it, expect } from 'vitest'
import { validateRadUrl } from '$lib/spark/radUrl'

describe('validateRadUrl', () => {
  it('accepts a valid https URL with .rad extension', () => {
    const result = validateRadUrl('https://example.com/model-lod.rad')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.url).toBe('https://example.com/model-lod.rad')
  })

  it('accepts a valid http URL with .rad extension', () => {
    const result = validateRadUrl('http://example.com/model.rad')
    expect(result.ok).toBe(true)
  })

  it('accepts a URL with query string and .rad extension', () => {
    const result = validateRadUrl('https://example.com/model.rad?token=abc')
    expect(result.ok).toBe(true)
  })

  it('accepts a URL with hash fragment and .rad extension', () => {
    const result = validateRadUrl('https://example.com/model.rad#section')
    expect(result.ok).toBe(true)
  })

  it('accepts an absolute relative path with .rad extension', () => {
    const result = validateRadUrl('/assets/model.rad')
    expect(result.ok).toBe(true)
  })

  it('accepts a dot-relative path with .rad extension', () => {
    const result = validateRadUrl('./splats/model.rad')
    expect(result.ok).toBe(true)
  })

  it('rejects empty input', () => {
    const result = validateRadUrl('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('required')
  })

  it('rejects whitespace-only input', () => {
    const result = validateRadUrl('   ')
    expect(result.ok).toBe(false)
  })

  it('rejects non-.rad extension', () => {
    const result = validateRadUrl('https://example.com/model.splat')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('.rad')
  })

  it('rejects ftp protocol', () => {
    const result = validateRadUrl('ftp://example.com/model.rad')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('http')
  })

  it('rejects file protocol', () => {
    const result = validateRadUrl('file:///local/model.rad')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('http')
  })

  it('rejects invalid URL format', () => {
    const result = validateRadUrl('not-a-url-at-all')
    expect(result.ok).toBe(false)
  })

  it('trims whitespace from input', () => {
    const result = validateRadUrl('  https://example.com/model.rad  ')
    expect(result.ok).toBe(true)
  })

  it('is case-insensitive for .RAD extension', () => {
    const result = validateRadUrl('https://example.com/model.RAD')
    expect(result.ok).toBe(true)
  })
})
