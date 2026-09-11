/**
 * Turns an Execute JavaScript return value into JSON the Test Now tree can
 * browse. `undefined` becomes `null` so JSON.parse always succeeds.
 */
export const stringifySandboxValue = (value: unknown): string => {
  if (value === undefined) {
    return "null"
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return JSON.stringify(String(value))
  }
}
