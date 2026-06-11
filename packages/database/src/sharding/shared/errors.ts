export class ShardNotActiveError extends Error {
  constructor(
    message = "No active shard configured. Admin must activate a shard.",
  ) {
    super(message)
    this.name = "ShardNotActiveError"
  }
}

export class ShardUnreachableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "ShardUnreachableError"
  }
}

const CONNECTION_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "57P01",
  "57P02",
  "57P03",
])

const CONNECTION_ERROR_MESSAGE_PATTERN =
  /connection terminated|connection refused|connection ended|timeout exceeded when trying to connect/i

const MAX_CAUSE_DEPTH = 5

export function isConnectionError(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    if (typeof current !== "object") {
      return false
    }

    const { code, message } = current as { code?: unknown; message?: unknown }
    if (
      typeof code === "string" &&
      (CONNECTION_ERROR_CODES.has(code) || code.startsWith("08"))
    ) {
      return true
    }

    if (
      typeof message === "string" &&
      CONNECTION_ERROR_MESSAGE_PATTERN.test(message)
    ) {
      return true
    }

    current = (current as { cause?: unknown }).cause
  }

  return false
}
