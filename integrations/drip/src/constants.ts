export const DRIP_API_BASE_URL = "https://api.getdrip.com/v2/" as const
export const DRIP_HTTP_TIMEOUT_MS = 15_000

export const DRIP_ACCOUNTS_PATH = "accounts"
export const dripTagsPath = (accountId: string) =>
  `${encodeURIComponent(accountId)}/tags`
export const dripCustomFieldIdentifiersPath = (accountId: string) =>
  `${encodeURIComponent(accountId)}/custom_field_identifiers`
export const dripSubscribersPath = (accountId: string) =>
  `${encodeURIComponent(accountId)}/subscribers`
