/**
 * Strip HTML tags and dangerous patterns from user-provided content to prevent XSS.
 * AICORD messages are plain text + markdown — raw HTML should never be present.
 */
export function sanitizeContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, '') // strip all HTML tags
    .replace(/javascript\s*:/gi, '') // strip javascript: protocol refs (with optional whitespace)
    .replace(/vbscript\s*:/gi, '') // strip vbscript: protocol refs
    .replace(/data\s*:/gi, '') // strip data: URI refs
    .replace(/on\w+\s*=/gi, '') // strip inline event handlers (onclick=, onerror=, etc.)
    .trim()
}

/** Sanitize a server/channel display name — strip control chars and collapse whitespace */
export function sanitizeName(name: string): string {
  return name
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control characters
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
}
