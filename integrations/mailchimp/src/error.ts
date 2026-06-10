import { SdkException } from "@chatbotx.io/sdk"

export class MailchimpApiError extends SdkException {
  readonly detail?: string
  readonly errors?: Array<{ field: string; message: string }>
  readonly retryAfter?: number
  readonly statusCode: number

  constructor(props: {
    message: string
    statusCode: number
    detail?: string
    errors?: Array<{ field: string; message: string }>
    retryAfter?: number
  }) {
    super(props.message, props.statusCode, props.statusCode)
    this.name = "MailchimpApiError"
    this.statusCode = props.statusCode
    this.detail = props.detail
    this.errors = props.errors
    this.retryAfter = props.retryAfter
  }
}
