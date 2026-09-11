const SENSITIVE_KEY_PATTERN =
  /(?:password|secret|token|api[_-]?key|authorization|credential)/i

const REDACTED_VALUE = "[redacted]"

const sanitizeSnapshotValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSnapshotValue(item))
  }
  if (typeof value === "object") {
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      next[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED_VALUE
        : sanitizeSnapshotValue(child)
    }
    return next
  }
  return value
}

/**
 * Builds the contact `input` object shown in Execute JavaScript Test Now,
 * redacting keys that look like secrets.
 */
export const sanitizeJavascriptInputSnapshot = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const snapshot = sanitizeSnapshotValue(input)
  if (typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot)) {
    return snapshot
  }
  return {}
}
