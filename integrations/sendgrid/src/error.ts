import { SdkException } from "@chatbotx.io/sdk"

export class SendGridMissingScopesError extends SdkException {
  readonly missingScopes: string[]

  constructor(missingScopes: string[]) {
    super(
      `The SendGrid API key is missing required scopes: ${missingScopes.join(", ")}`,
      400,
      400,
    )
    this.name = "SendGridMissingScopesError"
    this.missingScopes = missingScopes
  }
}

export class SendGridApiError extends SdkException {
  readonly statusCode: number
  readonly field?: string
  readonly errorId?: string
  readonly rateLimitLimit?: number
  readonly rateLimitRemaining?: number
  readonly rateLimitReset?: number
  readonly retryAfterSeconds?: number

  constructor(props: {
    message: string
    statusCode: number
    field?: string
    errorId?: string
    rateLimitLimit?: number
    rateLimitRemaining?: number
    rateLimitReset?: number
    retryAfterSeconds?: number
  }) {
    super(props.message, props.statusCode, props.statusCode)
    this.name = "SendGridApiError"
    this.statusCode = props.statusCode
    this.field = props.field
    this.errorId = props.errorId
    this.rateLimitLimit = props.rateLimitLimit
    this.rateLimitRemaining = props.rateLimitRemaining
    this.rateLimitReset = props.rateLimitReset
    this.retryAfterSeconds = props.retryAfterSeconds
  }
}
