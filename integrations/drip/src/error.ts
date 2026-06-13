import { SdkException } from "@chatbotx.io/sdk"

export class DripNoAccountError extends SdkException {
  constructor() {
    super("The Drip API token does not have access to an account", 400, 400)
  }
}

export class DripApiError extends SdkException {
  readonly statusCode: number
  readonly rateLimitLimit?: number
  readonly rateLimitRemaining?: number

  constructor(props: {
    message: string
    statusCode: number
    rateLimitLimit?: number
    rateLimitRemaining?: number
  }) {
    super(props.message, props.statusCode, props.statusCode)
    this.name = "DripApiError"
    this.statusCode = props.statusCode
    this.rateLimitLimit = props.rateLimitLimit
    this.rateLimitRemaining = props.rateLimitRemaining
  }
}
