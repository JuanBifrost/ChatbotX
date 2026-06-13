import { SdkException } from "@chatbotx.io/sdk"

export class MailerLiteApiError extends SdkException {
  readonly statusCode: number
  readonly rateLimitLimit?: number
  readonly rateLimitRemaining?: number
  readonly retryAfterSeconds?: number

  constructor(props: {
    message: string
    statusCode: number
    rateLimitLimit?: number
    rateLimitRemaining?: number
    retryAfterSeconds?: number
  }) {
    super(props.message, props.statusCode, props.statusCode)
    this.name = "MailerLiteApiError"
    this.statusCode = props.statusCode
    this.rateLimitLimit = props.rateLimitLimit
    this.rateLimitRemaining = props.rateLimitRemaining
    this.retryAfterSeconds = props.retryAfterSeconds
  }
}
