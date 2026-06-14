import { SdkException } from "@chatbotx.io/sdk"

export type MoosendApiErrorKind =
  | "invalid_credentials"
  | "invalid_response"
  | "provider"
  | "rate_limited"
  | "transport"
  | "user_not_enabled"

const messages: Record<MoosendApiErrorKind, string> = {
  invalid_credentials: "Moosend credentials are invalid",
  invalid_response: "Moosend returned an invalid response",
  provider: "Moosend rejected the request",
  rate_limited: "Moosend rate limit exceeded",
  transport: "Moosend request failed",
  user_not_enabled: "Moosend account is not enabled for API access",
}

export class MoosendApiError extends SdkException {
  readonly statusCode: number
  readonly kind: MoosendApiErrorKind
  readonly providerCode?: number
  readonly retryAfterSeconds?: number

  constructor(props: {
    statusCode: number
    kind: MoosendApiErrorKind
    providerCode?: number
    retryAfterSeconds?: number
  }) {
    super(
      messages[props.kind],
      props.providerCode ?? props.statusCode,
      props.statusCode,
      null,
      props.kind,
    )
    this.name = "MoosendApiError"
    this.statusCode = props.statusCode
    this.kind = props.kind
    this.providerCode = props.providerCode
    this.retryAfterSeconds = props.retryAfterSeconds
  }
}
