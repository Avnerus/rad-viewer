import type { ValidationResult } from '$lib/types'

/**
 * Validate a RAD URL.
 *
 * Accepted schemes: `http:`, `https:`, and same-origin relative URLs.
 * The path must end with `.rad` (query strings / hash fragments are allowed).
 */
export function validateRadUrl(input: string): ValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { ok: false, error: 'URL is required.' }
  }

  let pathname: string

  try {
    // Try to parse as absolute URL first
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: 'Only http: and https: protocols are allowed.' }
    }
    pathname = url.pathname
  } catch {
    // Not an absolute URL — treat as relative
    if (trimmed.startsWith('/') || trimmed.startsWith('.')) {
      pathname = new URL(trimmed, 'http://localhost').pathname
    } else {
      return { ok: false, error: 'Invalid URL format. Provide a full http/https URL or a relative path.' }
    }
  }

  // Strip query string and hash from pathname, then check .rad extension
  const cleanPath = pathname.split('?')[0].split('#')[0]
  if (!cleanPath.toLowerCase().endsWith('.rad')) {
    return { ok: false, error: 'File must have a .rad extension.' }
  }

  return { ok: true, url: trimmed }
}
