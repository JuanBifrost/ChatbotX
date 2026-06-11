import { SdkException } from "../exception"
import type { ParsedError } from "../schemas"

type ErrorBody = {
  error?: {
    message?: string
    code?: string | number
    subcode?: string | number
  }
  statusCode?: number
}

type OriginError = {
  response?: {
    error?: ErrorBody
    json?: () => Promise<ErrorBody>
  }
}

export class ZaloSdkException extends SdkException {
  async getErrorData(): Promise<ParsedError> {
    const base = await super.getErrorData()

    const originError = this.originError as OriginError
    if (!originError?.response) {
      return base
    }

    let body: ErrorBody | undefined
    try {
      body = originError.response.error ?? (await originError.response.json?.())
    } catch {
      body = originError.response.error
    }

    const error = body?.error

    return {
      ...base,
      message: error?.message ?? base.message,
      code: error?.code ?? base.code,
      statusCode: body?.statusCode ?? base.statusCode,
      subcode: error?.subcode ?? base.subcode,
    }
  }
}
