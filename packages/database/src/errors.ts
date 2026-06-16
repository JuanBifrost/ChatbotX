export class ModelNotfoundException extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModelNotfoundException"
  }
}

export class MessageShardConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "MessageShardConfigurationError"
  }
}

export class MessageShardUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "MessageShardUnavailableError"
  }
}

export function isMessageStorageError(
  error: unknown,
): error is MessageShardConfigurationError | MessageShardUnavailableError {
  return (
    error instanceof MessageShardConfigurationError ||
    error instanceof MessageShardUnavailableError
  )
}
