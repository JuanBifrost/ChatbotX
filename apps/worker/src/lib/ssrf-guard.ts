// RFC-1918, loopback, link-local — reject to prevent SSRF from user-supplied URLs
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc[\da-f]{2}:/i,
  /^fd[\da-f]{2}:/i,
]

export function assertPublicUrl(rawUrl: string, context = "URL"): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`[ssrf-guard] Invalid ${context}: ${rawUrl}`)
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`[ssrf-guard] Unsupported URL scheme: ${parsed.protocol}`)
  }

  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(parsed.hostname))) {
    throw new Error(`[ssrf-guard] URL hostname not allowed: ${parsed.hostname}`)
  }
}
