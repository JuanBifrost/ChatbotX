export const MAILCHIMP_API_VERSION = "3.0"
export const MAILCHIMP_API_BASE_URL_PATTERN =
  `https://{dataCenter}.api.mailchimp.com/${MAILCHIMP_API_VERSION}/` as const
export const MAILCHIMP_PING_ENDPOINT = "ping"
export const MAILCHIMP_DEFAULT_PAGE_SIZE = 1000
