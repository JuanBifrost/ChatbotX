import { SdkException } from "@chatbotx.io/sdk"

export class ActiveCampaignApiError extends SdkException {
  readonly statusCode: number
  readonly providerErrors?: unknown

  constructor(props: {
    message: string
    statusCode: number
    providerErrors?: unknown
  }) {
    super(props.message, props.statusCode, props.statusCode)
    this.name = "ActiveCampaignApiError"
    this.statusCode = props.statusCode
    this.providerErrors = props.providerErrors
  }
}
