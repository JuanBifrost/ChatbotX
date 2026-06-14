import { SdkException } from "@chatbotx.io/sdk"

export class KlaviyoApiError extends SdkException {
  readonly statusCode: number
  readonly retryAfterSeconds?: number

  constructor(props: {
    message: string
    statusCode: number
    retryAfterSeconds?: number
  }) {
    super(props.message, props.statusCode, props.statusCode)
    this.name = "KlaviyoApiError"
    this.statusCode = props.statusCode
    this.retryAfterSeconds = props.retryAfterSeconds
  }
}
